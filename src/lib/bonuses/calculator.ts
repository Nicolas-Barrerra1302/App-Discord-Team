// =============================================================================
// Bonus Calculator — Pure Math Engine
// ZERO side effects: no Supabase, no fetch, no DOM.
// Importable from both server and client components.
// =============================================================================

import { BONUS_MIN_PCT, BONUS_MAX_PCT } from '@/lib/constants';
import type {
  BonusMemberInput,
  BonusCalculationResult,
  BonusSimulationOutput,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base weight every member starts with before adding points */
const BASE_WEIGHT = 10;

// ---------------------------------------------------------------------------
// Main Calculator
// ---------------------------------------------------------------------------

/** Safety limit to prevent infinite redistribution loops */
const MAX_REDISTRIBUTION_ITERATIONS = 50;

/**
 * Calculates the bonus distribution for all members based on revenue,
 * margin, pool percentage, and individual point totals.
 *
 * Uses an iterative redistribution algorithm:
 *  1. NetProfit = revenue * (marginPct / 100)
 *  2. TotalPool = netProfit * (poolPct / 100)
 *  3. Each member's weight = BASE_WEIGHT + member.points
 *  4. Raw bonus = (memberWeight / totalWeight) * totalPool
 *  5. Iteratively clamp members at floor/ceiling and redistribute the
 *     net surplus among unclamped members proportionally by weight,
 *     repeating until no surplus remains or all members are clamped.
 *  6. Pool percentage = (simulatedBonus / totalPool) * 100
 *
 * @param revenue    - Gross revenue in USD
 * @param marginPct  - Net margin as a percentage (e.g. 40 means 40%)
 * @param poolPct    - Pool percentage of net profit (e.g. 7 means 7%)
 * @param members    - Array of team members with their accumulated points
 * @returns Full simulation output with per-member results
 */
export function calculateBonuses(
  revenue: number,
  marginPct: number,
  poolPct: number,
  members: BonusMemberInput[],
): BonusSimulationOutput {
  // --- Edge case: empty members ---
  if (members.length === 0) {
    return {
      revenue,
      marginPct,
      poolPct,
      netProfit: 0,
      totalPool: 0,
      results: [],
    };
  }

  // --- Core calculations ---
  const netProfit = revenue * (marginPct / 100);
  const totalPool = netProfit * (poolPct / 100);

  // --- Edge case: any input is zero → everything zeroes out ---
  if (revenue === 0 || marginPct === 0 || poolPct === 0) {
    const zeroResults: BonusCalculationResult[] = members.map((m) => ({
      userId: m.userId,
      weight: BASE_WEIGHT + m.points,
      rawBonus: 0,
      simulatedBonus: 0,
      poolPercentage: 0,
      isClamped: false as const,
    }));

    return {
      revenue,
      marginPct,
      poolPct,
      netProfit,
      totalPool,
      results: zeroResults,
    };
  }

  // --- Weights ---
  // Clamp individual weights to 0 to prevent negative weights from extreme
  // negative points (e.g. -100), and ensure totalWeight is never <= 0 to
  // prevent division-by-zero in the allocation step.
  const memberWeights = members.map((m) => Math.max(0, BASE_WEIGHT + m.points));
  const totalWeight = Math.max(0.1, memberWeights.reduce((sum, w) => sum + w, 0));

  // --- Clamp boundaries ---
  const floor = netProfit * (BONUS_MIN_PCT / 100);
  const ceiling = netProfit * (BONUS_MAX_PCT / 100);

  // --- Initial raw allocation ---
  const rawBonuses = memberWeights.map((weight) =>
    totalWeight > 0 ? (weight / totalWeight) * totalPool : 0,
  );

  // Working copy that gets adjusted through redistribution iterations
  const simulatedBonuses = [...rawBonuses];

  // Track clamp status: false = unclamped, 'min' = floored, 'max' = capped
  const clampStatus: (false | 'min' | 'max')[] = members.map(() => false);

  // --- Iterative redistribution loop ---
  for (let iteration = 0; iteration < MAX_REDISTRIBUTION_ITERATIONS; iteration++) {
    let surplusFromCeiling = 0;
    let deficitFromFloor = 0;

    // (a) Identify who NEWLY hits floor/ceiling among still-unclamped members
    for (let i = 0; i < members.length; i++) {
      if (clampStatus[i] !== false) continue; // already clamped — skip

      if (simulatedBonuses[i] < floor) {
        deficitFromFloor += floor - simulatedBonuses[i];
        simulatedBonuses[i] = floor;
        clampStatus[i] = 'min';
      } else if (simulatedBonuses[i] > ceiling) {
        surplusFromCeiling += simulatedBonuses[i] - ceiling;
        simulatedBonuses[i] = ceiling;
        clampStatus[i] = 'max';
      }
    }

    // (b) Net surplus available for redistribution
    const netSurplus = surplusFromCeiling - deficitFromFloor;

    // (c) Find unclamped members
    const unclampedIndices: number[] = [];
    for (let i = 0; i < members.length; i++) {
      if (clampStatus[i] === false) unclampedIndices.push(i);
    }

    // (d) Exit conditions
    if (netSurplus <= 0.01 || unclampedIndices.length === 0) break;

    // (e) Redistribute net surplus proportionally by weight among unclamped members
    const unclampedTotalWeight = unclampedIndices.reduce(
      (sum, idx) => sum + memberWeights[idx],
      0,
    );

    for (const idx of unclampedIndices) {
      simulatedBonuses[idx] +=
        (memberWeights[idx] / unclampedTotalWeight) * netSurplus;
    }

    // (f) Loop back to re-check if redistribution pushed anyone over ceiling
  }

  // --- Build final results ---
  const results: BonusCalculationResult[] = members.map((member, i) => {
    const finalBonus = round2(simulatedBonuses[i]);

    const poolPercentage = totalPool > 0
      ? round2((finalBonus / totalPool) * 100)
      : 0;

    return {
      userId: member.userId,
      weight: memberWeights[i],
      rawBonus: round2(rawBonuses[i]),
      simulatedBonus: finalBonus,
      poolPercentage,
      isClamped: clampStatus[i],
    };
  });

  return {
    revenue,
    marginPct,
    poolPct,
    netProfit,
    totalPool,
    results,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rounds a number to 2 decimal places using standard rounding.
 * Guarantees no NaN or Infinity — returns 0 for non-finite inputs.
 */
function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Formats a numeric amount as USD currency using Colombian locale.
 *
 * @param amount - The numeric value to format
 * @returns Formatted string (e.g. "US$373")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
