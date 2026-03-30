// =============================================================================
// Task Gamification — Scoring Engine
// Pure server-side utility. Input -> Math -> Output. No DB calls, no side effects.
// All time calculations forced to COT (America/Bogota, UTC-5).
// =============================================================================

// ---------------------------------------------------------------------------
// Value Matrix — Impact x Effort base points
// ---------------------------------------------------------------------------

export const VALUE_MATRIX_TYPES = [
  'high_impact_high_effort',
  'high_impact_low_effort',
  'low_impact_high_effort',
  'low_impact_low_effort',
] as const;

export type ValueMatrixType = (typeof VALUE_MATRIX_TYPES)[number];

export const BASE_POINTS: Record<ValueMatrixType, number> = {
  high_impact_high_effort: 500,
  high_impact_low_effort: 300,
  low_impact_high_effort: 50,
  low_impact_low_effort: 10,
} as const;

// ---------------------------------------------------------------------------
// Time Modifier Constants
// ---------------------------------------------------------------------------

/** Early delivery bonus: +15% when completed before deadline */
const EARLY_DELIVERY_MULTIPLIER = 0.15;

/** Late penalty: -10% per COT calendar day late */
const LATE_PENALTY_PER_DAY = 0.10;

/** Floor: never drop below 10% of base (maintain delivery incentive) */
const MIN_SCORE_RATIO = 0.10;

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface AppliedModifier {
  type: 'early_delivery' | 'late_penalty' | 'none';
  /** e.g. +0.15 for early, -0.30 for 3 days late */
  multiplierDelta: number;
  /** Human-readable detail */
  reason: string;
}

export interface CotCalculationLog {
  deadlineCotDate: string;   // YYYY-MM-DD in COT
  completionCotDate: string; // YYYY-MM-DD in COT
  calendarDaysLate: number;  // 0 if on time or early
  wasEarly: boolean;
}

export interface TaskScoreResult {
  basePoints: number;
  matrixType: ValueMatrixType;
  finalScore: number;
  appliedModifiers: AppliedModifier[];
  cotCalculationLog: CotCalculationLog;
}

// ---------------------------------------------------------------------------
// COT Date Helpers (pure — no system clock dependency)
// ---------------------------------------------------------------------------

/**
 * Converts an ISO timestamp string to a YYYY-MM-DD string in Colombia timezone.
 * Uses Intl API so it works identically on Vercel (UTC) and local dev machines.
 * Mirrors the signature of `toColombiaDate` from `@/lib/tasks/dates.ts`
 * but is self-contained so the scoring engine has zero import dependencies
 * on other app modules (keeps it pure & unit-testable).
 */
function toCotDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-CA', {
    timeZone: 'America/Bogota',
  });
}

/**
 * Calculates the number of COT calendar days between two dates.
 * Uses UTC-anchored date math to avoid DST or locale drift.
 * Returns positive if completion is AFTER deadline, 0 if same day, negative if early.
 */
