import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely converts a Postgres numeric value (returned as string by PostgREST)
 * to a JavaScript number. Returns 0 for null, undefined, or invalid values.
 */
export function parseDbNumeric(
  value: string | number | null | undefined
): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats a time_spent value (stored as minutes in DB) to a human-readable string.
 * Examples: 180 → "3h", 90 → "1h 30m", 45 → "45m", 0 → "0m"
 */
export function formatTimeSpent(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
