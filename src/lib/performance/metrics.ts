import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Task, User, MemberMetrics, WeeklyDataPoint } from '@/lib/types';
import { getTodayColombia, toColombiaDate } from '@/lib/tasks';

type TypedClient = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Filters interface
// ---------------------------------------------------------------------------

export interface MetricsFilters {
  categoryId?: string;
  taskType?: string;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Colombia-aware boundary helpers
// All date boundaries use America/Bogota so results are identical on dev
// (local tz = COT) and on Vercel (local tz = UTC).
// ---------------------------------------------------------------------------

/** Parse a YYYY-MM-DD string into Colombia midnight → ISO string. */
function colombiaStartOfDay(dateStr: string): string {
  // Colombia is UTC-5 year-round (no DST).
  return `${dateStr}T05:00:00.000Z`; // 00:00 COT = 05:00 UTC
}

/** Parse a YYYY-MM-DD string into Colombia 23:59:59.999 → ISO string. */
function colombiaEndOfDay(dateStr: string): string {
  // 23:59:59.999 COT = next day 04:59:59.999 UTC
  return `${nextDay(dateStr)}T04:59:59.999Z`;
}

/** Helper: advance a YYYY-MM-DD by 1 day. */
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z'); // noon UTC to avoid DST edge
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().substring(0, 10);
}