function cotCalendarDaysDiff(completionIso: string, deadlineIso: string): number {
  const completionDate = toCotDate(completionIso);
  const deadlineDate = toCotDate(deadlineIso);

  // Parse YYYY-MM-DD into UTC midnight for clean day diff
  const [cY, cM, cD] = completionDate.split('-').map(Number);
  const [dY, dM, dD] = deadlineDate.split('-').map(Number);

  const completionMs = Date.UTC(cY, cM - 1, cD);
  const deadlineMs = Date.UTC(dY, dM - 1, dD);

  return Math.round((completionMs - deadlineMs) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Main Scoring Function
// ---------------------------------------------------------------------------

/**
 * Calculates the gamification score for a completed task.
 *
 * @param baseMatrixType  — Value Matrix quadrant (impact x effort)
 * @param deadlineTime    — Task deadline as ISO 8601 string (e.g. "2026-03-28T23:59:59-05:00")
 * @param completionTime  — Actual completion as ISO 8601 string
 * @returns TaskScoreResult — pure data, no side effects
 */
export function calculateTaskScore(
  baseMatrixType: ValueMatrixType,
  deadlineTime: string,
  completionTime: string,
): TaskScoreResult {
  const basePoints = BASE_POINTS[baseMatrixType];
  const daysDiff = cotCalendarDaysDiff(completionTime, deadlineTime);

  const completionCotDate = toCotDate(completionTime);
  const deadlineCotDate = toCotDate(deadlineTime);
  const wasEarly = daysDiff < 0;
  const isOnTime = daysDiff === 0;
  const calendarDaysLate = daysDiff > 0 ? daysDiff : 0;

  const modifiers: AppliedModifier[] = [];
  let effectiveMultiplier = 1.0;

  // --- Early delivery bonus ---
  if (wasEarly) {
    effectiveMultiplier += EARLY_DELIVERY_MULTIPLIER;
    modifiers.push({
      type: 'early_delivery',
      multiplierDelta: EARLY_DELIVERY_MULTIPLIER,
      reason: `Entrega anticipada (${Math.abs(daysDiff)} dia(s) antes) → +${EARLY_DELIVERY_MULTIPLIER * 100}%`,
    });
  } else if (isOnTime) {
    // On-time — no bonus, no penalty
    modifiers.push({
      type: 'none',
      multiplierDelta: 0,
      reason: 'Entrega a tiempo → sin modificador',
    });
  }

  // --- Late penalty ---
  if (calendarDaysLate > 0) {
    const rawPenalty = LATE_PENALTY_PER_DAY * calendarDaysLate;
    // Cap: never go below MIN_SCORE_RATIO of base
    const cappedMultiplier = Math.max(1.0 - rawPenalty, MIN_SCORE_RATIO);
    const appliedPenalty = 1.0 - cappedMultiplier;

    effectiveMultiplier = cappedMultiplier;
    modifiers.push({
      type: 'late_penalty',
      multiplierDelta: -appliedPenalty,
      reason: `Entrega tardia (${calendarDaysLate} dia(s) tarde) → -${Math.round(appliedPenalty * 100)}% (minimo ${MIN_SCORE_RATIO * 100}% del base)`,
    });
  }

  // --- No modifiers case (should not happen, but guard) ---
  if (modifiers.length === 0) {
    modifiers.push({
      type: 'none',
      multiplierDelta: 0,
      reason: 'Sin modificador aplicado',
    });
  }

  const finalScore = Math.round(basePoints * effectiveMultiplier);

  return {
    basePoints,
    matrixType: baseMatrixType,
    finalScore,
    appliedModifiers: modifiers,
    cotCalculationLog: {
      deadlineCotDate,
      completionCotDate,
      calendarDaysLate,
      wasEarly,
    },
  };
}

// ---------------------------------------------------------------------------
// Utility: Resolve matrix type from task fields
// ---------------------------------------------------------------------------

/** Effort threshold in minutes — matches `src/lib/performance/metrics.ts` */
const EFFORT_THRESHOLD_MINUTES = 120;

/**
 * Derives the Value Matrix quadrant from a task's `impact` field and
 * actual/estimated effort in minutes. Convenience for call sites that
 * have raw task data instead of a pre-resolved matrix type.
 *
 * `impact: 'medium'` counts as high impact (matches existing performance metrics logic).
 */
export function resolveMatrixType(
  impact: 'high' | 'medium' | 'low',
  effortMinutes: number,
): ValueMatrixType {
  const highImpact = impact === 'high' || impact === 'medium';
  const highEffort = effortMinutes >= EFFORT_THRESHOLD_MINUTES;

  if (highImpact && highEffort) return 'high_impact_high_effort';
  if (highImpact && !highEffort) return 'high_impact_low_effort';
  if (!highImpact && highEffort) return 'low_impact_high_effort';
  return 'low_impact_low_effort';
}
