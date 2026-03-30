-- =============================================================================
-- Migration 014: Performance indexes for Calendar (Hito 7) readiness
-- Identified in Data Fetching Audit (2026-03-27)
-- =============================================================================

-- TASKS: assigned_to (most common filter — metrics, kanban, API tasks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_to
  ON public.tasks(assigned_to);

-- TASKS: assigned_to + status (check-in count queries, blocked/completion counts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_assigned_status
  ON public.tasks(assigned_to, status);

-- TASKS: due_date (Calendar feature, overdue checks, date range filters)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_date
  ON public.tasks(due_date)
  WHERE due_date IS NOT NULL;

-- TASKS: completed_at (timebox filter, check-in metrics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_completed_at
  ON public.tasks(completed_at)
  WHERE completed_at IS NOT NULL;

-- TASKS: created_at (streak calculation, general ordering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_created_at
  ON public.tasks(created_at);

-- TASKS: recurrence_id + created_at (CRON duplicate check — eliminates N+1)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_recurrence_created
  ON public.tasks(recurrence_id, created_at)
  WHERE recurrence_id IS NOT NULL;

-- TASKS: status (kanban board, general filters)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_status
  ON public.tasks(status);

-- TASKS: parent_task_id (subtask count queries in GET /api/tasks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_parent
  ON public.tasks(parent_task_id)
  WHERE parent_task_id IS NOT NULL;

-- ACTIVITY_LOG: user_id + created_at DESC (timeline pagination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_user_created
  ON public.activity_log(user_id, created_at DESC);

-- BONUS_EVENTS: launch_id (IN query from GET /api/bonuses)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bonus_events_launch
  ON public.bonus_events(launch_id);

-- TASK_COMMENTS: task_id + created_at DESC (block reasons fetch)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_comments_task_created
  ON public.task_comments(task_id, created_at DESC);
