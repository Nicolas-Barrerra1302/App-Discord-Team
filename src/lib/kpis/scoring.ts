// =============================================================================
// KPI Scoring Engine — Pure Math, Zero Side Effects
// Mirrors the bonus calculator pattern from src/lib/bonuses/calculator.ts
// =============================================================================

import type { KpiDefinition, KpiTracking, KpiScore, KpiScoringResult } from '@/lib/types';
import { parseDbNumeric } from '@/lib/utils';

/**
 * Calculates the points earned for a single KPI entry.
 *
 * direction = 'asc'  (default) — higher value is better:
 *   boolean:    value >= 1 → max_points, else → 0
 *   number/pct: min(value / target, 1.0) * max_points
 *
 * direction = 'desc' — lower value is better (e.g. error count, incidents):
 *   boolean:    value == 0 (No) → max_points, value >= 1 (Yes) → 0
 *   number/pct: value <= target → max_points (full score at or under threshold)
 *               value >  target → max(0, 1 - (value - target) / target) * max_points
 *                  • linear decay from max_points (at target) to 0 (at 2×target)
 *                  • target == 0: any value > 0 → 0 pts (zero-tolerance)
 *
 * Returns 0 if value is null/undefined (unfilled).
 */
export function scoreKpi(
  definition: KpiDefinition,
  tracking: KpiTracking | null | undefined
): number {
  if (!tracking || tracking.value === null || tracking.value === undefined) {
    return 0;
  }

  const value = parseDbNumeric(tracking.value);
  const target = parseDbNumeric(definition.target_value);
  const maxPts = definition.max_points;
  const direction = definition.direction ?? 'asc';

  // ── Ascending (higher is better) ────────────────────────────────────────
  if (direction === 'asc') {
    switch (definition.data_type) {
      case 'boolean':
        return value >= 1 ? maxPts : 0;

      case 'number':
      case 'percentage':
        if (target <= 0) return 0;
        return Math.min(value / target, 1.0) * maxPts;

      default:
        return 0;
    }
  }

  // ── Descending (lower is better) ────────────────────────────────────────
  switch (definition.data_type) {
    case 'boolean':
      // Boolean desc: "No" (0) is the good outcome — hitting 0 earns max_points
      return value <= 0 ? maxPts : 0;

    case 'number':
    case 'percentage': {
      // At or under target → full points (value=0 with target=2 → max_points ✓)
      if (value <= target) return maxPts;

      // Strictly above target → linear decay from max_points down to 0
      // Formula: max(0, max_points × (1 − (value − target) / target))
      // • value == target     → 1.0 × maxPts = maxPts
      // • value == 2×target   → 0.0 × maxPts = 0
      // • target == 0 (zero-tolerance): any value > 0 → 0 pts
      if (target <= 0) return 0;
      return Math.max(0, maxPts * (1 - (value - target) / target));
    }

    default:
      return 0;
  }
}

/**
 * Calculates scores for all KPI definitions against a set of tracking entries.
 * Returns per-KPI scores and the total/max aggregates.
 *
 * @param definitions - Active KPI definitions for the user/week
 * @param trackingEntries - The user's saved values for this week
 */
export function calculateKpiScores(
  definitions: KpiDefinition[],
  trackingEntries: KpiTracking[]
): KpiScoringResult {
  // Build O(1) lookup: kpi_id → tracking entry
  const trackingMap = new Map<string, KpiTracking>();
  for (const t of trackingEntries) {
    trackingMap.set(t.kpi_id, t);
  }

  const perKpi: KpiScore[] = definitions.map((def) => {
    const tracking = trackingMap.get(def.id) ?? null;
    const earned = scoreKpi(def, tracking);
    return {
      kpi_id: def.id,
      kpi_name: def.name,
      earned: Math.round(earned * 100) / 100, // 2 decimal precision
      max_points: def.max_points,
    };
  });

  const total = perKpi.reduce((sum, s) => sum + s.earned, 0);
  const maxPossible = perKpi.reduce((sum, s) => sum + s.max_points, 0);

  return {
    perKpi,
    total: Math.round(total * 100) / 100,
    maxPossible,
  };
}

/**
 * Returns the integer points to store in bonus_events.points.
 * Rounds to nearest integer (bonus system uses integers).
 */
export function toIntegerPoints(total: number): number {
  return Math.round(total);
}
