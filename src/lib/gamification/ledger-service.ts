// =============================================================================
// Gamification Ledger Service
// Single gateway to bonus_events for the gamification system.
// All writes use Admin client (service role) — zero client trust.
// All date boundaries use strict COT (America/Bogota).
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { BonusEvent, BonusLaunch } from '@/lib/types';
import {
  calculateTaskScore,
  resolveMatrixType,
  type TaskScoreResult,
} from './task-scoring';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal task data needed for scoring — caller provides from DB row */
export interface TaskDataForScoring {
  taskId: string;
  impact: 'high' | 'medium' | 'low';
  /** Actual or estimated effort in minutes */
  effortMinutes: number;
  /** Task deadline as ISO 8601 string (from due_date + EOD) */
  deadlineTime: string;
  /** Completion timestamp as ISO 8601 string (from completed_at) */
  completionTime: string;
}

export interface LedgerWriteResult {
  success: boolean;
  bonusEventId: string | null;
  scoring: TaskScoreResult | null;
  error: string | null;
}

export interface GhostCloseResult {
  action: 'inserted_ghost' | 'already_exists' | 'no_active_launch' | 'error';
  bonusEventId: string | null;
  yesterdayCot: string;
  error: string | null;
}

// ---------------------------------------------------------------------------
// COT helpers (server-side only — no system-local-time dependency)
// ---------------------------------------------------------------------------

/**
 * Returns today's date as YYYY-MM-DD in Colombia timezone.
 * Self-contained to avoid circular imports with tasks/dates.ts.
 */
