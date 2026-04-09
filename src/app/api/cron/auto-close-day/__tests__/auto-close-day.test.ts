/**
 * auto-close-day.test.ts
 *
 * Unit tests for POST /api/cron/auto-close-day
 *
 * Covers 4 critical scenarios for the Step 7b conditional checkin logic:
 *   A. Data Loss Guard — user has existing checkin with metrics: UPDATE only sets
 *      auto_closed=true, never zeroes out hours_worked / fires_handled / etc.
 *   B. Zero State      — user has no checkin: INSERT a new row with 0 metrics
 *   C. Weekend Guard   — yesterdayCot is Sat/Sun: early return, DB never touched
 *   D. Idempotency     — cron runs twice: second run finds existing bonus_event
 *                        and must NOT insert a duplicate missed_daily_close
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Test request helpers
// ---------------------------------------------------------------------------

const TEST_CRON_SECRET = 'test-cron-secret-xyz';

/**
 * Production-like request: Bearer token auth, no ?force param.
 * forceMode = false → weekend guard is ACTIVE.
 */
function makeProdRequest(): NextRequest {
  return {
    headers: { get: (h: string) => (h === 'authorization' ? `Bearer ${TEST_CRON_SECRET}` : null) },
    nextUrl: { searchParams: { get: (_: string) => null } },
  } as unknown as NextRequest;
}

/**
 * Dev force request: no auth header, ?force=true.
 * forceMode = true → weekend guard is BYPASSED.
 * Use for weekday scenarios only.
 */
function makeForceRequest(): NextRequest {
  return {
    headers: { get: (_: string) => null },
    nextUrl: { searchParams: { get: (k: string) => (k === 'force' ? 'true' : null) } },
  } as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Supabase mock factory
//
// Creates a stateful mock for the Supabase query builder chain.
// All filter methods return `this`. Terminal resolution pulls from the
// per-table response registry.  Insert/update calls are tracked for
// assertion.
// ---------------------------------------------------------------------------

interface DbCall {
  table: string;
  data: Record<string, unknown>;
}

interface DbState {
  selectResponses: Map<string, { data: unknown[] | null; error: unknown }>;
  maybySingleResponses: Map<string, { data: unknown | null; error: unknown }>;
  insertCalls: DbCall[];
  updateCalls: DbCall[];
  insertErrors: Map<string, unknown>;
  updateErrors: Map<string, unknown>;
}

function createMockSupabase(db: DbState) {
  function createBuilder(table: string) {
    const builder: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),

      insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        db.insertCalls.push({ table, data });
        const err = db.insertErrors.get(table) ?? null;
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: err }),
          then: (onFulfilled: (v: { error: unknown }) => unknown) =>
            Promise.resolve({ error: err }).then(onFulfilled),
        };
      }),

      update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        db.updateCalls.push({ table, data });
        const err = db.updateErrors.get(table) ?? null;
        return {
          eq: vi.fn().mockReturnThis(),
          then: (onFulfilled: (v: { error: unknown }) => unknown) =>
            Promise.resolve({ error: err }).then(onFulfilled),
        };
      }),

      maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve(db.maybySingleResponses.get(table) ?? { data: null, error: null }),
      ),

      // Implicit await on SELECT builder (Promise.all pattern)
      then: (onFulfilled: (v: { data: unknown[] | null; error: unknown }) => unknown) =>
        Promise.resolve(db.selectResponses.get(table) ?? { data: [], error: null }).then(
          onFulfilled,
        ),
    };
    return builder;
  }

  return { from: vi.fn().mockImplementation((table: string) => createBuilder(table)) };
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockAdminClient(),
}));

vi.mock('@/lib/tasks/dates', () => ({
  getTodayColombia: () => mockGetToday(),
}));

const mockAdminClient = vi.fn();
const mockGetToday = vi.fn<[], string>();

