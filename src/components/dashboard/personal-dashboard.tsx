"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
  Filter,
  Flame,
  Target,
  Gauge,
  Brain,
  Zap,
  Ban,
  FileCheck,
  CheckCheck,
} from "lucide-react";
import { cn, formatTimeSpent } from "@/lib/utils";
import { isOverdue } from "@/lib/tasks";
import { formatTodayDate } from "@/lib/dashboard/utils";
import { ActivityLogFeed, type ActivityLogEvent } from "@/components/shared/ActivityLogFeed";
import type { MemberMetrics, TaskCategory, Task, DateRangeType } from "@/lib/types";
import { DailyCheckinModal } from "./daily-checkin-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY_DOT,
} from "@/lib/constants";
import { EstimationGauge } from "./shared/EstimationGauge";
import { StressBar } from "./shared/StressBar";
import { ValueMatrix } from "./shared/ValueMatrix";
import { DrillDownTable } from "./shared/DrillDownTable";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PersonalDashboardProps {
  metrics: MemberMetrics;
  activityLogs?: ActivityLogEvent[];
  /** Server-rendered slot for the activity log. When provided, replaces the
   *  default <ActivityLogFeed> so the log can be streamed via Suspense from
   *  the parent Server Component (page.tsx). */
  activityLogSlot?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPACT_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

type DrillDownKey = "completed" | "pending" | "overdue" | "blocked";

const IMPACT_LABELS: Record<string, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

const DRILL_LABELS: Record<DrillDownKey, string> = {
  completed: "Tareas Completadas",
  pending: "Tareas Pendientes",
  overdue: "Tareas Atrasadas",
  blocked: "Tareas Bloqueadas",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const dateOnly = dateStr.substring(0, 10);
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function getTopPriorities(tasks: Task[]): Task[] {
  return tasks
    .filter(t => t.status === "pending" || t.status === "in_progress")
    .sort((a, b) => {
      const scoreA = (IMPACT_WEIGHT[a.impact ?? "low"] ?? 1) * 10 + (PRIORITY_WEIGHT[a.priority] ?? 1);
      const scoreB = (IMPACT_WEIGHT[b.impact ?? "low"] ?? 1) * 10 + (PRIORITY_WEIGHT[b.priority] ?? 1);
      return scoreB - scoreA;
    })
    .slice(0, 2);
}

function getDrillTasks(tasks: Task[], key: DrillDownKey): Task[] {
  switch (key) {
    case "completed":
      return tasks.filter(t => t.status === "completed");
    case "pending":
      return tasks.filter(t => t.status === "pending" || t.status === "in_progress");
    case "overdue":
      return tasks.filter(t => isOverdue(t));
    case "blocked":
      return tasks.filter(t => t.status === "blocked");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PersonalDashboard({
  metrics: initialMetrics,
  activityLogs = [],
  activityLogSlot,
}: PersonalDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRangeType>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [metrics, setMetrics] = useState<MemberMetrics>(initialMetrics);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownKey | null>(null);

  // Daily check-in state
  const [checkinClosed, setCheckinClosed] = useState<boolean | null>(null); // null = loading
  const [checkinMetrics, setCheckinMetrics] = useState<{ hours_worked: number; fires_handled: number; blocks_count: number; completion_pct: number } | null>(null);
  const [checkinSummary, setCheckinSummary] = useState<string | null>(null);
  const [showCheckinModal, setShowCheckinModal] = useState(false);

  const firstName = metrics.user.name.split(" ")[0];

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

  // Fetch daily check-in status
  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkins/today", { cache: "no-store" })
      .then(r => r.json())
      .then((data: { is_closed: boolean; metrics?: { hours_worked: number; fires_handled: number; blocks_count: number; completion_pct: number }; checkin?: { summary: string } }) => {
        if (cancelled) return;
        setCheckinClosed(data.is_closed);
        if (data.is_closed && data.checkin) {
          setCheckinSummary(data.checkin.summary);
        } else if (!data.is_closed && data.metrics) {
          setCheckinMetrics(data.metrics);
        }
      })
      .catch(() => { if (!cancelled) setCheckinClosed(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCheckinSuccess = useCallback((summary: string) => {
    setCheckinClosed(true);
    setCheckinSummary(summary);
    setShowCheckinModal(false);
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

    fetch(`/api/performance/me?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`API ${res.status}: ${body}`);
        }
        return res.json();
      })
      .then((data: MemberMetrics) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((err) => {
        console.error("Error fetching personal metrics:", err, "params:", params.toString());
        if (!cancelled) setError("Error al actualizar las métricas. Inténtalo de nuevo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateRange, customFrom, customTo, categoryFilter, typeFilter, initialMetrics]);

  // Derived data
  const topPriorities = getTopPriorities(metrics.tasks_list ?? []);
  const activeTasks = (metrics.tasks_list ?? []).filter(
    t => t.status === "pending" || t.status === "in_progress"
  ).length;

  // Stat cards data (clickable drill-down)
  const statCards: { key: DrillDownKey; label: string; value: number; icon: typeof CheckCircle2; iconClass: string; bgClass: string }[] = [
    { key: "completed", label: "Completadas", value: metrics.tasks_completed, icon: CheckCircle2, iconClass: "text-success-neon [filter:drop-shadow(0_0_6px_currentColor)]", bgClass: "bg-success-neon/5" },
    { key: "pending", label: "Pendientes", value: metrics.tasks_pending + metrics.tasks_in_progress, icon: Clock, iconClass: "text-electric-blue [filter:drop-shadow(0_0_6px_currentColor)]", bgClass: "bg-electric-blue/5" },
    { key: "overdue", label: "Atrasadas", value: metrics.tasks_overdue, icon: AlertTriangle, iconClass: metrics.tasks_overdue > 0 ? "text-warning-neon [filter:drop-shadow(0_0_6px_currentColor)]" : "text-text-muted", bgClass: metrics.tasks_overdue > 0 ? "bg-warning-neon/5" : "bg-white/[0.03]" },
    { key: "blocked", label: "Bloqueadas", value: metrics.tasks_blocked, icon: Ban, iconClass: metrics.tasks_blocked > 0 ? "text-danger-neon [filter:drop-shadow(0_0_6px_currentColor)]" : "text-text-muted", bgClass: metrics.tasks_blocked > 0 ? "bg-danger-neon/5" : "bg-white/[0.03]" },
  ];

  // Drill-down tasks
  const drillTasks = drillDown ? getDrillTasks(metrics.tasks_list ?? [], drillDown) : [];

  // Category lookup
  const catMap = new Map(categories.map(c => [c.id, c]));

  return (
    <div className="space-y-8">
      {/* ================================================================= */}
      {/* HEADER + FILTERS                                                  */}
      {/* ================================================================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-heading md:text-3xl">
            Modo Enfoque
          </h1>
          <p className="mt-1 text-sm capitalize text-text-muted" suppressHydrationWarning>
            {formatTodayDate()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-card-secondary p-1">
            {(["day", "week", "month", "custom"] as const).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setDateRange(range)}
                className={cn(
                  "rounded-md px-3 text-xs sm:text-sm sm:px-4",
                  dateRange !== range && "text-text-muted hover:text-white hover:bg-transparent"
                )}
              >
                {range === "day" ? "Día" : range === "week" ? "Semana" : range === "month" ? "Mes" : "Personalizado"}
              </Button>
            ))}
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
        </div>
      </div>

      {/* Custom date inputs + filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {dateRange === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-white/10 bg-card-secondary px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
            />
            <span className="text-xs text-text-muted">a</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-white/10 bg-card-secondary px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
            />
          </>
        )}

        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-text-muted" />
        </div>

        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none rounded-lg border border-white/10 bg-card-secondary py-1.5 pl-3 pr-8 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-accent"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none rounded-lg border border-white/10 bg-card-secondary py-1.5 pl-3 pr-8 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-accent"
          >
            <option value="all">Todos los tipos</option>
            <option value="planeada">Planeada</option>
            <option value="incendio">Incendio</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
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

      {/* ================================================================= */}
      {/* FILA 1: EL HÉROE — TUS 2 PRIORIDADES DE HOY                      */}
      {/* ================================================================= */}
      <section className="rounded-2xl border border-accent/20 bg-gradient-to-br from-background-secondary to-card p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-text-heading md:text-2xl" suppressHydrationWarning>
            {getGreeting()}, {firstName} 👋
          </h2>
          <p className="mt-1 text-sm text-text-muted">Este es tu Enfoque para hoy:</p>

          {/* Daily Check-in CTA */}
          {checkinClosed === true ? (
            // uipro: "Día Cerrado" — neon green achievement badge signals completion
            <Badge variant="success-neon" className="mt-3 gap-2 rounded-full px-4 py-2 text-sm font-medium">
              <CheckCheck className="h-4 w-4" />
              Día Cerrado
              {checkinSummary && (
                <span className="ml-1 max-w-xs truncate text-xs opacity-70">— {checkinSummary}</span>
              )}
            </Badge>
          ) : checkinClosed === false ? (
            // uipro: "Cerrar Día" is a positive completion CTA — variant="success" (neon green)
            <Button
              variant="success"
              onClick={() => setShowCheckinModal(true)}
              className="mt-3 gap-2"
            >
              <FileCheck className="h-4 w-4" />
              Cerrar Día
            </Button>
          ) : null}
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">
            Mis 2 Prioridades
          </h3>
        </div>

        {topPriorities.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {topPriorities.map((task) => {
              const overdue = isOverdue(task);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "group relative rounded-xl border bg-background/60 p-6 transition-all hover:border-white/20",
                    overdue ? "border-danger/30" : "border-white/10"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Badge
                      variant={task.status === "in_progress" ? "in_progress" : "pending"}
                      className="gap-1.5 rounded-full px-2.5 py-1"
                    >
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        task.status === "in_progress" ? "bg-status-in_progress" : "bg-status-pending"
                      )} />
                      {STATUS_LABELS[task.status]}
                    </Badge>

                    {task.task_type === "incendio" && (
                      <Badge variant="danger" className="gap-1 rounded-full px-2 py-0.5 text-[11px]">
                        <Flame className="h-3 w-3" /> Incendio
                      </Badge>
                    )}
                  </div>

                  <h4 className="mb-2 text-lg font-semibold leading-tight text-text-heading">
                    {task.title}
                  </h4>

                  {task.description && (
                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-muted">
                      {task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <div className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                      overdue
                        ? "border-danger-neon text-danger-neon [text-shadow:0_0_6px_currentColor]"
                        : "border-transparent bg-white/5 text-text"
                    )}>
                      <Clock className="h-3.5 w-3.5" />
                      {task.due_date ? formatDate(task.due_date) : "Sin fecha"}
                      {overdue && <span className="font-bold">• Atrasada</span>}
                    </div>

                    <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
                      <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} />
                      <span className="text-xs text-text">{PRIORITY_LABELS[task.priority]}</span>
                    </div>

                    {task.impact && (
                      <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
                        <Zap className="h-3 w-3 text-warning-neon [filter:drop-shadow(0_0_4px_currentColor)]" />
                        <span className="text-xs text-text">Impacto {IMPACT_LABELS[task.impact]}</span>
                      </div>
                    )}

                    {task.estimated_time != null && (
                      <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1">
                        <span className="text-xs text-text-muted">Est: {formatTimeSpent(task.estimated_time)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-text-muted">
              No tienes tareas pendientes. ¡Buen trabajo!
            </p>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* FILA 2: STAT CARDS INTERACTIVOS (Radar Operativo)                 */}
      {/* ================================================================= */}
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
                "h-auto w-full flex-col items-start rounded-xl border bg-card-secondary p-5 text-left hover:bg-card-secondary",
                isActive
                  ? "border-accent/40 shadow-lg shadow-accent/5"
                  : "border-white/5 hover:border-white/10"
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

      {/* Drill-down panel */}
      {drillDown && (
        <DrillDownTable
          title={DRILL_LABELS[drillDown]}
          tasks={drillTasks}
          catMap={catMap}
          blockReasons={metrics.block_reasons}
          showBlockReason={drillDown === "blocked"}
          onClose={() => setDrillDown(null)}
        />
      )}

      {/* ================================================================= */}
      {/* FILA 3: AUTOGESTIÓN Y CAPACIDAD (4-col grid)                      */}
      {/* Anillo + Tacómetro + Estimación + Estrés                          */}
      {/* ================================================================= */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <h2 className="text-lg font-semibold text-text-heading">Autogestión y Capacidad</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* --------------------------------------------------------------- */}
          {/* COL 1: ANILLO DE RENDIMIENTO (% Cumplimiento + Racha)           */}
          {/* --------------------------------------------------------------- */}
          <Card className="flex flex-col items-center justify-center p-5">
            <div className="relative flex h-32 w-32 items-center justify-center">
              {/* uipro: Completion Ring — Neon Traffic Light on Grey Blue track */}
              <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120">
                {/* Base track: Grey Blue structural — not distracting */}
                <circle cx="60" cy="60" r="52" fill="none" stroke="#2E3A48" strokeWidth="8" />
                {/* Arc: neon traffic light thresholds */}
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={
                    metrics.completion_pct >= 80 ? "#00E676"   // success-neon
                      : metrics.completion_pct >= 50 ? "#FFD740" // warning-neon
                        : "#FF5252"                               // danger-neon
                  }
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(metrics.completion_pct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                  className="transition-all duration-700"
                />
              </svg>
              <span className="text-3xl font-bold text-text-heading">{metrics.completion_pct}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-text-muted">% Cumplimiento</p>
            <p className="text-xs text-text-muted">
              {metrics.tasks_completed} de {metrics.tasks_total} tareas
            </p>
            {/* Racha inline */}
            <div className="mt-3 flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1">
              <Zap className="h-3.5 w-3.5 text-warning-neon [filter:drop-shadow(0_0_4px_currentColor)]" />
              <span className="text-xs font-medium text-text-heading">
                {metrics.streak} {metrics.streak === 1 ? "día" : "días"} de racha
              </span>
            </div>
          </Card>

          {/* --------------------------------------------------------------- */}
          {/* COL 2: CARGA COGNITIVA (Tacómetro)                              */}
          {/* uipro: Gauge Chart — "threshold colors", neon traffic light     */}
          {/* --------------------------------------------------------------- */}
          <Card className="p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                activeTasks <= 3 ? "bg-success-neon/10" : activeTasks <= 6 ? "bg-warning-neon/10" : "bg-danger-neon/10"
              )}>
                <Gauge className={cn(
                  "h-5 w-5",
                  activeTasks <= 3 ? "text-success-neon" : activeTasks <= 6 ? "text-warning-neon" : "text-danger-neon"
                )} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-heading">Carga Cognitiva</p>
                <p className="text-[11px] text-text-muted">Tareas activas simultáneas</p>
              </div>
            </div>

            <div className="flex justify-center py-2">
              <svg viewBox="0 0 200 120" className="h-28 w-44">
                {/* success-neon zone */}
                <path d="M 15 100 A 85 85 0 0 1 57.5 22.34" fill="none" stroke="#00E676" strokeWidth="14" strokeLinecap="round" opacity="0.25" />
                {/* warning-neon zone */}
                <path d="M 57.5 22.34 A 85 85 0 0 1 142.5 22.34" fill="none" stroke="#FFD740" strokeWidth="14" strokeLinecap="round" opacity="0.25" />
                {/* danger-neon zone */}
                <path d="M 142.5 22.34 A 85 85 0 0 1 185 100" fill="none" stroke="#FF5252" strokeWidth="14" strokeLinecap="round" opacity="0.25" />

                {(() => {
                  const clamped = Math.min(activeTasks, 10);
                  const angle = Math.PI * (1 - clamped / 10);
                  const cx = 100, cy = 100, r = 65;
                  const nx = cx + r * Math.cos(angle);
                  const ny = cy - r * Math.sin(angle);
                  const needleColor = activeTasks <= 3 ? "#00E676" : activeTasks <= 6 ? "#FFD740" : "#FF5252";
                  return (
                    <>
                      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth="3" strokeLinecap="round" />
                      <circle cx={nx} cy={ny} r="5" fill={needleColor} />
                      {/* Needle center — Carbon card color */}
                      <circle cx={cx} cy={cy} r="4" fill="#141418" stroke={needleColor} strokeWidth="2" />
                    </>
                  );
                })()}

                <text x="10"  y="115" fill="#00E676" fontSize="10" textAnchor="middle">0</text>
                <text x="57"  y="18"  fill="#FFD740" fontSize="10" textAnchor="middle">3</text>
                <text x="143" y="18"  fill="#FF5252" fontSize="10" textAnchor="middle">7</text>
                <text x="190" y="115" fill="#FF5252" fontSize="10" textAnchor="middle">10+</text>
                <text x="100" y="95"  fill="#F5F0E8" fontSize="28" fontWeight="700" textAnchor="middle">{activeTasks}</text>
              </svg>
            </div>

            <div className={cn(
              "mt-1 rounded-lg px-3 py-2 text-center text-xs font-medium",
              activeTasks <= 3 ? "bg-success-neon/10 text-success-neon"
                : activeTasks <= 6 ? "bg-warning-neon/10 text-warning-neon"
                  : "bg-danger-neon/10 text-danger-neon"
            )}>
              {activeTasks <= 3 ? "Tienes capacidad. Puedes asumir más."
                : activeTasks <= 6 ? "Carga moderada. Enfócate primero."
                  : "Sobrecarga. Prioriza y delega."}
            </div>
          </Card>

          {/* COL 3: PRECISIÓN DE ESTIMACIÓN */}
          <EstimationGauge gap={metrics.avg_estimation_gap} svgClassName="h-28 w-56" />

          {/* COL 4: NIVEL DE ESTRÉS */}
          <StressBar ratio={metrics.fire_ratio} />
        </div>
      </section>

      {/* ================================================================= */}
      {/* FILA 4: TU IMPACTO Y ACTIVIDAD                                   */}
      {/* ================================================================= */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <h2 className="text-lg font-semibold text-text-heading">Tu Valor Creado y Actividad</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* LEFT: VALUE MATRIX */}
          <ValueMatrix valueMatrix={metrics.value_matrix} cellMinHeight={90} />

          {/* RIGHT: ACTIVITY LOG — rendered via streaming slot when available */}
          <Card className="p-5">
            {activityLogSlot ?? (
              <ActivityLogFeed initialLogs={activityLogs} userId={initialMetrics.user.id} />
            )}
          </Card>
        </div>
      </section>

      {/* Daily Check-in Modal */}
      {checkinMetrics && (
        <DailyCheckinModal
          isOpen={showCheckinModal}
          onClose={() => setShowCheckinModal(false)}
          metrics={checkinMetrics}
          onSuccess={handleCheckinSuccess}
        />
      )}
    </div>
  );
}
