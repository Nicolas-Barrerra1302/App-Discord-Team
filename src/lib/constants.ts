export const APP_NAME = "Equipo Nico Barrera";

// ═══════════════════════════════════════════════════════════════════
// Domain Enums
// ═══════════════════════════════════════════════════════════════════

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  CEO: "ceo",
  MEMBER: "member",
} as const;

export const TASK_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
} as const;

export const TASK_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export const BONUS_LAUNCH_TYPE = {
  PRINCIPAL: "principal",
  LOW_TICKET: "low_ticket",
} as const;

export const BONUS_LAUNCH_STATUS = {
  ACTIVE: "active",
  PROJECTED: "projected",
  CLOSED: "closed",
} as const;

// ═══════════════════════════════════════════════════════════════════
// UI Maps — Source of Truth (use Tailwind tokens, NEVER raw hex)
// ═══════════════════════════════════════════════════════════════════

// ── Status ────────────────────────────────────────────────────────

/** Tailwind classes for status badges/pills — solid bg, dark text for contrast on neon bg */
export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-status-pending text-background font-semibold",
  in_progress: "bg-status-in_progress text-background font-semibold",
  completed: "bg-status-completed text-background font-semibold",
  blocked: "bg-status-blocked text-background font-semibold",
};

/** Soft (transparent bg) variant for status indicators */
export const STATUS_COLORS_SOFT: Record<string, string> = {
  pending: "bg-status-pending/15 text-status-pending border border-status-pending/30",
  in_progress: "bg-status-in_progress/15 text-status-in_progress border border-status-in_progress/30",
  completed: "bg-status-completed/15 text-status-completed border border-status-completed/30",
  blocked: "bg-status-blocked/15 text-status-blocked border border-status-blocked/30",
};

/** Text-only color for status (icons, dots, borders) */
export const STATUS_TEXT: Record<string, string> = {
  pending: "text-status-pending",
  in_progress: "text-status-in_progress",
  completed: "text-status-completed",
  blocked: "text-status-blocked",
};

/** Border color for status */
export const STATUS_BORDER: Record<string, string> = {
  pending: "border-status-pending",
  in_progress: "border-status-in_progress",
  completed: "border-status-completed",
  blocked: "border-status-blocked",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  blocked: "Bloqueada",
};

// ── Priority ──────────────────────────────────────────────────────

export const PRIORITY_COLORS: Record<string, string> = {
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
  urgent: "text-priority-urgent",
};

export const PRIORITY_COLORS_SOFT: Record<string, string> = {
  low: "bg-priority-low/15 text-priority-low border border-priority-low/20",
  medium: "bg-priority-medium/15 text-priority-medium border border-priority-medium/30",
  high: "bg-priority-high/15 text-priority-high border border-priority-high/30",
  urgent: "bg-priority-urgent/15 text-priority-urgent border border-priority-urgent/30",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

/** Tailwind bg class for priority indicator dots */
export const PRIORITY_DOT: Record<string, string> = {
  low: "bg-priority-low",
  medium: "bg-priority-medium",
  high: "bg-priority-high",
  urgent: "bg-priority-urgent",
};

// ── Roles ─────────────────────────────────────────────────────────

export const ROLE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: "bg-role-super_admin/20", text: "text-role-super_admin", label: "Super Admin" },
  ceo: { bg: "bg-role-ceo/20", text: "text-role-ceo", label: "CEO" },
  member: { bg: "bg-role-member/20", text: "text-role-member", label: "Miembro" },
};

/** Combined className shorthand for role badges */
export const ROLE_BADGE_COLORS: Record<string, string> = {
  super_admin: "bg-role-super_admin/20 text-role-super_admin",
  ceo: "bg-role-ceo/20 text-role-ceo",
  member: "bg-role-member/20 text-role-member",
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  ceo: "CEO",
  member: "Miembro",
};

// ── Impact ────────────────────────────────────────────────────────

/** True Neon LED classes for task impact — transparent bg, solid border, glow text-shadow */
export const IMPACT_COLORS: Record<string, string> = {
  high:   "bg-transparent text-status-completed border border-status-completed [text-shadow:0_0_8px_currentColor]",  // Neon green — max impact
  medium: "bg-transparent text-priority-medium border border-priority-medium [text-shadow:0_0_6px_currentColor]",    // Electric amber — mid impact
  low:    "bg-transparent text-priority-low border border-priority-low/60",                                          // Slate — low noise
};

/** Display labels for impact values */
export const IMPACT_LABELS: Record<string, string> = {
  high:   "Alto",
  medium: "Medio",
  low:    "Bajo",
};

// ── Task Types ────────────────────────────────────────────────────

/** True Neon LED classes for task type badges — transparent bg, solid border, glow */
export const TASK_TYPE_COLORS: Record<string, string> = {
  incendio: "bg-transparent text-status-blocked border border-status-blocked [text-shadow:0_0_8px_currentColor]",          // Laser red — fire/critical
  planeada: "bg-transparent text-electric-blue border border-electric-blue [text-shadow:0_0_8px_currentColor]",            // Electric blue — planned task
  proyecto: "bg-transparent text-status-in_progress border border-status-in_progress [text-shadow:0_0_8px_currentColor]", // Electric blue — project
  admin:    "bg-transparent text-priority-low border border-priority-low/60",                                              // Slate — administrative
  mejora:   "bg-transparent text-priority-medium border border-priority-medium [text-shadow:0_0_6px_currentColor]",       // Amber — improvement
};