// Set the CRON_SECRET env so Bearer auth works in tests
vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET);
// Keep NODE_ENV as 'development' for force-mode tests
vi.stubEnv('NODE_ENV', 'development');

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const USER_1 = { id: 'user-001' };
const USER_2 = { id: 'user-002' };
const ACTIVE_LAUNCH = { id: 'launch-001', name: 'Abril 2026', status: 'projected' };

// A Monday COT date — the day users "forgot to close"
const MONDAY_COT = '2026-04-06';
// Tuesday: today in COT, so yesterday = Monday
const TUESDAY_COT = '2026-04-07';

// Saturday (dow=6): yesterday was Saturday → weekend guard should fire
const SATURDAY_COT = '2026-04-04';
// Sunday: today in COT → yesterday = Saturday
const SUNDAY_COT = '2026-04-05';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/cron/auto-close-day', () => {
  let db: DbState;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules(); // ensure fresh module import per test

    db = {
      selectResponses: new Map(),
      maybySingleResponses: new Map(),
      insertCalls: [],
      updateCalls: [],
      insertErrors: new Map(),
      updateErrors: new Map(),
    };

    mockAdminClient.mockReturnValue(createMockSupabase(db));
  });

  // =========================================================================
  // A. Data Loss Guard
  //
  // User has an existing daily_checkins row with real metrics (auto_closed=false,
  // meaning they did some work tracking but didn't press "Cerrar Día").
  // No daily_close or missed_daily_close bonus_event exists yet.
  // Cron must:
  //   - INSERT missed_daily_close bonus_event (0 pts)
  //   - UPDATE daily_checkins SET auto_closed=true ONLY
  //   - NEVER include metrics fields in the UPDATE payload (would zero them out)
  // =========================================================================
  describe('Scenario A — Data Loss Guard: user has existing daily_checkin with metrics', () => {
    it('UPDATE payload must contain ONLY auto_closed=true, never any metric fields', async () => {
      mockGetToday.mockReturnValue(TUESDAY_COT);

      db.maybySingleResponses.set('bonus_launches', { data: ACTIVE_LAUNCH, error: null });
      db.selectResponses.set('users', { data: [USER_1], error: null });

      // User HAS a checkin row with metrics (auto_closed=false = they had activity)
      db.selectResponses.set('daily_checkins', {
        data: [{ id: 'chk-001', user_id: USER_1.id, auto_closed: false }],
        error: null,
      });

      // No bonus_event yet — this is what makes the cron penalize them
      db.selectResponses.set('bonus_events', { data: [], error: null });

      const { POST } = await import('../route');
      const res = await POST(makeForceRequest());
      const body = await res.json();

      // Cron ran and penalized the user
      expect(res.status).toBe(200);
      expect(body.usersPenalized).toBe(1);

      // bonus_event was inserted
      const bonusInsert = db.insertCalls.find((c) => c.table === 'bonus_events');
      expect(bonusInsert).toBeDefined();
      expect(bonusInsert!.data).toMatchObject({
        event_type: 'missed_daily_close',
        points: 0,
        user_id: USER_1.id,
      });

      // daily_checkins was UPDATED (not inserted — row already exists)
      const checkinUpdate = db.updateCalls.find((c) => c.table === 'daily_checkins');
      expect(checkinUpdate).toBeDefined();

      // ⚠️ CRITICAL ASSERTION: only auto_closed is allowed in the UPDATE payload.
      // Any metric field here means the DB will overwrite the user's real data with 0.
      const payload = checkinUpdate!.data as Record<string, unknown>;
      expect(payload).toEqual({ auto_closed: true });
      expect(payload).not.toHaveProperty('hours_worked');
      expect(payload).not.toHaveProperty('fires_handled');
      expect(payload).not.toHaveProperty('blocks_count');
      expect(payload).not.toHaveProperty('completion_pct');
      expect(payload).not.toHaveProperty('summary');

      // No INSERT on daily_checkins (that would create a duplicate or orphan row)
      const checkinInsert = db.insertCalls.find((c) => c.table === 'daily_checkins');
      expect(checkinInsert).toBeUndefined();
    });
  });

  // =========================================================================
  // B. Zero State
  //
  // User has NO daily_checkins row for yesterday, and no bonus_event.
  // Cron must INSERT a brand-new checkin row with all metrics at 0
  // and auto_closed=true.
  // =========================================================================
  describe('Scenario B — Zero State: user has no daily_checkin at all', () => {
    it('INSERT a new checkin with 0 metrics and auto_closed=true', async () => {
      mockGetToday.mockReturnValue(TUESDAY_COT);

      db.maybySingleResponses.set('bonus_launches', { data: ACTIVE_LAUNCH, error: null });
      db.selectResponses.set('users', { data: [USER_1], error: null });
      db.selectResponses.set('daily_checkins', { data: [], error: null }); // no existing checkin
      db.selectResponses.set('bonus_events', { data: [], error: null });   // no prior event

      const { POST } = await import('../route');
      const res = await POST(makeForceRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.usersPenalized).toBe(1);

      // daily_checkins was INSERTED (not updated — no existing row)
      const checkinInsert = db.insertCalls.find((c) => c.table === 'daily_checkins');
      expect(checkinInsert).toBeDefined();

      const insertPayload = checkinInsert!.data as Record<string, unknown>;
      expect(insertPayload).toMatchObject({
        user_id: USER_1.id,
        checkin_date: MONDAY_COT,
        hours_worked: 0,
        fires_handled: 0,
        blocks_count: 0,
        completion_pct: 0,
        auto_closed: true,
      });
      expect(typeof insertPayload.summary).toBe('string');
      expect((insertPayload.summary as string).length).toBeGreaterThan(0);

      // No UPDATE (would imply phantom existing row was found)
      const checkinUpdate = db.updateCalls.find((c) => c.table === 'daily_checkins');
      expect(checkinUpdate).toBeUndefined();
    });
  });

  // =========================================================================
  // C. Weekend Guard
  //
  // When yesterday was Saturday or Sunday, the cron must return early
  // with status='skipped'. The Supabase client must never be called.
  // Uses prod-style Bearer auth (NOT ?force=true) so forceMode=false
  // and the weekend guard is active.
  // =========================================================================
  describe('Scenario C — Weekend Guard: yesterday was a weekend', () => {
    it('skips and makes ZERO DB calls when yesterday is Saturday', async () => {
      // today = Sunday → yesterday = Saturday (dow=6)
      mockGetToday.mockReturnValue(SUNDAY_COT);

      const mockClient = createMockSupabase(db);
      mockAdminClient.mockReturnValue(mockClient);

      const { POST } = await import('../route');
      // Use prod-style Bearer auth so forceMode=false
      const res = await POST(makeProdRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe('skipped');
      expect(body.reason).toBe('yesterday_is_weekend');
      expect(body.yesterday).toBe(SATURDAY_COT);

      // No DB calls at all
      expect(db.insertCalls).toHaveLength(0);
      expect(db.updateCalls).toHaveLength(0);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('skips when yesterday is Sunday (Monday today)', async () => {
      // today = Monday 2026-04-06 → yesterday = Sunday 2026-04-05 (dow=0)
      mockGetToday.mockReturnValue('2026-04-06');

      const mockClient = createMockSupabase(db);
      mockAdminClient.mockReturnValue(mockClient);

      const { POST } = await import('../route');
      const res = await POST(makeProdRequest());
      const body = await res.json();

      expect(body.status).toBe('skipped');
      expect(body.reason).toBe('yesterday_is_weekend');
      expect(body.yesterday).toBe('2026-04-05');
      expect(db.insertCalls).toHaveLength(0);
      expect(mockClient.from).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // D. Idempotency
  //
  // Cron fires twice (Vercel retry or double-trigger for the same date).
  // The second run must detect the existing missed_daily_close bonus_event
  // (found by the gte(created_at) query) and skip the user — no duplicate.
  // =========================================================================
  describe('Scenario D — Idempotency: cron runs twice for the same day', () => {
    it('does NOT insert a duplicate missed_daily_close when one already exists', async () => {
      mockGetToday.mockReturnValue(TUESDAY_COT);

      db.maybySingleResponses.set('bonus_launches', { data: ACTIVE_LAUNCH, error: null });
      db.selectResponses.set('users', { data: [USER_1], error: null });
      db.selectResponses.set('daily_checkins', { data: [], error: null });

      // Second run: first run already inserted the missed_daily_close event.
      // The cron query uses gte(created_at, yesterdayStartUtc) — this event
      // (created today by the first run) is within that window.
      db.selectResponses.set('bonus_events', {
        data: [{ id: 'evt-001', user_id: USER_1.id, event_type: 'missed_daily_close' }],
        error: null,
      });

      const { POST } = await import('../route');
      const res = await POST(makeForceRequest());
      const body = await res.json();

      expect(res.status).toBe(200);

      // ⚠️ CRITICAL: no user should be penalized a second time
      expect(body.usersPenalized).toBe(0);

      // No bonus_event INSERT for missed_daily_close
      const bonusInserts = db.insertCalls.filter(
        (c) =>
          c.table === 'bonus_events' &&
          (c.data as Record<string, unknown>).event_type === 'missed_daily_close',
      );
      expect(bonusInserts).toHaveLength(0);

      // No checkin writes
      expect(db.updateCalls.filter((c) => c.table === 'daily_checkins')).toHaveLength(0);
      expect(db.insertCalls.filter((c) => c.table === 'daily_checkins')).toHaveLength(0);
    });

    it('handles mixed team: penalized user is skipped, unpenalized user is processed', async () => {
      mockGetToday.mockReturnValue(TUESDAY_COT);

      db.maybySingleResponses.set('bonus_launches', { data: ACTIVE_LAUNCH, error: null });
      db.selectResponses.set('users', { data: [USER_1, USER_2], error: null });
      db.selectResponses.set('daily_checkins', { data: [], error: null });

      // USER_1 was already penalized in the first run; USER_2 was not
      db.selectResponses.set('bonus_events', {
        data: [{ id: 'evt-001', user_id: USER_1.id, event_type: 'missed_daily_close' }],
        error: null,
      });

      const { POST } = await import('../route');
      const res = await POST(makeForceRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      // Only USER_2 should be penalized
      expect(body.usersPenalized).toBe(1);

      const bonusInserts = db.insertCalls.filter(
        (c) =>
          c.table === 'bonus_events' &&
          (c.data as Record<string, unknown>).event_type === 'missed_daily_close',
      );
      expect(bonusInserts).toHaveLength(1);
      expect((bonusInserts[0].data as Record<string, unknown>).user_id).toBe(USER_2.id);
    });

    it('also deduplicates against daily_close events (user closed properly yesterday)', async () => {
      mockGetToday.mockReturnValue(TUESDAY_COT);

      db.maybySingleResponses.set('bonus_launches', { data: ACTIVE_LAUNCH, error: null });
      db.selectResponses.set('users', { data: [USER_1], error: null });
      // USER_1 has a checkin (pressed Cerrar Día) AND a daily_close bonus_event
      db.selectResponses.set('daily_checkins', {
        data: [{ id: 'chk-001', user_id: USER_1.id, auto_closed: false }],
        error: null,
      });
      db.selectResponses.set('bonus_events', {
        data: [{ id: 'evt-001', user_id: USER_1.id, event_type: 'daily_close' }],
        error: null,
      });

      const { POST } = await import('../route');
      const res = await POST(makeForceRequest());
      const body = await res.json();

      // User properly closed their day — must NOT be penalized
      expect(body.usersPenalized).toBe(0);
      const missedInsert = db.insertCalls.find(
        (c) =>
          c.table === 'bonus_events' &&
          (c.data as Record<string, unknown>).event_type === 'missed_daily_close',
      );
      expect(missedInsert).toBeUndefined();
    });
  });
});
