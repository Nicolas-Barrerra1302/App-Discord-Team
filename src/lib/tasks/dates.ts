import type { TaskRecurrence, RecurrenceFrequency } from '@/lib/types';

// =============================================================================
// Colombia Timezone Helpers
// All date logic uses America/Bogota so it works correctly on Vercel (UTC).
// =============================================================================

/** Returns today's date as YYYY-MM-DD in Colombia timezone. */
export function getTodayColombia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** Converts any timestamp/Date to YYYY-MM-DD in Colombia timezone.
 *  Use instead of `.substring(0, 10)` on timestamps to avoid UTC date extraction. */
export function toColombiaDate(timestamp: string | Date): string {
  return new Date(timestamp).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Returns the UTC ISO string for the START of a Colombia day.
 * Colombia is UTC-5 (no DST), so midnight COT = 05:00:00Z.
 * @param date YYYY-MM-DD in Colombia timezone (defaults to today)
 */
export function colombiaStartOfDay(date?: string): string {
  const d = date ?? getTodayColombia();
  return `${d}T05:00:00.000Z`;
}

/**
 * Returns the UTC ISO string for the END of a Colombia day.
 * Colombia is UTC-5 (no DST), so 23:59:59.999 COT = next day 04:59:59.999Z.
 * @param date YYYY-MM-DD in Colombia timezone (defaults to today)
 */
export function colombiaEndOfDay(date?: string): string {
  const d = date ?? getTodayColombia();
  // Advance the start-of-day UTC by 24 hours, then step back 1ms
  const startUtc = new Date(`${d}T05:00:00.000Z`);
  startUtc.setUTCDate(startUtc.getUTCDate() + 1);
  return new Date(startUtc.getTime() - 1).toISOString();
}

/** Returns the current day of week (0=Sunday..6=Saturday) in Colombia timezone. */
export function getDayOfWeekColombia(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[weekday] ?? 0;
}

/** Returns the current day of month (1-31) in Colombia timezone. */
export function getDayOfMonthColombia(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    day: 'numeric',
  }).formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === 'day')?.value ?? '1', 10);
}

// =============================================================================
// Schedule Matching (used by cron)
// =============================================================================

/** Check if today (COT) matches a recurrence's schedule. */
export function matchesSchedule(
  recurrence: TaskRecurrence,
  todayDow: number,
  todayDom: number,
  todayStr: string
): boolean {
  switch (recurrence.frequency) {
    case 'daily':
      return true;

    case 'weekly':
      return recurrence.days_of_week.includes(todayDow);

    case 'biweekly': {
      if (!recurrence.days_of_week.includes(todayDow)) return false;
      if (!recurrence.next_due_date) return true;
      const nextDue = new Date(recurrence.next_due_date + 'T00:00:00Z');
      const today = new Date(todayStr + 'T00:00:00Z');
      return today >= nextDue;
    }

    case 'monthly': {
      if (!recurrence.next_due_date) return true;
      const originalDom = new Date(recurrence.next_due_date + 'T00:00:00Z').getUTCDate();
      const todayDate = new Date(todayStr + 'T00:00:00Z');
      const lastDayOfMonth = new Date(
        Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1, 0)
      ).getUTCDate();
      const effectiveDom = Math.min(originalDom, lastDayOfMonth);
      return todayDom === effectiveDom;
    }

    case 'custom':
      return recurrence.days_of_week.includes(todayDow);

    default:
      return false;
  }
}

// =============================================================================
// Calculate Next Due Date (used by cron after generating a task)
// =============================================================================

