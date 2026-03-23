-- =============================================================================
-- Mind Fuel Team — Row Level Security Policies
-- Run AFTER schema.sql
-- =============================================================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_recurrences enable row level security;
alter table public.task_categories enable row level security;
alter table public.bonus_launches enable row level security;
alter table public.bonus_events enable row level security;
alter table public.daily_reports enable row level security;
alter table public.activity_log enable row level security;
alter table public.user_absences enable row level security;

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Returns the current authenticated user's role from public.users
create or replace function public.get_user_role()
returns text as $$
  select role from public.users
  where discord_id = (
    select raw_user_meta_data->>'provider_id'
    from auth.users
    where id = auth.uid()
  );
$$ language sql security definer stable;

-- Returns the current authenticated user's internal UUID from public.users
create or replace function public.get_user_id()
returns uuid as $$
  select id from public.users
  where discord_id = (
    select raw_user_meta_data->>'provider_id'
    from auth.users
    where id = auth.uid()
  );
$$ language sql security definer stable;

-- =============================================================================
-- USERS
-- Everyone can read (team is small, need to see names/avatars).
-- Only super_admin and ceo can update profiles.
-- =============================================================================
create policy "Users: read all"
  on public.users for select
  using (true);

create policy "Users: admin update"
  on public.users for update
  using (get_user_role() in ('super_admin', 'ceo'));

-- =============================================================================
-- TASKS
-- Members see tasks assigned to them or created by them.
-- Admins (super_admin, ceo) see all tasks.
-- =============================================================================
create policy "Tasks: read own or admin"
  on public.tasks for select
  using (
    assigned_to = get_user_id()
    or created_by = get_user_id()
    or get_user_role() in ('super_admin', 'ceo')
  );

create policy "Tasks: insert own or admin"
  on public.tasks for insert
  with check (
    assigned_to = get_user_id()
    or created_by = get_user_id()
    or get_user_role() in ('super_admin', 'ceo')
  );

create policy "Tasks: update own or admin"
  on public.tasks for update
  using (
    assigned_to = get_user_id()
    or created_by = get_user_id()
    or get_user_role() in ('super_admin', 'ceo')
  );

create policy "Tasks: delete admin only"
  on public.tasks for delete
  using (
    get_user_role() in ('super_admin', 'ceo')
  );

-- =============================================================================
-- TASK_COMMENTS
-- Readable by anyone (the task RLS already limits visibility context).
-- Insertable only by the comment author.
-- =============================================================================
create policy "Comments: read with task"
  on public.task_comments for select
  using (true);

create policy "Comments: insert authenticated"
  on public.task_comments for insert
  with check (user_id = get_user_id());

-- =============================================================================
-- TASK_RECURRENCES
-- Readable by all (members need to see their recurring assignments).
-- Only admin can create/update/delete.
-- =============================================================================
create policy "Recurrences: read all"
  on public.task_recurrences for select
  using (true);

create policy "Recurrences: admin insert"
  on public.task_recurrences for insert
  with check (get_user_role() in ('super_admin', 'ceo'));

create policy "Recurrences: admin update"
  on public.task_recurrences for update
  using (get_user_role() in ('super_admin', 'ceo'));

create policy "Recurrences: admin delete"
  on public.task_recurrences for delete
  using (get_user_role() in ('super_admin', 'ceo'));

-- =============================================================================
-- TASK_CATEGORIES
-- Readable by all. Only admin can manage.
-- =============================================================================
create policy "Categories: read all"
  on public.task_categories for select
  using (true);

create policy "Categories: admin insert"
  on public.task_categories for insert
  with check (get_user_role() in ('super_admin', 'ceo'));

create policy "Categories: admin update"
  on public.task_categories for update
  using (get_user_role() in ('super_admin', 'ceo'));

create policy "Categories: admin delete"
  on public.task_categories for delete
  using (get_user_role() in ('super_admin', 'ceo'));

-- =============================================================================
-- BONUS_LAUNCHES
-- Readable by all (everyone can see launch status/projections).
-- Only super_admin can manage launches.
-- =============================================================================
create policy "Launches: read all"
  on public.bonus_launches for select
  using (true);

create policy "Launches: super_admin insert"
  on public.bonus_launches for insert
  with check (get_user_role() = 'super_admin');

create policy "Launches: super_admin update"
  on public.bonus_launches for update
  using (get_user_role() = 'super_admin');

create policy "Launches: super_admin delete"
  on public.bonus_launches for delete
  using (get_user_role() = 'super_admin');

-- =============================================================================
-- BONUS_EVENTS
-- Members see their own events. Admins see all.
-- Only super_admin can register new events.
-- =============================================================================
create policy "Events: read own or admin"
  on public.bonus_events for select
  using (
    user_id = get_user_id()
    or get_user_role() in ('super_admin', 'ceo')
  );

create policy "Events: super_admin insert"
  on public.bonus_events for insert
  with check (get_user_role() = 'super_admin');

-- =============================================================================
-- DAILY_REPORTS
-- Members see their own. Admins see all.
-- Insert allowed for system (cron/service role) and authenticated users.
-- =============================================================================
create policy "Reports: read own or admin"
  on public.daily_reports for select
  using (
    user_id = get_user_id()
    or get_user_role() in ('super_admin', 'ceo')
  );

create policy "Reports: insert"
  on public.daily_reports for insert
  with check (true);

-- =============================================================================
-- ACTIVITY_LOG
-- Only admins can read the activity log.
-- Insert is open (server-side code logs actions on behalf of users).
-- =============================================================================
create policy "Activity: admin read"
  on public.activity_log for select
  using (get_user_role() in ('super_admin', 'ceo'));

create policy "Activity: insert"
  on public.activity_log for insert
  with check (true);

-- =============================================================================
-- USER_ABSENCES
-- Readable by all (needed to check if recurring tasks should be paused).
-- Only admin can manage absence records.
-- =============================================================================
create policy "Absences: read all"
  on public.user_absences for select
  using (true);

create policy "Absences: admin insert"
  on public.user_absences for insert
  with check (get_user_role() in ('super_admin', 'ceo'));

create policy "Absences: admin update"
  on public.user_absences for update
  using (get_user_role() in ('super_admin', 'ceo'));

create policy "Absences: admin delete"
  on public.user_absences for delete
  using (get_user_role() in ('super_admin', 'ceo'));