/** Helper: subtract days from a YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

export function getDayRange(): { from: string; to: string } {
  const today = getTodayColombia();
  return {
    from: colombiaStartOfDay(today),
    to: colombiaEndOfDay(today),
  };
}

export function getWeekRange(): { from: string; to: string } {
  const today = getTodayColombia();
  // Day of week in Colombia (0=Sun..6=Sat)
  const d = new Date(today + 'T12:00:00Z');
  const dow = d.getUTCDay(); // safe: noon UTC on a COT date is still same day
  const diff = dow === 0 ? 6 : dow - 1; // Monday = start
  const monday = addDays(today, -diff);
  const sunday = addDays(monday, 6);
  return {
    from: colombiaStartOfDay(monday),
    to: colombiaEndOfDay(sunday),
  };
}

export function getMonthRange(): { from: string; to: string } {
  const today = getTodayColombia();
  const [y, m] = today.split('-').map(Number);
  const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
  // Last day: day 0 of next month
  const lastDayDate = new Date(Date.UTC(y, m, 0)); // month is 0-based+1 = next, day 0 = last of current
  const lastDay = lastDayDate.toISOString().substring(0, 10);
  return {
    from: colombiaStartOfDay(firstDay),
    to: colombiaEndOfDay(lastDay),
  };
}

export function getDateRange(range: string, from?: string, to?: string): { from: string; to: string } {
  if (range === 'day') return getDayRange();
  if (range === 'week') return getWeekRange();
  if (range === 'month') return getMonthRange();
  if (range === 'custom' && from && to) {
    // Client may send full ISO strings or YYYY-MM-DD.
    // Extract Colombia date from whatever format arrives, then build COT boundaries.
    const fromDay = from.length > 10 ? toColombiaDate(from) : from.substring(0, 10);
    const toDay = to.length > 10 ? toColombiaDate(to) : to.substring(0, 10);
    // Validate
    if (isNaN(new Date(fromDay + 'T12:00:00Z').getTime()) || isNaN(new Date(toDay + 'T12:00:00Z').getTime())) {
      return getWeekRange();
    }
    return {
      from: colombiaStartOfDay(fromDay),
      to: colombiaEndOfDay(toDay),
    };
  }
  return getWeekRange();
}

// ---------------------------------------------------------------------------
// Calculate streak — consecutive business days with 100% completion
// ---------------------------------------------------------------------------

async function calculateStreak(
  supabase: TypedClient,
  userId: string
): Promise<number> {
  // Get tasks from last 90 days to compute streak
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: tasks } = await supabase
    .from('tasks')
    .select('status, due_date, completed_at, assigned_to, created_at')
    .eq('assigned_to', userId)
    .is('parent_task_id', null)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false }) as { data: Pick<Task, 'status' | 'due_date' | 'completed_at' | 'assigned_to' | 'created_at'>[] | null };

  if (!tasks || tasks.length === 0) return 0;

  // SECURITY: Defense-in-depth — discard any task not assigned to this user.
  // Admin/CEO RLS exposes all tasks; PostgREST .eq() should filter, but we
  // enforce here to guarantee strict isolation regardless of role.
  const ownTasks = tasks.filter(t => t.assigned_to === userId);
  if (ownTasks.length === 0) return 0;

  // Group tasks by day (using created_at date) — blocked tasks are frozen (excluded)
  const dayMap = new Map<string, { total: number; completed: number }>();
  for (const t of ownTasks) {
    if (t.status === 'blocked') continue; // frozen — don't break streak
    const day = toColombiaDate(t.created_at);
    const entry = dayMap.get(day) ?? { total: 0, completed: 0 };
    entry.total++;
    if (t.status === 'completed') entry.completed++;
    dayMap.set(day, entry);
  }

  // Walk backwards from today (Colombia) — only count business days (Mon-Fri)
  let streak = 0;
  const todayCol = getTodayColombia();
  const current = new Date(todayCol + 'T12:00:00Z'); // noon UTC to stay on same COT day
  for (let i = 0; i < 90; i++) {
    const dayOfWeek = current.getUTCDay(); // safe: noon UTC on COT date
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setUTCDate(current.getUTCDate() - 1);
      continue;
    }
    const dayStr = current.toISOString().substring(0, 10); // YYYY-MM-DD from noon UTC = COT date
    const entry = dayMap.get(dayStr);
    if (!entry) {
      // No tasks that business day — skip (don't break streak for off days)
      current.setUTCDate(current.getUTCDate() - 1);
      continue;
    }
    if (entry.completed === entry.total) {
      streak++;
    } else {
      break;
    }
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return streak;
}

// ---------------------------------------------------------------------------
// Calculate weekly data points for charts
// ---------------------------------------------------------------------------

/**
 * Build Burn-Up chart data points.
 *
 * Scope line  = cumulative count of tasks whose due_date <= day X.
 *               Tasks without due_date fall back to created_at.
 *               Tasks with due_date BEFORE the chart range are included
 *               in the base value of the first day ("historical drag").
 * Completed   = cumulative count of tasks whose completed_at <= day X.
 * % Cumplimiento = (cumulative_completed / scope) * 100 per day.
 *
 * Future days (> today) hold flat at today's values — no projection.
 */
