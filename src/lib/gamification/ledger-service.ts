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

// NOTE: evaluateGhostClose (lazy evaluation) has been removed.
// Daily auto-close is now handled by the Vercel Cron Job at
// POST /api/cron/auto-close-day — runs Tue-Sat 2:00 AM COT.