/** Given a recurrence and today's date string, compute the next due date. */
export function calculateNextDueDate(
  recurrence: TaskRecurrence,
  todayStr: string
): string | null {
  const today = new Date(todayStr + 'T00:00:00Z');

  switch (recurrence.frequency) {
    case 'daily': {
      const next = new Date(today);
      next.setUTCDate(next.getUTCDate() + 1);
      return next.toISOString().slice(0, 10);
    }

    case 'weekly':
    case 'custom': {
      return findNextDayInWeek(recurrence.days_of_week, today, 0);
    }

    case 'biweekly': {
      const nextThisWeek = findNextDayInWeek(recurrence.days_of_week, today, 0);
      if (nextThisWeek) {
        const nextDate = new Date(nextThisWeek + 'T00:00:00Z');
        const diffDays = (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) {
          const todayDow = today.getUTCDay();
          const remainingDays = recurrence.days_of_week.filter((d) => d > todayDow);
          if (remainingDays.length > 0) {
            return nextThisWeek;
          }
          const twoWeeksLater = new Date(today);
          twoWeeksLater.setUTCDate(twoWeeksLater.getUTCDate() + 14);
          return findNextDayInWeek(recurrence.days_of_week, twoWeeksLater, -7);
        }
        return nextThisWeek;
      }
      return null;
    }

    case 'monthly': {
      const targetDom = recurrence.next_due_date
        ? new Date(recurrence.next_due_date + 'T00:00:00Z').getUTCDate()
        : today.getUTCDate();

      const nextMonth = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() + 1,
        1
      ));
      const lastDayNextMonth = new Date(Date.UTC(
        nextMonth.getUTCFullYear(),
        nextMonth.getUTCMonth() + 1,
        0
      )).getUTCDate();
      const effectiveDay = Math.min(targetDom, lastDayNextMonth);
      const result = new Date(Date.UTC(
        nextMonth.getUTCFullYear(),
        nextMonth.getUTCMonth(),
        effectiveDay
      ));
      return result.toISOString().slice(0, 10);
    }

    default:
      return null;
  }
}

// =============================================================================
// Calculate Initial Next Due Date (used when creating a new recurrence template)
// Uses COT timezone for "today" reference.
// =============================================================================

export function calculateInitialNextDueDate(
  frequency: RecurrenceFrequency,
  daysOfWeek: number[]
): string {
  const todayStr = getTodayColombia();
  const today = new Date(todayStr + 'T00:00:00Z');

  switch (frequency) {
    case 'daily': {
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return tomorrow.toISOString().slice(0, 10);
    }
    case 'weekly':
    case 'biweekly':
    case 'custom': {
      if (daysOfWeek.length === 0) {
        const next = new Date(today);
        next.setUTCDate(next.getUTCDate() + 7);
        return next.toISOString().slice(0, 10);
      }
      const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
      const currentDay = today.getUTCDay();

      const nextDay = sortedDays.find((d) => d > currentDay);
      if (nextDay !== undefined) {
        const next = new Date(today);
        next.setUTCDate(next.getUTCDate() + (nextDay - currentDay));
        return next.toISOString().slice(0, 10);
      }

      const firstDay = sortedDays[0];
      const daysUntil = 7 - currentDay + firstDay;
      const next = new Date(today);
      next.setUTCDate(next.getUTCDate() + daysUntil);

      if (frequency === 'biweekly') {
        next.setUTCDate(next.getUTCDate() + 7);
      }
      return next.toISOString().slice(0, 10);
    }
    case 'monthly': {
      const nextMonth = new Date(today);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      return nextMonth.toISOString().slice(0, 10);
    }
    default: {
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return tomorrow.toISOString().slice(0, 10);
    }
  }
}

// =============================================================================
// Internal helper
// =============================================================================

function findNextDayInWeek(
  daysOfWeek: number[],
  referenceDate: Date,
  offsetDays: number
): string | null {
  if (daysOfWeek.length === 0) return null;

  const refDow = referenceDate.getUTCDay();
  const sorted = [...daysOfWeek].sort((a, b) => a - b);

  for (const day of sorted) {
    if (day > refDow) {
      const diff = day - refDow + offsetDays;
      const next = new Date(referenceDate);
      next.setUTCDate(next.getUTCDate() + diff);
      return next.toISOString().slice(0, 10);
    }
  }

  const diff = 7 - refDow + sorted[0] + offsetDays;
  const next = new Date(referenceDate);
  next.setUTCDate(next.getUTCDate() + diff);
  return next.toISOString().slice(0, 10);
}
