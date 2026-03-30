import type { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { getTodayColombia } from '@/lib/tasks/dates';

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface TaskFilters {
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  category_id: string | 'all';
  assigned_to: string | 'all';
  due_from: string;
  due_to: string;
}

export const DEFAULT_FILTERS: TaskFilters = {
  status: 'all',
  priority: 'all',
  category_id: 'all',
  assigned_to: 'all',
  due_from: '',
  due_to: '',
};

// ---------------------------------------------------------------------------
// Overdue check
// ---------------------------------------------------------------------------

export function isOverdue(task: Task): boolean {
  if (!task.due_date) return false;
  if (task.status === 'completed' || task.status === 'blocked') return false;
  // Compare YYYY-MM-DD strings only. Use getTodayColombia() — NOT new Date() —
  // so the comparison is correct on Vercel (UTC) and at midnight COT.
  const dueDateStr = task.due_date.substring(0, 10);
  const todayStr = getTodayColombia();
  return dueDateStr < todayStr;
}

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

export function formatDueDate(dateString: string | null): string {
  if (!dateString) return 'Sin fecha';

  // Supabase DATE columns return "YYYY-MM-DDT00:00:00+00:00".
  // new Date(dateString) interprets this as midnight UTC → shifts to previous day at UTC-5.
  // Fix: extract the YYYY-MM-DD part first, then construct a LOCAL date (no TZ shift).
  const dateStr = dateString.substring(0, 10);
  const [y, m, d] = dateStr.split('-').map(Number);
  const dueDay = new Date(y, m - 1, d);

  // Use getTodayColombia() so "today" is correct regardless of server/browser TZ.
  const todayStr = getTodayColombia();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);

  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Manana';
  if (diffDays === -1) return 'Ayer';
  if (diffDays < -1) return `Atrasada ${Math.abs(diffDays)} dias`;

  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dueDay.getDate()} ${months[dueDay.getMonth()]}`;
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 30) return `hace ${diffDays}d`;
  return formatDueDate(dateString);
}