function buildWeeklyData(
  allUserTasks: Task[],
  timeboxedTasks: Task[],
  from: string,
  to: string,
): WeeklyDataPoint[] {
  const points: WeeklyDataPoint[] = [];
  const total = timeboxedTasks.length;
  const todayStr = getTodayColombia();

  // Resolve each task's "scope date" = due_date (truncated to YYYY-MM-DD),
  // falling back to created_at (Colombia date) if no due_date.
  const scopeDate = (t: Task): string => {
    if (t.due_date) return t.due_date.substring(0, 10); // DATE column — safe
    return toColombiaDate(t.created_at); // timestamptz → Colombia date
  };

  // Iterate day-by-day using YYYY-MM-DD strings in Colombia timezone.
  // The from/to are Colombia-aware ISO strings, so extract their COT date.
  const startDay = toColombiaDate(from);
  const endDay = toColombiaDate(to);
  let lastScope = 0;
  let lastCompleted = 0;

  const cursor = new Date(startDay + 'T12:00:00Z'); // noon UTC = same COT day
  const endCursor = new Date(endDay + 'T12:00:00Z');
  while (cursor <= endCursor) {
    const dayStr = cursor.toISOString().substring(0, 10); // noon UTC → COT date
    const isFuture = dayStr > todayStr;

    if (!isFuture) {
      // Scope: tasks whose due_date (or created_at fallback) <= this day
      lastScope = allUserTasks.filter(t => scopeDate(t) <= dayStr).length;

      // Completions: tasks completed on or before this day (Colombia date)
      lastCompleted = allUserTasks.filter(t =>
        t.status === 'completed' && t.completed_at && toColombiaDate(t.completed_at) <= dayStr
      ).length;
    }
    // Future days: hold flat at today's values

    // Daily completion_pct based on scope (not static total)
    const dailyPct = lastScope > 0 ? Math.round((lastCompleted / lastScope) * 100) : 0;

    points.push({
      date: dayStr,
      completed: lastCompleted,
      assigned: total,
      completion_pct: dailyPct,
      scope: lastScope,
      cumulative_completed: lastCompleted,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

// ---------------------------------------------------------------------------
// Calculate average speed (hours from creation/assignment to completion)
// ---------------------------------------------------------------------------

function calculateAvgSpeed(tasks: Task[]): number | null {
  const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at);
  if (completedTasks.length === 0) return null;

  let totalHours = 0;
  for (const t of completedTasks) {
    const created = new Date(t.created_at).getTime();
    const completed = new Date(t.completed_at!).getTime();
    totalHours += (completed - created) / (1000 * 60 * 60);
  }

  return Math.round((totalHours / completedTasks.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Fetch block reasons for blocked tasks (latest comment per task)
// ---------------------------------------------------------------------------

async function fetchBlockReasons(
  supabase: TypedClient,
  blockedTaskIds: string[]
): Promise<Record<string, string>> {
  const reasons: Record<string, string> = {};
  if (blockedTaskIds.length === 0) return reasons;

  const { data: comments } = await supabase
    .from('task_comments')
    .select('task_id, content')
    .in('task_id', blockedTaskIds)
    .order('created_at', { ascending: false }) as {
    data: { task_id: string; content: string }[] | null;
  };

  if (comments) {
    for (const c of comments) {
      if (!reasons[c.task_id]) {
        reasons[c.task_id] = c.content;
      }
    }
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Main: calculate metrics for a single user
// ---------------------------------------------------------------------------

export async function calculateMemberMetrics(
  supabase: TypedClient,
  user: User,
  from: string,
  to: string,
  filters?: MetricsFilters
): Promise<MemberMetrics> {
  // Fetch tasks for this user — date filtering uses hybrid logic in JS.
  // Explicit column list: avoids pulling description, attachments (heavy JSONB).
  const TASK_METRICS_COLS = 'id, title, status, priority, due_date, completed_at, created_at, updated_at, time_spent, estimated_time, task_type, impact, block_type, block_reason, assigned_to, category_id, parent_task_id' as const;

  let query = supabase
    .from('tasks')
    .select(TASK_METRICS_COLS)
    .eq('assigned_to', user.id)
    .is('parent_task_id', null);

  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters?.taskType) {
    query = query.eq('task_type', filters.taskType as 'planeada' | 'incendio');
  }

  const { data: tasks } = (await query.order('created_at', { ascending: false })) as {
    data: Task[] | null;
  };

  console.log(`[metrics-raw] user=${user.name} tareas_crudas_DB=${tasks?.length ?? 0}`);

  // SECURITY: Defense-in-depth — discard tasks not assigned to target user.
  const ownTasks = (tasks ?? []).filter(t => t.assigned_to === user.id);

  // ---------------------------------------------------------------------------
  // Strict Timeboxing filter:
  //   Completed → only if completed_at in [from, to]
  //   Non-completed → only if due_date in [FROM, TO] (strict range, no backlog).
  //                    If no due_date, fall back to created_at in [FROM, TO].
  // due_date is DATE (no TZ) → compare YYYY-MM-DD strings.
  // ---------------------------------------------------------------------------
  // All date logic uses Colombia timezone (America/Bogota = UTC-5, no DST).
  // `from` and `to` are now Colombia-aware ISO boundaries from getDateRange().
  const todayStr = getTodayColombia();
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  // Extract Colombia YYYY-MM-DD from ISO boundaries for DATE column comparisons.
  const fromDay = toColombiaDate(from);
  const toDay = toColombiaDate(to);

  // Normalize due_date: Supabase may return "YYYY-MM-DDT00:00:00+00:00" for date columns.
  // Extract only YYYY-MM-DD for safe string comparison.
  const dueDay = (d: string | null) => d ? d.substring(0, 10) : null;

  const allTasks = ownTasks.filter(t => {
    if (t.status === 'completed') {
      if (!t.completed_at) return false;
      const completedMs = new Date(t.completed_at).getTime();
      return completedMs >= fromMs && completedMs <= toMs;
    }
    // Non-completed: strict timebox — due_date must be within [FROM, TO].
    // If no due_date, fall back to created_at (Colombia date) within [FROM, TO].
    const dd = dueDay(t.due_date);
    if (dd) {
      return dd >= fromDay && dd <= toDay;
    }
    const cd = toColombiaDate(t.created_at);
    return cd >= fromDay && cd <= toDay;
  });

  // DEBUG: log boundaries + excluded completed tasks
  console.log(
    `[metrics] user=${user.name} from=${from} to=${to} fromMs=${fromMs} toMs=${toMs}`,
    `fromDay=${fromDay} toDay=${toDay} today=${todayStr}`,
    `supabase=${ownTasks.length} → visible=${allTasks.length}`
  );
  const excludedCompleted = ownTasks.filter(t => t.status === 'completed' && t.completed_at && !allTasks.includes(t));
  if (excludedCompleted.length > 0) {
    excludedCompleted.forEach(t => {
      const ms = new Date(t.completed_at!).getTime();
      console.log(`[metrics-EXCLUDED] "${t.title}" completed_at=${t.completed_at} colDate=${toColombiaDate(t.completed_at!)} ms=${ms} inRange=${ms >= fromMs && ms <= toMs} from=${fromMs} to=${toMs}`);
    });
  }

  // Blocked tasks are "frozen" — don't count towards overdue or penalize completion
  const activeTasks = allTasks.filter(t => t.status !== 'blocked');
  const completed = allTasks.filter(t => t.status === 'completed');
  const pending = allTasks.filter(t => t.status === 'pending');
  const inProgress = allTasks.filter(t => t.status === 'in_progress');
  const blocked = allTasks.filter(t => t.status === 'blocked');
  const overdue = activeTasks.filter(t =>
    t.status !== 'completed' && t.due_date != null && dueDay(t.due_date)! < todayStr
  );
  // completedOnTime: compare Colombia dates (not UTC substrings)
  const completedOnTime = completed.filter(t =>
    !t.due_date || (t.completed_at && toColombiaDate(t.completed_at) <= dueDay(t.due_date)!)
  );
  const completedToday = completed.filter(t =>
    t.completed_at && toColombiaDate(t.completed_at) === todayStr
  );

  // Check if user has any activity today
  const updatedToday = allTasks.some(t =>
    toColombiaDate(t.updated_at) === todayStr
  );

  const streak = await calculateStreak(supabase, user.id);
  const avgSpeed = calculateAvgSpeed(completed);
  const weeklyData = buildWeeklyData(ownTasks, allTasks, from, to);

  // Fetch block reasons for blocked tasks
  const blockedIds = blocked.map(t => t.id);
  const blockReasons = await fetchBlockReasons(supabase, blockedIds);

  // Block audit: internal vs external
  const blockAudit = { internal: 0, external: 0 };
  for (const t of blocked) {
    if (t.block_type === 'internal') blockAudit.internal++;
    else if (t.block_type === 'external') blockAudit.external++;
  }

  // Impact distribution
  const impactDist = { high: 0, medium: 0, low: 0 };
  for (const t of allTasks) {
    if (t.impact === 'high') impactDist.high++;
    else if (t.impact === 'medium') impactDist.medium++;
    else if (t.impact === 'low') impactDist.low++;
  }

  // Avg lead time (completed_at - created_at) in hours
  const avgLeadTime = calculateAvgSpeed(completed);

  // ---------------------------------------------------------------------------
  // Coaching metrics
  // ---------------------------------------------------------------------------

  // 1. Avg Estimation Gap: ((time_spent - estimated_time) / estimated_time) * 100
  //    Only count completed tasks that have BOTH values and estimated_time > 0.
  const estimable = completed.filter(
    t => t.estimated_time != null && t.estimated_time > 0 && t.time_spent != null
  );
  const avgEstimationGap = estimable.length > 0
    ? Math.round(
        estimable.reduce((sum, t) => {
          const gap = ((t.time_spent! - t.estimated_time!) / t.estimated_time!) * 100;
          return sum + gap;
        }, 0) / estimable.length
      )
    : null;

  // 2. Fire Ratio: % of completed tasks that are "incendio"
  const fireRatio = completed.length > 0
    ? Math.round(
        (completed.filter(t => t.task_type === 'incendio').length / completed.length) * 100
      )
    : null;

  // 3. Value Matrix: classify completed tasks by impact × effort
  //    effort threshold = 120 min (2 hrs). Impact: high/medium = "alto", low = "bajo".
  const EFFORT_THRESHOLD = 120; // minutes
  const valueMatrix = { key_projects: 0, quick_wins: 0, maintenance: 0, time_sinks: 0 };
  for (const t of completed) {
    const highImpact = t.impact === 'high' || t.impact === 'medium';
    const highEffort = (t.time_spent ?? t.estimated_time ?? 0) >= EFFORT_THRESHOLD;
    if (highImpact && highEffort) valueMatrix.key_projects++;
    else if (highImpact && !highEffort) valueMatrix.quick_wins++;
    else if (!highImpact && !highEffort) valueMatrix.maintenance++;
    else valueMatrix.time_sinks++;
  }

  return {
    user_id: user.id,
    user,
    period: { from, to },
    tasks_total: allTasks.length,
    tasks_completed: completed.length,
    tasks_completed_on_time: completedOnTime.length,
    tasks_pending: pending.length,
    tasks_overdue: overdue.length,
    tasks_in_progress: inProgress.length,
    tasks_blocked: blocked.length,
    completion_pct: activeTasks.length > 0 ? Math.round((completed.length / activeTasks.length) * 100) : 0,
    avg_speed_hours: avgSpeed,
    streak,
    tasks_completed_today: completedToday.length,
    updated_today: updatedToday,
    weekly_data: weeklyData,
    tasks_list: allTasks,
    block_reasons: blockReasons,
    block_audit: blockAudit,
    impact_distribution: impactDist,
    avg_lead_time_hours: avgLeadTime,
    avg_estimation_gap: avgEstimationGap,
    fire_ratio: fireRatio,
    value_matrix: valueMatrix,
  };
}

// ---------------------------------------------------------------------------
// Calculate metrics for ALL members (admin use)
// ---------------------------------------------------------------------------

export async function calculateAllMembersMetrics(
  supabase: TypedClient,
  from: string,
  to: string,
  filters?: MetricsFilters,
  userIds?: string[]
): Promise<MemberMetrics[]> {
  let usersQuery = supabase.from('users').select('*').eq('is_active', true);
  if (userIds && userIds.length > 0) {
    usersQuery = usersQuery.in('id', userIds);
  }
  const { data: users } = await usersQuery.order('name') as { data: User[] | null };

  if (!users || users.length === 0) return [];

  const results = await Promise.all(
    users.map(user => calculateMemberMetrics(supabase, user, from, to, filters))
  );

  return results;
}
