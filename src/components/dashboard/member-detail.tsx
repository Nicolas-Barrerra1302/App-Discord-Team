"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  TrendingUp,
  Loader2,
  X,
  ChevronDown,
  Filter,
  Target,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/tasks";
import {
  formatChartDate,
  ChartTooltip,
} from "@/lib/dashboard/utils";
import { ActivityLogFeed, type ActivityLogEvent } from "@/components/shared/ActivityLogFeed";
import { TaskHistoryTable } from "@/components/shared/TaskHistoryTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants";
import { EstimationGauge } from "./shared/EstimationGauge";
import { StressBar } from "./shared/StressBar";
import { ValueMatrix } from "./shared/ValueMatrix";
import { DrillDownTable } from "./shared/DrillDownTable";
import type {
  MemberMetrics,
  Task,
  User,
  TaskCategory,
  DateRangeType,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MemberDetailProps {
  metrics: MemberMetrics;
  activityLogs?: ActivityLogEvent[];
  allUsers: User[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DrillDownKey = "completed_on_time" | "overdue" | "completed_today" | "blocked";

const DRILL_LABELS: Record<DrillDownKey, string> = {
  completed_on_time: "Completadas a Tiempo",
  overdue: "Tareas Atrasadas",
  completed_today: "Completadas Hoy",
  blocked: "Tareas Bloqueadas",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCompletedOnTime(t: Task): boolean {
  if (t.status !== "completed" || !t.completed_at) return false;
  if (!t.due_date) return true; // no due_date = on time by definition
  return t.completed_at.substring(0, 10) <= t.due_date.substring(0, 10);
}

function getDrillTasks(tasks: Task[], key: DrillDownKey): Task[] {
  const now = new Date();
  const todayStr = now.toISOString().substring(0, 10);

  switch (key) {
    case "completed_on_time":
      return tasks.filter(t => isCompletedOnTime(t));
    case "overdue":
      return tasks.filter(t => isOverdue(t));
    case "completed_today":
      return tasks.filter(t =>
        t.status === "completed" && t.completed_at && t.completed_at.substring(0, 10) === todayStr
      );
    case "blocked":
      return tasks.filter(t => t.status === "blocked");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberDetail({
  metrics: initialMetrics,
  activityLogs = [],
  allUsers,
}: MemberDetailProps) {
  const router = useRouter();
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

  const userId = initialMetrics.user_id;

  // Fetch categories on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/categories")
      .then(r => r.ok ? r.json() : [])
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
    if (dateRange === "custom" && (!customFrom || !customTo)) return;

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

    fetch(`/api/performance/${userId}?${params}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: MemberMetrics) => {
        if (!cancelled) setMetrics(data);
      })
      .catch(() => {
        if (!cancelled) setError("Error al actualizar las metricas. Intentalo de nuevo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateRange, customFrom, customTo, categoryFilter, typeFilter, userId, initialMetrics]);

  // Chart data — defensively handle single-element arrays
  const chartData = metrics.weekly_data.map((point) => ({
    ...point,
    label: formatChartDate(point.date),
  }));
  const isSinglePoint = chartData.length === 1;

  // Stat cards (some clickable for drill-down)
  const statCards: {
    key: DrillDownKey | null;
    label: string;
    value: string;
    suffix?: string;
    icon: typeof CheckCircle2;
    iconClass: string;
    bgClass: string;
    textColorClass?: string;
  }[] = [
    {
      key: null,
      label: "% Cumplimiento",
      value: `${metrics.completion_pct}%`,
      icon: TrendingUp,
      iconClass: metrics.completion_pct >= 80 ? "text-success-neon [filter:drop-shadow(0_0_6px_currentColor)]" : metrics.completion_pct >= 50 ? "text-warning-neon [filter:drop-shadow(0_0_6px_currentColor)]" : "text-danger-neon [filter:drop-shadow(0_0_6px_currentColor)]",
      bgClass: metrics.completion_pct >= 80 ? "bg-success-neon/5" : metrics.completion_pct >= 50 ? "bg-warning-neon/5" : "bg-danger-neon/5",
    },
    {
      key: null,
      label: "Velocidad Promedio",
      value: metrics.avg_speed_hours !== null ? `${metrics.avg_speed_hours} hrs` : "\u2014",
      icon: Clock,
      iconClass: "text-electric-blue [filter:drop-shadow(0_0_6px_currentColor)]",
      bgClass: "bg-electric-blue/5",
    },
    {
      key: null,
      label: "Racha",
      value: `${metrics.streak}`,
      suffix: metrics.streak === 1 ? " dia" : " dias",
      icon: Zap,
      iconClass: "text-warning-neon [filter:drop-shadow(0_0_6px_currentColor)]",
      bgClass: "bg-warning-neon/5",
    },
    {
      key: "completed_on_time",
      label: "Completadas a tiempo",
      value: `${metrics.tasks_completed_on_time}`,
      suffix: ` de ${metrics.tasks_completed}`,
      icon: CheckCircle2,
      iconClass: "text-success-neon [filter:drop-shadow(0_0_6px_currentColor)]",
      bgClass: "bg-success-neon/5",
    },
    {
      key: "overdue",
      label: "Tareas atrasadas",
      value: `${metrics.tasks_overdue}`,
      icon: AlertTriangle,
      iconClass: metrics.tasks_overdue > 0 ? "text-warning-neon [filter:drop-shadow(0_0_6px_currentColor)]" : "text-text-muted",
      bgClass: metrics.tasks_overdue > 0 ? "bg-warning-neon/5" : "bg-white/[0.03]",
      textColorClass: metrics.tasks_overdue > 0 ? "text-danger-neon [text-shadow:0_0_8px_currentColor]" : undefined,
    },
    {
      key: "completed_today",
      label: "Completadas hoy",
      value: `${metrics.tasks_completed_today}`,
      icon: CheckCircle2,
      iconClass: "text-success-neon [filter:drop-shadow(0_0_6px_currentColor)]",
      bgClass: "bg-success-neon/5",
    },
  ];

  // Drill-down data
  const drillTasks = drillDown ? getDrillTasks(metrics.tasks_list ?? [], drillDown) : [];
  const catMap = new Map(categories.map(c => [c.id, c]));

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------------- */}
      {/* Header row                                                       */}
      {/* --------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {metrics.user.avatar_url ? (
              <Image src={metrics.user.avatar_url} alt={metrics.user.name} width={48} height={48} className="rounded-full" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-lg font-bold text-accent">
                {metrics.user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-text-heading sm:text-2xl">{metrics.user.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {ROLE_LABELS[metrics.user.role] ?? metrics.user.role}
                </Badge>
                {metrics.user.area && <span className="text-xs text-text-muted">{metrics.user.area}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={userId}
            onChange={(e) => router.push(`/admin/member/${e.target.value}`)}
            className="rounded-lg border border-border bg-card-secondary px-3 py-1.5 text-sm text-text outline-none transition-colors hover:border-white/20 focus:border-accent"
          >
            {allUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
          </select>

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

      {/* --------------------------------------------------------------- */}
      {/* 6 stat cards (2x3 grid) — some clickable                        */}
      {/* --------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const isClickable = stat.key !== null;
          const isActive = drillDown !== null && drillDown === stat.key;
          const Tag = isClickable ? "button" : "div";
          return (
            <Tag
              key={stat.label}
              {...(isClickable ? { onClick: () => setDrillDown(isActive ? null : stat.key!) } : {})}
              className={cn(
                "rounded-xl border bg-card-secondary p-5 transition-all text-left",
                isActive
                  ? "border-accent/40 shadow-lg shadow-accent/5"
                  : "border-border hover:border-white/10",
                isClickable && "cursor-pointer"
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bgClass)}>
                  <Icon className={cn("h-5 w-5", stat.iconClass)} />
                </div>
                <p className="text-sm text-text-muted">{stat.label}</p>
              </div>
              <p className={cn("text-3xl font-bold", stat.textColorClass ?? "text-text")}>
                {stat.value}
                {stat.suffix && <span className="text-base font-normal text-text-muted">{stat.suffix}</span>}
              </p>
            </Tag>
          );
        })}
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Drill-down panel                                                 */}
      {/* --------------------------------------------------------------- */}
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

      {/* --------------------------------------------------------------- */}
      {/* Charts section (side by side on lg)                               */}
      {/* --------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Burn-Up Chart */}
        <Card className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-electric-blue" />
            <h3 className="text-sm font-medium text-text-heading">Burn-Up Chart</h3>
          </div>
          <p className="mb-4 text-[11px] text-text-muted">Scope acumulado vs Completadas — el espacio entre líneas es el backlog</p>
          {chartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="scopeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2196f3" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#2196f3" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00e676" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#00e676" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#9e9e9e", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9e9e9e", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#9e9e9e" }}
                    formatter={(value: unknown, name: unknown) => [
                      String(value),
                      String(name) === "scope" ? "Scope Total" : "Completadas",
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#9e9e9e" }}
                    formatter={(value: unknown) => String(value) === "scope" ? "Scope Total" : "Completadas"}
                  />
                  <Area type="monotone" dataKey="scope" stroke="#2196f3" strokeWidth={2} fill="url(#scopeGrad)"
                    dot={{ fill: "#2196f3", r: isSinglePoint ? 5 : 2 }}
                    activeDot={{ fill: "#2196f3", r: 5, stroke: "#fff", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="cumulative_completed" stroke="#00e676" strokeWidth={2} fill="url(#completedGrad)"
                    dot={{ fill: "#00e676", r: isSinglePoint ? 5 : 2 }}
                    activeDot={{ fill: "#00e676", r: 5, stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-text-muted">Sin datos para este periodo</div>
          )}
        </Card>

        {/* Line chart -- % Cumplimiento */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-medium text-text-heading">% Cumplimiento</h3>
          </div>
          {chartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#9e9e9e", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9e9e9e", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="completion_pct" stroke="#00FF7F" strokeWidth={isSinglePoint ? 0 : 2}
                    dot={{ fill: "#00FF7F", r: isSinglePoint ? 6 : 3 }}
                    activeDot={{ fill: "#00FF7F", r: isSinglePoint ? 8 : 5, stroke: "#0C0C0C", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center text-sm text-text-muted">Sin datos para este periodo</div>
          )}
        </Card>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Coaching Metrics — Visual Redesign                               */}
      {/* --------------------------------------------------------------- */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-accent" />
          <h2 className="text-lg font-semibold text-text-heading">Coaching</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 1. GAUGE: Precisión de Estimación */}
          <EstimationGauge gap={metrics.avg_estimation_gap} />

          {/* 2. STRESS BAR: Ratio de Incendios */}
          <StressBar ratio={metrics.fire_ratio} />

          {/* 3. QUADRANT: Matriz de Valor */}
          <ValueMatrix valueMatrix={metrics.value_matrix} colSpan />
        </div>
      </div>

      {/* --------------------------------------------------------------- */}
      {/* Tasks history table (with hybrid pagination)                     */}
      {/* --------------------------------------------------------------- */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success-neon [filter:drop-shadow(0_0_6px_currentColor)]" />
          <h2 className="text-lg font-semibold text-text-heading">Historial de Tareas</h2>
        </div>

        <TaskHistoryTable
          initialTasks={metrics.tasks_list ?? []}
          userId={metrics.user.id}
          categories={categories}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Activity Log Timeline                                              */}
      {/* ----------------------------------------------------------------- */}
      <ActivityLogFeed initialLogs={activityLogs} userIdsFilter={[initialMetrics.user.id]} />
    </div>
  );
}
