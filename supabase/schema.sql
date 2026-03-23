-- =============================================================================
-- Mind Fuel Team — Complete Database Schema
-- Supabase (PostgreSQL)
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================================
-- USERS
-- =============================================================================
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  discord_id text unique not null,
  name text not null,
  avatar_url text,
  role text not null default 'member' check (role in ('super_admin', 'ceo', 'member')),
  area text,
  is_active boolean default true,
  notification_preferences jsonb default '{"all": true, "urgent_only": false, "reminders_only": false, "none": false}'::jsonb,
  created_at timestamptz default now()
);

-- =============================================================================
-- TASK_CATEGORIES
-- =============================================================================
create table public.task_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#607d8b',
  is_default boolean default false,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- =============================================================================
-- TASK_RECURRENCES
-- =============================================================================
create table public.task_recurrences (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  category_id uuid references public.task_categories(id),
  frequency text not null check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
  days_of_week integer[] default '{}',
  assigned_to uuid references public.users(id),
  next_due_date date,
  is_active boolean default true,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- =============================================================================
-- TASKS
-- =============================================================================
create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'blocked')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid references public.users(id),
  created_by uuid references public.users(id),
  due_date timestamptz,
  completed_at timestamptz,
  category_id uuid references public.task_categories(id),
  parent_task_id uuid references public.tasks(id),
  is_recurring_instance boolean default false,
  recurrence_id uuid references public.task_recurrences(id),
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- TASK_COMMENTS
-- =============================================================================
create table public.task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id),
  content text not null,
  created_at timestamptz default now()
);

-- =============================================================================
-- BONUS_LAUNCHES
-- =============================================================================
create table public.bonus_launches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('principal', 'low_ticket')),
  status text not null default 'projected' check (status in ('active', 'projected', 'closed')),
  revenue_bruto numeric(12,2) not null default 0,
  margen_neto_pct numeric(5,2) not null default 40,
  pool_pct numeric(5,2) not null default 7,
  revenue_real numeric(12,2),
  margen_real_pct numeric(5,2),
  created_at timestamptz default now(),
  closed_at timestamptz
);

-- =============================================================================
-- BONUS_EVENTS
-- =============================================================================
create table public.bonus_events (
  id uuid primary key default uuid_generate_v4(),
  launch_id uuid not null references public.bonus_launches(id) on delete cascade,
  user_id uuid not null references public.users(id),
  event_type text not null,
  points integer not null,
  description text,
  registered_by uuid not null references public.users(id),
  created_at timestamptz default now()
);

-- =============================================================================
-- DAILY_REPORTS
-- =============================================================================
create table public.daily_reports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id),
  date date not null,
  tasks_completed jsonb default '[]'::jsonb,
  tasks_pending jsonb default '[]'::jsonb,
  tasks_overdue jsonb default '[]'::jsonb,
  completion_pct numeric(5,2) default 0,
  streak integer default 0,
  notes text,
  auto_generated boolean default true,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- =============================================================================
-- ACTIVITY_LOG
-- =============================================================================
create table public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- =============================================================================
-- USER_ABSENCES
-- =============================================================================
create table public.user_absences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id),
  start_date date not null,
  end_date date not null,
  reason text,
  created_by uuid not null references public.users(id),
  created_at timestamptz default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
create index idx_tasks_assigned_to on public.tasks(assigned_to);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_parent on public.tasks(parent_task_id);
create index idx_task_comments_task on public.task_comments(task_id);
create index idx_bonus_events_launch on public.bonus_events(launch_id);
create index idx_bonus_events_user on public.bonus_events(user_id);
create index idx_activity_log_user on public.activity_log(user_id);
create index idx_activity_log_entity on public.activity_log(entity_type, entity_id);
create index idx_daily_reports_user_date on public.daily_reports(user_id, date);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at on tasks
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();
