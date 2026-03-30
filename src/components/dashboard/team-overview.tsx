"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Zap,
  Loader2,
  X,
  Ban,
  ChevronDown,
  Flame,
  Filter,
  Timer,
  Target,
  ShieldAlert,
} from "lucide-react";
import { cn, formatTimeSpent } from "@/lib/utils";
import { formatTodayDate } from "@/lib/dashboard/utils";
import { isOverdue } from "@/lib/tasks";
import { AdminMultiSelect } from "@/components/dashboard/admin-multi-select";
import { AdminCheckinsWidget, type CheckinListItem } from "@/components/dashboard/admin-checkins-widget";
import { ActivityLogFeed, type ActivityLogEvent } from "@/components/shared/ActivityLogFeed";
import { getTodayColombia } from "@/lib/tasks/dates";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_BADGE,
} from "@/lib/constants";
import type { MemberMetrics, User, TaskCategory, Task, DateRangeType } from "@/lib/types";

// Raw checkin row as returned by PostgREST (numeric fields come as strings)
export interface RawCheckin {
  user_id: string;
  checkin_date: string;
  hours_worked: string;
  fires_handled: number;
  blocks_count: number;
  summary: string;
  completion_pct: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TeamOverviewProps {
  metrics: MemberMetrics[];
  currentUser: User;
  allUsers: User[];
  activityLogs?: ActivityLogEvent[];
  rawCheckins?: RawCheckin[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DrillDownKey = "completed" | "pending" | "overdue" | "blocked" | "block_internal" | "block_external" | "impact_high" | "impact_medium" | "impact_low";

const DRILL_LABELS: Record<DrillDownKey, string> = {
  completed: "Tareas Completadas",
  pending: "Tareas Pendientes",
  overdue: "Tareas Atrasadas",
  blocked: "Tareas Bloqueadas",
  block_internal: "Bloqueos Internos (Equipo)",
  block_external: "Bloqueos Externos (Cliente/Proveedor)",
  impact_high: "Tareas de Alto Impacto",
  impact_medium: "Tareas de Impacto Medio",
  impact_low: "Tareas de Bajo Impacto",
};

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-priority-low",
  medium: "bg-priority-medium",
  high: "bg-priority-high",
  urgent: "bg-priority-urgent",
};

const IMPACT_BADGE: Record<string, string> = {
  high: "danger-neon",
  medium: "warning-neon",
  low: "outline",
};

const IMPACT_LABEL: Record<string, string> = {
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TaskWithMember extends Task {
  _user_name: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const dateOnly = dateStr.substring(0, 10);
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function getAggregatedDrillTasks(metrics: MemberMetrics[], key: DrillDownKey): TaskWithMember[] {
  const allTasks: TaskWithMember[] = metrics.flatMap(m =>
    (m.tasks_list ?? []).map(t => ({ ...t, _user_name: m.user.name }))
  );

  switch (key) {
    case "completed":
      return allTasks.filter(t => t.status === "completed");
    case "pending":
      return allTasks.filter(t => t.status === "pending" || t.status === "in_progress");
    case "overdue":
      return allTasks.filter(t => isOverdue(t));
    case "blocked":
      return allTasks.filter(t => t.status === "blocked");
    case "block_internal":
      return allTasks.filter(t => t.status === "blocked" && t.block_type === "internal");
    case "block_external":
      return allTasks.filter(t => t.status === "blocked" && t.block_type === "external");
    case "impact_high":
      return allTasks.filter(t => t.impact === "high");
    case "impact_medium":
      return allTasks.filter(t => t.impact === "medium");
    case "impact_low":
      return allTasks.filter(t => t.impact === "low");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamOverview({
  metrics: initialMetrics,
  currentUser,
  allUsers,
  activityLogs = [],
  rawCheckins = [],
}: TeamOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dateRange, setDateRange] = useState<DateRangeType>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [metrics, setMetrics] = useState<MemberMetrics[]>(initialMetrics);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownKey | null>(null);

  // Filter by selected users (state-driven via AdminMultiSelect onChange)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => {
    const raw = searchParams.get("users") ?? "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  // Fetch categories on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then(r => {
        if (!r.ok) throw new Error(`Categories API ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data as TaskCategory[] : []);
      })
      .catch((err) => { console.error("Error fetching categories:", err); });
    return () => { cancelled = true; };
  }, []);

  // Fetch metrics when any filter changes
  useEffect(() => {
    const isDefault = dateRange === "week" && categoryFilter === "all" && typeFilter === "all";
    if (isDefault) {
      setMetrics(initialMetrics);
      return;
    }
    if (dateRange === "custom") {
      if (!customFrom || !customTo) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo)) return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("range", dateRange);
    if (dateRange === "custom") {
      params.set("from", new Date(`${customFrom}T00:00:00`).toISOString());
      params.set("to", new Date(`${customTo}T23:59:59.999`).toISOString());
    }
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (typeFilter !== "all") params.set("task_type", typeFilter);
    if (selectedUserIds.length > 0) params.set("users", selectedUserIds.join(","));

    fetch(`/api/performance?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${body}`);
        }
        return res.json();
      })
      .then((data: MemberMetrics[]) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((err) => {
        console.error("Error fetching team metrics:", err, "params:", params.toString());
        if (!cancelled) setError("Error al actualizar las metricas. Intentalo de nuevo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateRange, customFrom, customTo, categoryFilter, typeFilter, selectedUserIds, initialMetrics]);

  const filteredMetrics = useMemo(
    () => selectedUserIds.length > 0 ? metrics.filter(m => selectedUserIds.includes(m.user_id)) : metrics,
    [metrics, selectedUserIds]
  );
  // Activity logs: pass initial + filter via userIdsFilter for server-side pagination
  const activityUserIdsFilter = selectedUserIds.length > 0 ? selectedUserIds : undefined;
  const filteredActivityLogs = useMemo(
    () => selectedUserIds.length > 0 ? activityLogs.filter(e => selectedUserIds.includes(e.userId)) : activityLogs,
    [activityLogs, selectedUserIds]
  );

  // --- Checkins: filter by current dateRange (client-side) ---
  const { checkinsList, checkinsWidgetTitle } = useMemo(() => {
    // Determine active date range boundaries (YYYY-MM-DD)
    const today = getTodayColombia();
    let localFrom = today;
    let localTo = today;

    if (dateRange === "day") {
      // today only
    } else if (dateRange === "week") {
      const d = new Date(today + "T00:00:00");
      const dow = d.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(d);
      mon.setDate(mon.getDate() + mondayOffset);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      localFrom = mon.toISOString().substring(0, 10);
      localTo = sun.toISOString().substring(0, 10);
    } else if (dateRange === "month") {
      const d = new Date(today + "T00:00:00");
      localFrom = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      localTo = last.toISOString().substring(0, 10);
    } else if (dateRange === "custom" && customFrom && customTo) {
      localFrom = customFrom.substring(0, 10);
      localTo = customTo.substring(0, 10);
    }

    // Filter + sort ascending (last-write-wins per user via Map)
    const filtered = rawCheckins
      .filter((c) => {
        const d = c.checkin_date.substring(0, 10);
        return d >= localFrom && d <= localTo;
      })
      .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date));

    const map = new Map<string, typeof filtered[number]>();
    filtered.forEach((c) => map.set(c.user_id, c));

    const list: CheckinListItem[] = allUsers.map((u) => {
      const c = map.get(u.id) ?? null;
      return {
        user: { id: u.id, name: u.name, avatar_url: u.avatar_url },
        checkin: c
          ? {
              hours_worked: c.hours_worked,
              fires_handled: c.fires_handled,
              blocks_count: c.blocks_count,
              summary: c.summary,
              completion_pct: Number(c.completion_pct) || 0,
            }
          : null,
      };
    });

    const title = localFrom === localTo
      ? `Cierres del ${localFrom}`
      : "Últimos cierres del periodo";

    return { checkinsList: list, checkinsWidgetTitle: title };
  }, [rawCheckins, allUsers, dateRange, customFrom, customTo]);

  // User options for multi-select (always from full immutable list, never filtered)
  const userOptions = useMemo(
    () => allUsers.map(u => ({ id: u.id, name: u.name, avatar_url: u.avatar_url })),
    [allUsers]
  );

  // Team totals (from filtered metrics)
  const totalCompleted = filteredMetrics.reduce((s, m) => s + m.tasks_completed, 0);
  const totalPending = filteredMetrics.reduce((s, m) => s + m.tasks_pending + m.tasks_in_progress, 0);
  const totalOverdue = filteredMetrics.reduce((s, m) => s + m.tasks_overdue, 0);
  const totalBlocked = filteredMetrics.reduce((s, m) => s + m.tasks_blocked, 0);

  // Audit aggregates
  const totalBlockInternal = filteredMetrics.reduce((s, m) => s + m.block_audit.internal, 0);
  const totalBlockExternal = filteredMetrics.reduce((s, m) => s + m.block_audit.external, 0);
  const impactHigh = filteredMetrics.reduce((s, m) => s + m.impact_distribution.high, 0);
  const impactMedium = filteredMetrics.reduce((s, m) => s + m.impact_distribution.medium, 0);
  const impactLow = filteredMetrics.reduce((s, m) => s + m.impact_distribution.low, 0);
  const impactTotal = impactHigh + impactMedium + impactLow;

  // Avg lead time across all members (weighted average)
  const leadTimeMembers = filteredMetrics.filter(m => m.avg_lead_time_hours !== null);
  const avgLeadTimeHours = leadTimeMembers.length > 0
    ? Math.round(leadTimeMembers.reduce((s, m) => s + m.avg_lead_time_hours!, 0) / leadTimeMembers.length * 10) / 10
    : null;

  // Stat cards (clickable)
  const statCards: { key: DrillDownKey; label: string; value: number; icon: typeof CheckCircle2; iconClass: string; bgClass: string }[] = [
    { key: "completed", label: "Total Completadas", value: totalCompleted, icon: CheckCircle2, iconClass: "text-success-neon [filter:drop-shadow(0_0_6px_currentColor)]", bgClass: "bg-success-neon/5" },
    { key: "pending", label: "Total Pendientes", value: totalPending, icon: Clock, iconClass: "text-electric-blue [filter:drop-shadow(0_0_6px_currentColor)]", bgClass: "bg-electric-blue/5" },
    { key: "overdue", label: "Total Atrasadas", value: totalOverdue, icon: AlertTriangle, iconClass: totalOverdue > 0 ? "text-warning-neon [filter:drop-shadow(0_0_6px_currentColor)]" : "text-text-muted", bgClass: totalOverdue > 0 ? "bg-warning-neon/5" : "bg-white/[0.03]" },
    { key: "blocked", label: "Total Bloqueadas", value: totalBlocked, icon: Ban, iconClass: totalBlocked > 0 ? "text-danger-neon [filter:drop-shadow(0_0_6px_currentColor)]" : "text-text-muted", bgClass: totalBlocked > 0 ? "bg-danger-neon/5" : "bg-white/[0.03]" },
  ];

  // Drill-down tasks (aggregated from all members)
  const drillTasks = drillDown ? getAggregatedDrillTasks(filteredMetrics, drillDown) : [];
  const isAdmin = currentUser.role === "super_admin" || currentUser.role === "ceo";

  // Category + block reasons lookup across all members
  const catMap = new Map(categories.map(c => [c.id, c]));
  const allBlockReasons: Record<string, string> = {};
  for (const m of filteredMetrics) {
    if (m.block_reasons) {
      Object.assign(allBlockReasons, m.block_reasons);
    }
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header + filters                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-6 w-6 text-accent" />
            <h1 className="text-2xl font-bold text-text-heading md:text-3xl">Panel del Equipo</h1>
          </div>
          <p className="mt-1 text-sm capitalize text-text-muted" suppressHydrationWarning>
            {formatTodayDate()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card-secondary p-1">
            {(["day", "week", "month", "custom"] as const).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setDateRange(range)}
                className="text-xs sm:text-sm"
              >
                {range === "day" ? "Dia" : range === "week" ? "Semana" : range === "month" ? "Mes" : "Personalizado"}
              </Button>
            ))}
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
        </div>
      </div>

      {/* Custom dates + filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {dateRange === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-border bg-card-secondary px-3 py-1.5 text-sm text-text outline-none focus:border-accent" />
            <span className="text-xs text-text-muted">a</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-border bg-card-secondary px-3 py-1.5 text-sm text-text outline-none focus:border-accent" />
          </>
        )}
        <div className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5 text-text-muted" /></div>
        <div className="relative">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-card-secondary py-1.5 pl-3 pr-8 text-sm text-text outline-none transition-colors hover:border-white/20 focus:border-accent">
            <option value="all">Todas las categorias</option>
            {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
        <div className="relative">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none rounded-lg border border-border bg-card-secondary py-1.5 pl-3 pr-8 text-sm text-text outline-none transition-colors hover:border-white/20 focus:border-accent">
            <option value="all">Todos los tipos</option>
            <option value="planeada">Planeada</option>
            <option value="incendio">Incendio</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
        <AdminMultiSelect users={userOptions} onChange={setSelectedUserIds} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
          <p className="flex-1 text-sm text-danger">{error}</p>
          <Button variant="ghost" size="icon" onClick={() => setError(null)} className="h-8 w-8 shrink-0 text-danger/60 hover:text-danger hover:bg-transparent">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Stat cards (clickable)                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const isActive = drillDown === stat.key;
          return (
            <Button
              key={stat.key}
              variant="ghost"
              onClick={() => setDrillDown(isActive ? null : stat.key)}
              className={cn(
                "h-auto flex-col items-start rounded-xl border bg-card-secondary p-5 text-left transition-all",
                isActive ? "border-accent/40 shadow-lg shadow-accent/5" : "border-border hover:border-white/10"
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bgClass)}>
                  <Icon className={cn("h-5 w-5", stat.iconClass)} />
                </div>
              </div>
              <p className="text-3xl font-bold text-text-heading">{stat.value}</p>
              <p className="mt-1 text-sm text-text-muted">{stat.label}</p>
            </Button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Audit widgets row                                                 */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Widget 1: Block Audit — Internal vs External */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-danger-neon [filter:drop-shadow(0_0_6px_currentColor)]" />
            <h3 className="text-sm font-semibold text-text-heading">Auditoria de Bloqueos</h3>
          </div>
          {totalBlocked > 0 ? (
            <div className="space-y-3">
              {/* Stacked bar */}
              <div className="flex h-8 w-full overflow-hidden rounded-lg">
                {totalBlockInternal > 0 && (
                  <button
                    onClick={() => setDrillDown(drillDown === "block_internal" ? null : "block_internal")}
                    className="flex items-center justify-center text-[11px] font-medium text-white transition-opacity hover:opacity-80"
                    style={{
                      width: `${(totalBlockInternal / totalBlocked) * 100}%`,
                      backgroundColor: "#ff9800",
                    }}
                  >
                    {totalBlockInternal}
                  </button>
                )}
                {totalBlockExternal > 0 && (
                  <button
                    onClick={() => setDrillDown(drillDown === "block_external" ? null : "block_external")}
                    className="flex items-center justify-center text-[11px] font-medium text-white transition-opacity hover:opacity-80"
                    style={{
                      width: `${(totalBlockExternal / totalBlocked) * 100}%`,
                      backgroundColor: "#f44336",
                    }}
                  >
                    {totalBlockExternal}
                  </button>
                )}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs">
                <button onClick={() => setDrillDown(drillDown === "block_internal" ? null : "block_internal")}
                  className={cn("flex items-center gap-1.5 transition-colors", drillDown === "block_internal" ? "text-warning-neon [text-shadow:0_0_6px_currentColor]" : "text-text-muted hover:text-warning-neon")}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-warning-neon" />
                  Interno ({totalBlockInternal})
                </button>
                <button onClick={() => setDrillDown(drillDown === "block_external" ? null : "block_external")}
                  className={cn("flex items-center gap-1.5 transition-colors", drillDown === "block_external" ? "text-danger-neon [text-shadow:0_0_6px_currentColor]" : "text-text-muted hover:text-danger-neon")}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger-neon" />
                  Externo ({totalBlockExternal})
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Sin bloqueos activos</p>
          )}
        </Card>

        {/* Widget 2: Avg Lead Time */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Timer className="h-4 w-4 text-electric-blue [filter:drop-shadow(0_0_6px_currentColor)]" />
            <h3 className="text-sm font-semibold text-text-heading">Tiempo de Ciclo Promedio</h3>
          </div>
          {avgLeadTimeHours !== null ? (
            <div>
              <p className="text-3xl font-bold text-text-heading">
                {avgLeadTimeHours >= 24
                  ? `${Math.round(avgLeadTimeHours / 24 * 10) / 10}d`
                  : `${avgLeadTimeHours}h`}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {avgLeadTimeHours >= 24
                  ? `${avgLeadTimeHours} horas`
                  : "Desde creacion hasta completado"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Sin tareas completadas</p>
          )}
        </Card>

        {/* Widget 3: Impact Distribution — CSS pie chart */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-text-heading">Distribucion de Impacto</h3>
          </div>
          {impactTotal > 0 ? (
            <div className="flex items-center gap-4">
              {/* CSS conic-gradient pie — hex required for style={{}} */}
              <div
                className="h-20 w-20 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(
                    #f44336 0% ${(impactHigh / impactTotal) * 100}%,
                    #ff9800 ${(impactHigh / impactTotal) * 100}% ${((impactHigh + impactMedium) / impactTotal) * 100}%,
                    #607d8b ${((impactHigh + impactMedium) / impactTotal) * 100}% 100%
                  )`,
                }}
              />
              {/* Legend */}
              <div className="flex flex-col gap-1.5 text-xs">
                <button onClick={() => setDrillDown(drillDown === "impact_high" ? null : "impact_high")}
                  className={cn("flex items-center gap-1.5 transition-colors", drillDown === "impact_high" ? "text-danger-neon [text-shadow:0_0_6px_currentColor]" : "text-text-muted hover:text-danger-neon")}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger-neon" />
                  Alto ({impactHigh})
                </button>
                <button onClick={() => setDrillDown(drillDown === "impact_medium" ? null : "impact_medium")}
                  className={cn("flex items-center gap-1.5 transition-colors", drillDown === "impact_medium" ? "text-warning-neon [text-shadow:0_0_6px_currentColor]" : "text-text-muted hover:text-warning-neon")}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-warning-neon" />
                  Medio ({impactMedium})
                </button>
                <button onClick={() => setDrillDown(drillDown === "impact_low" ? null : "impact_low")}
                  className={cn("flex items-center gap-1.5 transition-colors", drillDown === "impact_low" ? "text-text-muted" : "text-text-muted hover:text-text")}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-text-muted" />
                  Bajo ({impactLow})
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Sin datos de impacto</p>
          )}
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Drill-down panel (admin: shows member name)                       */}
      {/* ----------------------------------------------------------------- */}
      {drillDown && (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-5 py-3">
            <CardTitle className="text-sm">
              {DRILL_LABELS[drillDown]} ({drillTasks.length})
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setDrillDown(null)} className="h-8 w-8 text-text-muted hover:text-white hover:bg-transparent">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          {drillTasks.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card-secondary">
                  <tr className="border-b border-border">
                    {isAdmin && <th className="px-4 py-2 font-medium text-text-muted">Miembro</th>}
                    <th className="px-4 py-2 font-medium text-text-muted">Titulo</th>
                    <th className="px-4 py-2 font-medium text-text-muted">Estado</th>
                    <th className="hidden px-4 py-2 font-medium text-text-muted sm:table-cell">Tipo</th>
                    <th className="hidden px-4 py-2 font-medium text-text-muted md:table-cell">Categoria</th>
                    <th className="hidden px-4 py-2 font-medium text-text-muted sm:table-cell">Prioridad</th>
                    <th className="px-4 py-2 font-medium text-text-muted">Fecha límite</th>
                    <th className="px-4 py-2 font-medium text-text-muted">Completada el</th>
                    <th className="hidden px-4 py-2 font-medium text-text-muted md:table-cell">Impacto</th>
                    <th className="hidden px-4 py-2 font-medium text-text-muted md:table-cell">Tiempo</th>
                    {(drillDown === "blocked" || drillDown === "block_internal" || drillDown === "block_external") && <th className="px-4 py-2 font-medium text-text-muted">Motivo</th>}
                  </tr>
                </thead>
                <tbody>
                  {drillTasks.map((task) => {
                    const cat = task.category_id ? catMap.get(task.category_id) : null;
                    return (
                      <tr key={task.id} className="border-b border-border last:border-0 hover:bg-white/[0.02]">
                        {isAdmin && (
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-accent">
                            {task._user_name}
                          </td>
                        )}
                        <td className="max-w-[180px] truncate px-4 py-2.5 text-text-heading">{task.title}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={task.status as "pending" | "in_progress" | "completed" | "blocked"} className="rounded-full text-[11px]">
                            {STATUS_LABELS[task.status]}
                          </Badge>
                        </td>
                        <td className="hidden px-4 py-2.5 sm:table-cell">
                          <Badge
                            variant={task.task_type === "incendio" ? "danger-neon" : "electric-blue"}
                            className="gap-1 rounded-full text-[11px]"
                          >
                            {task.task_type === "incendio" && <Flame className="h-3 w-3" />}
                            {task.task_type === "incendio" ? "Incendio" : "Planeada"}
                          </Badge>
                        </td>
                        <td className="hidden px-4 py-2.5 md:table-cell">
                          {cat ? (
                            <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                              {cat.name}
                            </span>
                          ) : <span className="text-xs text-text-muted">{"\u2014"}</span>}
                        </td>
                        <td className="hidden px-4 py-2.5 sm:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("inline-block h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} />
                            <span className="text-text text-xs">{PRIORITY_LABELS[task.priority]}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                          {isOverdue(task) ? (
                            <Badge variant="danger-neon" className="gap-1 rounded-full text-[10px]">
                              <Clock className="h-3 w-3" />
                              {formatDate(task.due_date)}
                            </Badge>
                          ) : (
                            <span className="text-text">{formatDate(task.due_date)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                          {task.completed_at ? (
                            <span className={
                              !task.due_date || task.completed_at.substring(0, 10) <= task.due_date.substring(0, 10)
                                ? "text-success-neon [text-shadow:0_0_6px_currentColor]"
                                : "text-danger-neon [text-shadow:0_0_6px_currentColor]"
                            }>
                              {formatDate(task.completed_at)}
                            </span>
                          ) : (
                            <span className="text-text-muted">{"\u2014"}</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-2.5 md:table-cell">
                          {task.impact ? (
                            <Badge variant={IMPACT_BADGE[task.impact] as "danger-neon" | "warning-neon" | "outline"} className="rounded-full text-[11px]">
                              {IMPACT_LABEL[task.impact]}
                            </Badge>
                          ) : <span className="text-xs text-text-muted">{"\u2014"}</span>}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-2.5 text-text text-xs md:table-cell">
                          {task.time_spent != null ? formatTimeSpent(task.time_spent) : "\u2014"}
                        </td>
                        {(drillDown === "blocked" || drillDown === "block_internal" || drillDown === "block_external") && (
                          <td className="max-w-[180px] truncate px-4 py-2.5 text-xs text-danger-neon [text-shadow:0_0_6px_currentColor]">
                            {task.block_reason ?? allBlockReasons[task.id] ?? "\u2014"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <CardContent className="py-6 text-center text-sm text-text-muted">Sin tareas en esta categoria</CardContent>
          )}
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Member grid                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-heading">Miembros ({filteredMetrics.length})</h2>

        {filteredMetrics.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMetrics.map((m) => {
              const badge = ROLE_BADGE[m.user.role as keyof typeof ROLE_BADGE];
              const isCurrentUser = m.user_id === currentUser.id;
              const completionColor =
                m.completion_pct >= 80 ? "text-success-neon [text-shadow:0_0_6px_currentColor]"
                  : m.completion_pct >= 50 ? "text-warning-neon [text-shadow:0_0_6px_currentColor]" : "text-danger-neon [text-shadow:0_0_6px_currentColor]";

              return (
                <button
                  key={m.user_id}
                  onClick={() => router.push(`/admin/member/${m.user_id}`)}
                  className={cn(
                    "group rounded-xl border bg-card-secondary p-5 text-left transition-all hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5",
                    isCurrentUser ? "border-accent/20" : "border-border"
                  )}
                >
                  <div className="mb-4 flex items-start gap-3">
                    {m.user.avatar_url ? (
                      <Image src={m.user.avatar_url} alt={m.user.name} width={40} height={40} className="rounded-full" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-heading group-hover:text-accent transition-colors">
                        {m.user.name}
                      </p>
                      {badge && (
                        <Badge className={cn("mt-1 rounded-full text-[10px] uppercase tracking-wider", badge.bg, badge.text)}>
                          {badge.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <div className={cn("h-2.5 w-2.5 rounded-full", m.updated_today ? "bg-success-neon" : "bg-danger-neon")}
                        style={{ boxShadow: m.updated_today ? "0 0 6px #00E676" : "0 0 6px #FF5252" }} />
                      <span className="text-[10px] text-text-muted">{m.updated_today ? "Activo hoy" : "Sin actividad"}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Hoy:</span>
                      <span className="font-medium text-text-heading">
                        {m.tasks_completed_today} completada{m.tasks_completed_today !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Pendientes:</span>
                      <span className="font-medium text-text-heading">{m.tasks_pending}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Atrasadas:</span>
                      <span className={cn("font-medium", m.tasks_overdue > 0 ? "text-danger-neon [text-shadow:0_0_6px_currentColor]" : "text-text-heading")}>
                        {m.tasks_overdue}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">% Cumplimiento:</span>
                      <span className={cn("font-medium", completionColor)}>{m.completion_pct}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Racha:</span>
                      <span className="flex items-center gap-1 font-medium text-text-heading">
                        <Zap className="h-3.5 w-3.5 text-warning-neon [filter:drop-shadow(0_0_4px_currentColor)]" />
                        {m.streak} {m.streak === 1 ? "dia" : "dias"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center text-text-muted">
            No hay miembros activos
          </Card>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Cierres de Hoy + Activity Log (side by side)                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {checkinsList.length > 0 && (
          <AdminCheckinsWidget checkinsList={checkinsList} title={checkinsWidgetTitle} />
        )}
        {filteredActivityLogs.length > 0 && (
          <Card className="p-5">
            <ActivityLogFeed initialLogs={filteredActivityLogs} userIdsFilter={activityUserIdsFilter} />
          </Card>
        )}
      </div>
    </div>
  );
}