/** Display labels for task types */
export const TASK_TYPE_LABELS: Record<string, string> = {
  incendio: "Incendio",
  planeada: "Planeada",
  proyecto: "Proyecto",
  admin:    "Admin",
  mejora:   "Mejora",
};

// ── Bonus Event Types ─────────────────────────────────────────────

// uipro: Neon Traffic Light — gamification events use neon tier badges
// (positive events = neon green; penalties = neon red; streaks = gold; KPI = electric blue)
export const BONUS_EVENT_COLORS: Record<string, string> = {
  task_completed: "bg-success-neon/10 text-success-neon border border-success-neon/20",
  late_delivery:  "bg-danger-neon/10 text-danger-neon border border-danger-neon/20",
  penalty:        "bg-danger-neon/10 text-danger-neon border border-danger-neon/20",
  streak:         "bg-accent/15 text-accent border border-accent/25",
  kpi_weekly:     "bg-electric-blue/10 text-electric-blue border border-electric-blue/20",
  // Manual registration event types
  quality_bonus:  "bg-success-neon/10 text-success-neon border border-success-neon/20",
  initiative:     "bg-electric-blue/10 text-electric-blue border border-electric-blue/20",
  collaboration:  "bg-success-neon/10 text-success-neon border border-success-neon/20",
  adjustment:     "bg-warning-neon/10 text-warning-neon border border-warning-neon/20",
  settlement:     "bg-accent/15 text-accent border border-accent/25",
  daily_close:    "bg-electric-blue/10 text-electric-blue border border-electric-blue/20",
  missed_daily_close: "bg-danger-neon/10 text-danger-neon border border-danger-neon/20",
};

// ── Gamification — Points Tier Display ───────────────────────────
// uipro: Neon Traffic Light strictly for scoring/points context
// Use for: point deltas, score totals, KPI scores, leaderboard numbers

/** Text color for gamification point values (inline, no bg) */
export const POINTS_TIER_COLORS = {
  positive: "text-success-neon",   // +points awarded
  negative: "text-danger-neon",    // -points penalty
  neutral:  "text-text-muted",     // 0 / baseline
  high:     "text-success-neon",   // High score tier (≥80%)
  medium:   "text-warning-neon",   // Medium score tier (50–79%)
  low:      "text-danger-neon",    // Low score tier (<50%)
} as const;

/** Badge variant key for gamification event types → use with <Badge variant={...}> */
export const GAMIFICATION_BADGE_VARIANT: Record<string, string> = {
  task_completed:     "success-neon",
  late_delivery:      "danger-neon",
  penalty:            "danger-neon",
  streak:             "gold",
  kpi_weekly:         "electric-blue",
  quality_bonus:      "success-neon",
  initiative:         "electric-blue",
  collaboration:      "success-neon",
  adjustment:         "warning-neon",
  settlement:         "gold",
  daily_close:        "electric-blue",
  missed_daily_close: "danger-neon",
};

// ═══════════════════════════════════════════════════════════════════
// Common UI class patterns (reusable across components)
// ═══════════════════════════════════════════════════════════════════

/** Standard input field classes */
export const INPUT_CLASSES =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent";

/** Standard select field classes */
export const SELECT_CLASSES = INPUT_CLASSES;

/** Standard card container */
export const CARD_CLASSES = "bg-card-secondary rounded-xl p-5";

/** Standard section heading */
export const SECTION_HEADING_CLASSES = "text-xl font-bold text-text";

/** Standard muted subtext */
export const MUTED_TEXT_CLASSES = "text-sm text-text-muted";

// ═══════════════════════════════════════════════════════════════════
// Domain Data (non-UI)
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_CATEGORIES = [
  { name: "Contenido",    color: "#CBA35C" },  // Copper Gold
  { name: "Edición",     color: "#A695FF" },  // Soft Violet
  { name: "Soporte",     color: "#3A5A78" },  // Deep Slate Blue
  { name: "Mentoría",    color: "#A0784A" },  // Dusty Amber
  { name: "Operaciones", color: "#3D7A5C" },  // Deep Emerald
  { name: "General",     color: "#4A5560" },  // Slate Mist
] as const;

export const BONUS_POOL_PCT_DEFAULT = 7;
export const BONUS_MIN_PCT = 0.3;
export const BONUS_MAX_PCT = 1.5;

// Navigation items
export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Tareas", href: "/dashboard/tasks", icon: "CheckSquare" },
  { label: "Bonos", href: "/dashboard/bonuses", icon: "Trophy" },
  { label: "Calendario", href: "/dashboard/calendar", icon: "Calendar" },
] as const;

export const ADMIN_NAV_ITEMS = [
  {
    label: "Panel Admin",
    href: "/dashboard/admin/dashboard",
    icon: "Shield",
  },
  {
    label: "Recurrentes",
    href: "/dashboard/admin/recurrences",
    icon: "Repeat",
  },
] as const;
