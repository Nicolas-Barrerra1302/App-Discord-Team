import {
  CheckCircle2,
  TrendingUp,
  Activity,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Action label map
// ---------------------------------------------------------------------------

export const ACTION_LABELS: Record<string, string> = {
  task_created: "Tarea creada",
  task_updated: "Tarea actualizada",
  task_deleted: "Tarea eliminada",
  status_changed: "Estado cambiado",
  comment_added: "Comentario agregado",
  comment_deleted: "Comentario eliminado",
  subtask_created: "Subtarea creada",
  subtask_updated: "Subtarea actualizada",
  subtask_deleted: "Subtarea eliminada",
  category_created: "Categoria creada",
  category_updated: "Categoria actualizada",
  category_deleted: "Categoria eliminada",
  recurrence_created: "Recurrencia creada",
  recurrence_updated: "Recurrencia actualizada",
  recurrence_deleted: "Recurrencia eliminada",
  absence_created: "Ausencia registrada",
  absence_deleted: "Ausencia eliminada",
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return "hace un momento";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHrs < 24) return `hace ${diffHrs} ${diffHrs === 1 ? "hora" : "horas"}`;
  if (diffDays < 30) return `hace ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Format today's date in Spanish
// ---------------------------------------------------------------------------

export function formatTodayDate(): string {
  return new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Format short date (day + month, Colombia locale)
// ---------------------------------------------------------------------------

export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const dateOnly = dateStr.substring(0, 10);
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Format chart date
// ---------------------------------------------------------------------------

export function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Entity type icon
// ---------------------------------------------------------------------------

export function getEntityIcon(entityType: string) {
  switch (entityType) {
    case "task":
      return CheckCircle2;
    case "comment":
      return Activity;
    case "subtask":
      return TrendingUp;
    default:
      return Activity;
  }
}

// ---------------------------------------------------------------------------
// Custom tooltip types and components for Recharts
// ---------------------------------------------------------------------------

export interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  name?: string;
  color?: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1e1e2e] px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs text-[#9e9e9e]">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium text-white">
          {entry.dataKey === "completion_pct"
            ? `${entry.value}% cumplimiento`
            : `${entry.value} completadas`}
        </p>
      ))}
    </div>
  );
}

export function BarChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1e1e2e] px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs text-[#9e9e9e]">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium text-white">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}
