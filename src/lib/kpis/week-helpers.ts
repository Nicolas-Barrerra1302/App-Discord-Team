// =============================================================================
// KPI Week Helpers — Colombia Timezone (UTC-5, no DST)
// All week boundaries use America/Bogota to match existing date utilities.
// Week definition: Monday 00:00:00 COT → Sunday 23:59:59.999 COT
// =============================================================================

import { getTodayColombia } from '@/lib/tasks/dates';

/** Advance a YYYY-MM-DD string by N days (UTC-safe via noon anchor). */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

/**
 * Returns Monday of the current COT week as YYYY-MM-DD.
 * Mirrors getWeekRange() logic from src/lib/performance/metrics.ts.
 */
export function getCurrentWeekStart(): string {
  const today = getTodayColombia();
  const d = new Date(today + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = dow === 0 ? 6 : dow - 1; // days back to Monday
  return addDays(today, -diff);
}

/**
 * Returns Sunday of the given week (weekStart must be a Monday).
 */
export function getWeekEnd(weekStart: string): string {
  return addDays(weekStart, 6);
}

/**
 * Returns the strict deadline for a KPI week as a UTC ISO string.
 * Deadline = Sunday 23:59:59.999 COT = next Monday 04:59:59.999 UTC
 */
export function getDeadlineUtc(weekStart: string): string {
  const sunday = getWeekEnd(weekStart);
  // 23:59:59.999 COT = next day (Monday) 04:59:59.999 UTC
  const nextDay = addDays(sunday, 1);
  return `${nextDay}T04:59:59.999Z`;
}

/**
 * Returns true if the current moment is before the Sunday 11:59 PM COT deadline
 * for the given week_start (Monday date).
 */
export function isBeforeDeadline(weekStart: string): boolean {
  const deadline = getDeadlineUtc(weekStart);
  return new Date().toISOString() < deadline;
}

/**
 * Returns a human-readable week label.
 * e.g., "24 Mar – 30 Mar 2026"
 */
export function getWeekLabel(weekStart: string): string {
  const sunday = getWeekEnd(weekStart);
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00Z').toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  const [, year] = sunday.split('-');
  return `${fmt(weekStart)} – ${fmt(sunday)} ${year}`;
}

/**
 * Validates that a weekStart string is a Monday (YYYY-MM-DD).
 * Returns false for malformed or non-Monday dates.
 */
export function isValidWeekStart(weekStart: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return false;
  const d = new Date(weekStart + 'T12:00:00Z');
  if (isNaN(d.getTime())) return false;
  return d.getUTCDay() === 1; // 1 = Monday
}
