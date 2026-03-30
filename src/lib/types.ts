// =============================================================================
// Equipo Nico Barrera — Application Type Definitions
// Derives table types from database.types.ts, adds application-level types.
// =============================================================================

import type { Database, Json } from './database.types';

// Re-export for convenience
export type { Database, Json };

// ---------------------------------------------------------------------------
// Enum / Union Types
// ---------------------------------------------------------------------------

export type UserRole = 'super_admin' | 'ceo' | 'member';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type BonusLaunchType = 'principal' | 'low_ticket';

export type BonusLaunchStatus = 'active' | 'projected' | 'closed';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

export type TaskType = 'planeada' | 'incendio';

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
// Row types — what Supabase queries return
// ---------------------------------------------------------------------------

export type User = Database['public']['Tables']['users']['Row'];
export type TaskCategory = Database['public']['Tables']['task_categories']['Row'];
export type TaskRecurrence = Database['public']['Tables']['task_recurrences']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskComment = Database['public']['Tables']['task_comments']['Row'];
export type BonusLaunch = Database['public']['Tables']['bonus_launches']['Row'];
export type BonusEvent = Database['public']['Tables']['bonus_events']['Row'];
export type DailyCheckin = Database['public']['Tables']['daily_checkins']['Row'];
export type DailyReport = Database['public']['Tables']['daily_reports']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_log']['Row'];
export type UserAbsence = Database['public']['Tables']['user_absences']['Row'];
export type KpiDefinition = Database['public']['Tables']['kpi_definitions']['Row'];
export type KpiTracking = Database['public']['Tables']['kpi_tracking']['Row'];
export type KpiSubmission = Database['public']['Tables']['kpi_submissions']['Row'];

// ---------------------------------------------------------------------------
// Insert types — what .insert() accepts
// ---------------------------------------------------------------------------

export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type TaskCategoryInsert = Database['public']['Tables']['task_categories']['Insert'];
export type TaskRecurrenceInsert = Database['public']['Tables']['task_recurrences']['Insert'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskCommentInsert = Database['public']['Tables']['task_comments']['Insert'];
export type BonusLaunchInsert = Database['public']['Tables']['bonus_launches']['Insert'];
export type BonusEventInsert = Database['public']['Tables']['bonus_events']['Insert'];
export type DailyCheckinInsert = Database['public']['Tables']['daily_checkins']['Insert'];
export type DailyReportInsert = Database['public']['Tables']['daily_reports']['Insert'];
export type ActivityLogInsert = Database['public']['Tables']['activity_log']['Insert'];
export type UserAbsenceInsert = Database['public']['Tables']['user_absences']['Insert'];
export type KpiDefinitionInsert = Database['public']['Tables']['kpi_definitions']['Insert'];
export type KpiTrackingInsert = Database['public']['Tables']['kpi_tracking']['Insert'];
export type KpiSubmissionInsert = Database['public']['Tables']['kpi_submissions']['Insert'];

// ---------------------------------------------------------------------------
// Update types — what .update() accepts
// ---------------------------------------------------------------------------

export type UserUpdate = Database['public']['Tables']['users']['Update'];
export type TaskCategoryUpdate = Database['public']['Tables']['task_categories']['Update'];
export type TaskRecurrenceUpdate = Database['public']['Tables']['task_recurrences']['Update'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];
export type TaskCommentUpdate = Database['public']['Tables']['task_comments']['Update'];
export type BonusLaunchUpdate = Database['public']['Tables']['bonus_launches']['Update'];
export type BonusEventUpdate = Database['public']['Tables']['bonus_events']['Update'];
export type DailyCheckinUpdate = Database['public']['Tables']['daily_checkins']['Update'];
export type DailyReportUpdate = Database['public']['Tables']['daily_reports']['Update'];
export type ActivityLogUpdate = Database['public']['Tables']['activity_log']['Update'];
export type UserAbsenceUpdate = Database['public']['Tables']['user_absences']['Update'];
export type KpiDefinitionUpdate = Database['public']['Tables']['kpi_definitions']['Update'];
export type KpiTrackingUpdate = Database['public']['Tables']['kpi_tracking']['Update'];
export type KpiSubmissionUpdate = Database['public']['Tables']['kpi_submissions']['Update'];

// ---------------------------------------------------------------------------
// KPI Domain Types (Hito 5 — KPI Tracking)
// ---------------------------------------------------------------------------

export type KpiDataType = 'number' | 'boolean' | 'percentage';
export type KpiDirection = 'asc' | 'desc';
export type KpiSubmissionStatus = 'draft' | 'submitted';

/** Per-KPI score result from the scoring engine */
export interface KpiScore {
  kpi_id: string;
  kpi_name: string;
  earned: number;
  max_points: number;
}

/** Full scoring result for one submission */
export interface KpiScoringResult {
  perKpi: KpiScore[];
  total: number;
  maxPossible: number;
}

/** Tracking entry with its definition attached (for member workspace) */
export interface KpiTrackingWithDefinition {
  kpi: KpiDefinition;
  tracking: KpiTracking | null;
  score: KpiScore;
}

/** Submission with nested tracking details (for history view) */
export interface KpiSubmissionWithDetails {
  submission: KpiSubmission;
  entries: KpiTrackingWithDefinition[];
}

// ---------------------------------------------------------------------------
// Performance / Dashboard Types (Hito 4)
// ---------------------------------------------------------------------------

export interface MemberMetrics {
  user_id: string;
  user: User;
  period: { from: string; to: string };
  tasks_total: number;
  tasks_completed: number;
  tasks_completed_on_time: number;
  tasks_pending: number;
  tasks_overdue: number;
  tasks_in_progress: number;
  tasks_blocked: number;
  completion_pct: number;
  avg_speed_hours: number | null;
  streak: number;
  tasks_completed_today: number;
  updated_today: boolean;
  weekly_data: WeeklyDataPoint[];
  tasks_list: Task[];
  block_reasons: Record<string, string>;
  block_audit: { internal: number; external: number };
  impact_distribution: { high: number; medium: number; low: number };
  avg_lead_time_hours: number | null;
  // Coaching metrics (Phase 4 finale)
  avg_estimation_gap: number | null; // ((real - estimated) / estimated) * 100
  fire_ratio: number | null;         // % incendio tasks over completed
  value_matrix: {
    key_projects: number;   // high impact + high effort
    quick_wins: number;     // high impact + low effort
    maintenance: number;    // low impact + low effort
    time_sinks: number;     // low impact + high effort
  };
}

export interface WeeklyDataPoint {
  date: string;
  completed: number;
  assigned: number;
  completion_pct: number;
  /** Cumulative scope: tasks created up to and including this day */
  scope: number;
  /** Cumulative completed: tasks completed up to and including this day */
  cumulative_completed: number;
}

export type DateRangeType = 'day' | 'week' | 'month' | 'custom';

export interface DateFilter {
  range: DateRangeType;
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// Bonus Simulator Types (Hito 5)
// ---------------------------------------------------------------------------

/** Input member for the bonus calculator */
export interface BonusMemberInput {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  points: number;
}

/** Single member result from bonus calculation */
export interface BonusCalculationResult {
  userId: string;
  weight: number;
  rawBonus: number;
  simulatedBonus: number;
  poolPercentage: number;
  isClamped: 'min' | 'max' | false;
}

/** Full simulation output */
export interface BonusSimulationOutput {
  revenue: number;
  marginPct: number;
  poolPct: number;
  netProfit: number;
  totalPool: number;
  results: BonusCalculationResult[];
}