function getTodayCot(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Returns yesterday's date as YYYY-MM-DD in Colombia timezone.
 * Subtracts one calendar day from COT "today" using UTC-anchored math.
 */
function getYesterdayCot(): string {
  const todayStr = getTodayCot();
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  todayUtc.setUTCDate(todayUtc.getUTCDate() - 1);
  return todayUtc.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Internal: resolve active bonus launch
// ---------------------------------------------------------------------------

async function getActiveLaunch(): Promise<Pick<BonusLaunch, 'id' | 'name' | 'status'> | null> {
  const supabase = createAdminClient();
  const { data } = (await supabase
    .from('bonus_launches')
    .select('id, name, status')
    .in('status', ['active', 'projected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: Pick<BonusLaunch, 'id' | 'name' | 'status'> | null };

  return data;
}

// ---------------------------------------------------------------------------
// processTaskCompletion
// ---------------------------------------------------------------------------

/**
 * Scores a completed task and atomically inserts the bonus_event.
 *
 * Call this from API routes / Server Actions AFTER the task is marked
 * as completed in the DB. Idempotency: 10-second dedup window on
 * (launch_id, user_id, event_type='task_completed', points).
 *
 * @param userId        — The user who completed the task (from server session)
 * @param registeredBy  — Who triggered this write (from server session, usually same as userId)
 * @param taskData      — Minimal task fields for scoring
 */
export async function processTaskCompletion(
  userId: string,
  registeredBy: string,
  taskData: TaskDataForScoring,
): Promise<LedgerWriteResult> {
  try {
    // 1. Find active launch
    const launch = await getActiveLaunch();
    if (!launch) {
      return {
        success: false,
        bonusEventId: null,
        scoring: null,
        error: 'No hay lanzamiento activo o proyectado para registrar puntos',
      };
    }

    // 2. Run pure math
    const matrixType = resolveMatrixType(taskData.impact, taskData.effortMinutes);
    const scoring = calculateTaskScore(
      matrixType,
      taskData.deadlineTime,
      taskData.completionTime,
    );

    // 3. Idempotency: reject duplicate within 10-second window.
    // Discriminator is metadata.task_id, NOT points — two different tasks can have
    // identical scores, which would cause false-positive dedup with .eq('points').
    // Using task_id ensures concurrent requests for the SAME task are caught once
    // the first insert is visible, while requests for different tasks are unaffected.
    const supabase = createAdminClient();
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const { data: recentDup } = await supabase
      .from('bonus_events')
      .select('id')
      .eq('launch_id', launch.id)
      .eq('user_id', userId)
      .eq('event_type', 'task_completed' as BonusEvent['event_type'])
      .filter('metadata->>task_id', 'eq', taskData.taskId)
      .gte('created_at', tenSecondsAgo)
      .maybeSingle() as { data: { id: string } | null };

    if (recentDup) {
      return {
        success: false,
        bonusEventId: recentDup.id,
        scoring,
        error: 'Evento duplicado detectado (ventana 10s)',
      };
    }

    // 4. Build description with modifier summary
    const modSummary = scoring.appliedModifiers
      .map((m) => m.reason)
      .join(' | ');
    const description = `Tarea ${taskData.taskId}: ${scoring.finalScore}/${scoring.basePoints} pts (${matrixType}). ${modSummary}`;

    // 5. Atomic insert with metadata JSONB
    const { data: inserted, error: insertError } = (await supabase
      .from('bonus_events')
      .insert({
        launch_id: launch.id,
        user_id: userId,
        event_type: 'task_completed',
        points: scoring.finalScore,
        description,
        registered_by: registeredBy,
        metadata: {
          source: 'gamification_engine',
          task_id: taskData.taskId,
          matrix_type: matrixType,
          base_points: scoring.basePoints,
          applied_modifiers: scoring.appliedModifiers,
          cot_calculation_log: scoring.cotCalculationLog,
        },
      } as never)
      .select('id')
      .single()) as { data: { id: string } | null; error: unknown };

    if (insertError) {
      console.error(
        `[LEDGER_ERROR] bonus_event insert failed event_type=task_completed user_id=${userId} task_id=${taskData.taskId} launch_id=${launch.id} score=${scoring.finalScore}: ${String(insertError)}`,
      );
      return {
        success: false,
        bonusEventId: null,
        scoring,
        error: `Error DB: ${String(insertError)}`,
      };
    }

    return {
      success: true,
      bonusEventId: inserted?.id ?? null,
      scoring,
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[LEDGER_ERROR] Unhandled exception in processTaskCompletion user_id=${userId} task_id=${taskData.taskId}: ${msg}`,
    );
    return {
      success: false,
      bonusEventId: null,
      scoring: null,
      error: `Unexpected error: ${msg}`,
    };
  }
}

// ---------------------------------------------------------------------------
// evaluateGhostClose (Lazy Evaluation)
// ---------------------------------------------------------------------------

/**
 * Checks if the user closed their day yesterday (COT). If not, inserts a
 * "missed_daily_close" record with 0 points as a public shame entry.
 *
 * This is "lazy" — call it on any authenticated page load, login, or
 * dashboard fetch. Idempotent: only inserts once per user per COT day.
 *
 * @param userId        — The user to evaluate (from server session)
 * @param registeredBy  — Who triggered this check (usually 'system' or the user's own ID)
 */
export async function evaluateGhostClose(
  userId: string,
  registeredBy: string,
): Promise<GhostCloseResult> {
  // Computed outside try so it's available in the catch return value.
  const yesterdayCot = getYesterdayCot();

  try {
    // COT day boundaries in ISO for timestamp queries
    // Yesterday 00:00:00 COT = Yesterday 05:00:00 UTC
    // Today 00:00:00 COT = Today 05:00:00 UTC
    const yesterdayStartUtc = `${yesterdayCot}T05:00:00.000Z`;
    const todayCot = getTodayCot();
    const todayStartUtc = `${todayCot}T05:00:00.000Z`;

    // 1. Check if any daily_close or missed_daily_close exists for yesterday
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from('bonus_events')
      .select('id, event_type')
      .eq('user_id', userId)
      .in('event_type', ['daily_close', 'missed_daily_close'])
      .gte('created_at', yesterdayStartUtc)
      .lt('created_at', todayStartUtc)
      .limit(1)
      .maybeSingle() as { data: { id: string; event_type: string } | null };

    if (existing) {
      return {
        action: 'already_exists',
        bonusEventId: existing.id,
        yesterdayCot,
        error: null,
      };
    }

    // 2. Need active launch to write
    const launch = await getActiveLaunch();
    if (!launch) {
      return {
        action: 'no_active_launch',
        bonusEventId: null,
        yesterdayCot,
        error: 'No hay lanzamiento activo para registrar ghost close',
      };
    }

    // 3. Insert missed_daily_close
    const { data: inserted, error: insertError } = (await supabase
      .from('bonus_events')
      .insert({
        launch_id: launch.id,
        user_id: userId,
        event_type: 'missed_daily_close',
        points: 0,
        description: `Olvidó cerrar el día (${yesterdayCot})`,
        registered_by: registeredBy,
        metadata: {
          source: 'ghost_close_lazy_eval',
          missed_date_cot: yesterdayCot,
          evaluated_at_cot: getTodayCot(),
        },
      } as never)
      .select('id')
      .single()) as { data: { id: string } | null; error: unknown };

    if (insertError) {
      console.error(
        `[LEDGER_ERROR] bonus_event insert failed event_type=missed_daily_close user_id=${userId} missed_date=${yesterdayCot} launch_id=${launch.id}: ${String(insertError)}`,
      );
      return {
        action: 'error',
        bonusEventId: null,
        yesterdayCot,
        error: `Error DB: ${String(insertError)}`,
      };
    }

    // 4. Force-close the daily_checkins row for yesterday so admin audit shows the
    //    day as officially closed (not a "zombie" open day). Uses upsert with
    //    ignoreDuplicates to avoid overwriting a real close that somehow exists.
    const { error: checkinError } = await supabase
      .from('daily_checkins')
      .upsert(
        {
          user_id: userId,
          checkin_date: yesterdayCot,
          hours_worked: 0,
          fires_handled: 0,
          blocks_count: 0,
          completion_pct: 0,
          summary: 'Auto-cerrado: no se registró cierre de día',
          auto_closed: true,
        } as never,
        { onConflict: 'user_id,checkin_date', ignoreDuplicates: true },
      );

    if (checkinError) {
      // Non-fatal: penalty event already written. Log for observability and continue.
      console.warn(
        `[LEDGER_WARN] daily_checkins auto-close upsert failed user_id=${userId} date=${yesterdayCot}: ${String(checkinError)}`,
      );
    }

    return {
      action: 'inserted_ghost',
      bonusEventId: inserted?.id ?? null,
      yesterdayCot,
      error: null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[LEDGER_ERROR] Unhandled exception in evaluateGhostClose user_id=${userId} yesterday_cot=${yesterdayCot}: ${msg}`,
    );
    return {
      action: 'error',
      bonusEventId: null,
      yesterdayCot,
      error: `Unexpected error: ${msg}`,
    };
  }
}
