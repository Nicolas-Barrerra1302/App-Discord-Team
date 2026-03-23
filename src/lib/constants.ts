export const APP_NAME = "Mind Fuel Team";

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

export const DEFAULT_CATEGORIES = [
  { name: "Contenido", color: "#e91e63" },
  { name: "Edición", color: "#9c27b0" },
  { name: "Soporte", color: "#2196f3" },
  { name: "Mentoría", color: "#ff9800" },
  { name: "Operaciones", color: "#00e676" },
  { name: "General", color: "#607d8b" },
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
