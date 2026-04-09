import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTodayColombia } from '@/lib/tasks/dates';
import type { BonusEvent, BonusLaunch, DailyCheckin, User } from '@/lib/types';

// =============================================================================
// GET /api/cron/auto-close-day — Health check
// =============================================================================
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'auto-close-day' });
}

// =============================================================================
// POST /api/cron/auto-close-day — Auto-close missed daily check-ins
// Runs Tue-Sat at 2:00 AM COT (7:00 UTC) — evaluates Mon-Fri previous day.
// For users who didn't manually close, inserts missed_daily_close (0 pts)
// and marks their daily_checkins row as auto_closed.
// ?force=true (dev only): skip auth
// =============================================================================
export async function POST(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // 1. Auth: Bearer token (prod) OR dev force bypass
  // ---------------------------------------------------------------------------
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isForceParam = request.nextUrl.searchParams.get('force') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  const hasValidToken = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasDevBypass = isDev && isForceParam;

  if (!hasValidToken && !hasDevBypass) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const forceMode = isForceParam;

  // ---------------------------------------------------------------------------
  // 2. Date setup — compute yesterday in COT
  // ---------------------------------------------------------------------------
  const todayCot = getTodayColombia();
  const [y, m, d] = todayCot.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  todayUtc.setUTCDate(todayUtc.getUTCDate() - 1);
  const yesterdayCot = todayUtc.toISOString().slice(0, 10);

  // Validate yesterday was a weekday (Mon=1 .. Fri=5, Sat=6, Sun=0)
  const yesterdayDow = todayUtc.getUTCDay();
  if (!forceMode && (yesterdayDow === 0 || yesterdayDow === 6)) {
    console.log(
      `[CRON] auto-close-day skipped: yesterday=${yesterdayCot} is a weekend (dow=${yesterdayDow})`,
    );
    return NextResponse.json({
      status: 'skipped',
      reason: 'yesterday_is_weekend',
      yesterday: yesterdayCot,
    });
  }

  if (forceMode) {
    console.log(`[CRON] === AUTO-CLOSE FORCE MODE === yesterday=${yesterdayCot} dow=${yesterdayDow}`);
  }

  const supabase = createAdminClient();

  // ---------------------------------------------------------------------------
  // 3. Resolve active launch (needed for bonus_events)
  // ---------------------------------------------------------------------------
  const { data: launch } = (await supabase
    .from('bonus_launches')
    .select('id, name, status')
    .in('status', ['active', 'projected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: Pick<BonusLaunch, 'id' | 'name' | 'status'> | null };

  if (!launch) {
    console.log('[CRON] auto-close-day skipped: no active/projected launch found');
    return NextResponse.json({
      status: 'skipped',
      reason: 'no_active_launch',
      yesterday: yesterdayCot,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Fetch all active users
  // ---------------------------------------------------------------------------
  const { data: activeUsers, error: usersError } = (await supabase
    .from('users')
    .select('id')
    .eq('is_active', true)) as { data: Pick<User, 'id'>[] | null; error: unknown };

  if (usersError || !activeUsers) {
    console.error(`[CRON_ERROR] auto-close-day failed to fetch users: ${String(usersError)}`);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }

  // ---------------------------------------------------------------------------
  // 5. Batch pre-fetch: existing checkins + bonus events for yesterday
  //    (N+1 prevention — 2 queries for all users)
  // ---------------------------------------------------------------------------
  const userIds = activeUsers.map((u) => u.id);

  // UTC start of yesterday's COT day (yesterday 00:00 COT = yesterday 05:00 UTC).
  // We use this as the lower bound for the bonus_events dedup window:
  //   - daily_close events were created DURING yesterday's COT day
  //   - missed_daily_close events are created TODAY by a prior cron run
  // Both fall after yesterdayStartUtc, so a single gte filter covers idempotency
  // for both manual closes and repeated cron executions.
  const yesterdayStartUtc = `${yesterdayCot}T05:00:00.000Z`;

  const [checkinsResult, bonusEventsResult] = (await Promise.all([
    // All daily_checkins for yesterday (manual or auto)
    supabase
      .from('daily_checkins')
      .select('id, user_id, auto_closed')
      .eq('checkin_date', yesterdayCot)
      .in('user_id', userIds),
    // daily_close (created yesterday) OR missed_daily_close (created today by prior cron run)
    // gte yesterdayStartUtc catches both windows without needing metadata filter
    supabase
      .from('bonus_events')
      .select('id, user_id, event_type')
      .in('event_type', ['daily_close', 'missed_daily_close'])
      .in('user_id', userIds)
      .gte('created_at', yesterdayStartUtc),
  ])) as [
    { data: Pick<DailyCheckin, 'id' | 'user_id' | 'auto_closed'>[] | null; error: unknown },
    { data: Pick<BonusEvent, 'id' | 'user_id' | 'event_type'>[] | null; error: unknown },
  ];

  if (checkinsResult.error) {
    console.error(`[CRON_ERROR] auto-close-day failed to fetch checkins: ${String(checkinsResult.error)}`);
    return NextResponse.json({ error: 'Error al obtener checkins' }, { status: 500 });
  }
  if (bonusEventsResult.error) {
    console.error(`[CRON_ERROR] auto-close-day failed to fetch bonus_events: ${String(bonusEventsResult.error)}`);
    return NextResponse.json({ error: 'Error al obtener bonus events' }, { status: 500 });
  }

  // Build O(1) lookup: user_id → existing checkin (for UPDATE vs INSERT decision)
  const checkinsByUser = new Map<string, { id: string; auto_closed: boolean }>();
  for (const c of checkinsResult.data ?? []) {
    checkinsByUser.set(c.user_id, { id: c.id, auto_closed: c.auto_closed });
  }

  // Users who already have a daily_close or missed_daily_close bonus event since yesterday.
  // This is the SOLE skip condition: if a bonus event exists, the day is considered closed.
  // (Checkin row existence only informs UPDATE vs INSERT — not whether to penalize.)
  const usersWithCloseEvent = new Set<string>();
  for (const e of bonusEventsResult.data ?? []) {
    usersWithCloseEvent.add(e.user_id);
  }

  // ---------------------------------------------------------------------------
  // 6. Determine who needs auto-close
  // Skip only if a daily_close or missed_daily_close bonus event already exists.
  // Having a daily_checkins row does NOT protect a user from auto-close —
  // they still get penalized if the bonus event is missing.
  // ---------------------------------------------------------------------------
  const usersToPenalize: string[] = [];
  for (const u of activeUsers) {
    if (usersWithCloseEvent.has(u.id)) continue;
    usersToPenalize.push(u.id);
  }

  if (usersToPenalize.length === 0) {
    console.log(
      `[CRON_SUMMARY] auto_close date=${yesterdayCot} users_checked=${activeUsers.length} users_penalized=0`,
    );
    return NextResponse.json({
      status: 'ok',
      yesterday: yesterdayCot,
      usersChecked: activeUsers.length,
      usersPenalized: 0,
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Process each user — insert bonus_event + conditional checkin
  // ---------------------------------------------------------------------------
  let penalizedCount = 0;
  const errors: string[] = [];

  for (const userId of usersToPenalize) {
    try {
      // 7a. Insert missed_daily_close bonus event (0 pts)
      const { error: eventError } = await supabase
        .from('bonus_events')
        .insert({
          launch_id: launch.id,
          user_id: userId,
          event_type: 'missed_daily_close',
          points: 0,
          description: `Olvidó cerrar el día (${yesterdayCot})`,
          registered_by: userId,
          metadata: {
            source: 'cron_auto_close',
            missed_date_cot: yesterdayCot,
          },
        } as never);

      if (eventError) {
        console.error(
          `[CRON_ERROR] auto-close bonus_event insert failed user_id=${userId} date=${yesterdayCot}: ${String(eventError)}`,
        );
        errors.push(`bonus_event:${userId}`);
        continue;
      }

      // 7b. daily_checkins — conditional: preserve existing metrics
      const existingCheckin = checkinsByUser.get(userId);

      if (existingCheckin) {
        // User has a checkin row (started filling metrics but didn't "close")
        // Only mark as auto_closed, preserve their metrics/summary
        const { error: updateError } = await supabase
          .from('daily_checkins')
          .update({ auto_closed: true } as never)
          .eq('id', existingCheckin.id);

        if (updateError) {
          console.warn(
            `[CRON_WARN] auto-close checkin UPDATE failed user_id=${userId} date=${yesterdayCot}: ${String(updateError)}`,
          );
        }
      } else {
        // User has no checkin row at all — insert with 0 metrics
        const { error: insertError } = await supabase
          .from('daily_checkins')
          .insert({
            user_id: userId,
            checkin_date: yesterdayCot,
            hours_worked: 0,
            fires_handled: 0,
            blocks_count: 0,
            completion_pct: 0,
            summary: 'Auto-cerrado: no se registró cierre de día',
            auto_closed: true,
          } as never);

        if (insertError) {
          console.warn(
            `[CRON_WARN] auto-close checkin INSERT failed user_id=${userId} date=${yesterdayCot}: ${String(insertError)}`,
          );
        }
      }

      penalizedCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[CRON_ERROR] auto-close unhandled exception user_id=${userId} date=${yesterdayCot}: ${msg}`,
      );
      errors.push(`exception:${userId}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Summary log
  // ---------------------------------------------------------------------------
  console.log(
    `[CRON_SUMMARY] auto_close date=${yesterdayCot} users_checked=${activeUsers.length} users_penalized=${penalizedCount} errors=${errors.length}`,
  );

  return NextResponse.json({
    status: 'ok',
    yesterday: yesterdayCot,
    usersChecked: activeUsers.length,
    usersPenalized: penalizedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
