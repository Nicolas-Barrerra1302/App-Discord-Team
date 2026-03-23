// =============================================================================
// Mind Fuel Team — Database Type Definitions
// Mirrors the Supabase PostgreSQL schema exactly.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

export type UserRole = 'super_admin' | 'ceo' | 'member';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type BonusLaunchType = 'principal' | 'low_ticket';

export type BonusLaunchStatus = 'active' | 'projected' | 'closed';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

// ---------------------------------------------------------------------------
// Nested Interfaces
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  all: boolean;
  urgent_only: boolean;
  reminders_only: boolean;
  none: boolean;
}

// ---------------------------------------------------------------------------
// Table Interfaces
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  discord_id: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  area: string | null;
  is_active: boolean;
  notification_preferences: NotificationPreferences;
  created_at: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TaskRecurrence {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  category_id: string | null;
  frequency: RecurrenceFrequency;
  days_of_week: number[];
  assigned_to: string | null;
  next_due_date: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  completed_at: string | null;
  category_id: string | null;
  parent_task_id: string | null;
  is_recurring_instance: boolean;
  recurrence_id: string | null;
  attachments: unknown[];
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface BonusLaunch {
  id: string;
  name: string;
  type: BonusLaunchType;
  status: BonusLaunchStatus;
  revenue_bruto: number;
  margen_neto_pct: number;
  pool_pct: number;
  revenue_real: number | null;
  margen_real_pct: number | null;
  created_at: string;
  closed_at: string | null;
}

export interface BonusEvent {
  id: string;
  launch_id: string;
  user_id: string;
  event_type: string;
  points: number;
  description: string | null;
  registered_by: string;
  created_at: string;
}

export interface DailyReport {
  id: string;
  user_id: string;
  date: string;
  tasks_completed: unknown[];
  tasks_pending: unknown[];
  tasks_overdue: unknown[];
  completion_pct: number;
  streak: number;
  notes: string | null;
  auto_generated: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserAbsence {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Supabase Database type map (for createClient<Database>())
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<User, 'id'>>;
        Relationships: [];
      };
      task_categories: {
        Row: TaskCategory;
        Insert: Omit<TaskCategory, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<TaskCategory, 'id'>>;
        Relationships: [];
      };
      task_recurrences: {
        Row: TaskRecurrence;
        Insert: Omit<TaskRecurrence, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<TaskRecurrence, 'id'>>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<Task, 'id'>>;
        Relationships: [];
      };
      task_comments: {
        Row: TaskComment;
        Insert: Omit<TaskComment, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<TaskComment, 'id'>>;
        Relationships: [];
      };
      bonus_launches: {
        Row: BonusLaunch;
        Insert: Omit<BonusLaunch, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<BonusLaunch, 'id'>>;
        Relationships: [];
      };
      bonus_events: {
        Row: BonusEvent;
        Insert: Omit<BonusEvent, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<BonusEvent, 'id'>>;
        Relationships: [];
      };
      daily_reports: {
        Row: DailyReport;
        Insert: Omit<DailyReport, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<DailyReport, 'id'>>;
        Relationships: [];
      };
      activity_log: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ActivityLog, 'id'>>;
        Relationships: [];
      };
      user_absences: {
        Row: UserAbsence;
        Insert: Omit<UserAbsence, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<UserAbsence, 'id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
