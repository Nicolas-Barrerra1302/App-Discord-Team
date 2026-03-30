"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  Target,
  Plus,
  Trash2,
  Users,
  BarChart3,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, parseDbNumeric } from "@/lib/utils";
import { ROLE_BADGE_COLORS, ROLE_LABELS, SELECT_CLASSES } from "@/lib/constants";
import { getWeekLabel } from "@/lib/kpis/week-helpers";
import { calculateKpiScores } from "@/lib/kpis/scoring";
import type { User, KpiDefinition, KpiSubmission, KpiTracking } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

type Tab = "definiciones" | "seguimiento";

type SubmissionRow = Pick<
  KpiSubmission,
  "id" | "user_id" | "week_start" | "status" | "submitted_at" | "total_points" | "max_possible"
>;

interface Props {
  initialUsers: Pick<User, "id" | "name" | "avatar_url" | "role">[];
  initialDefinitions: KpiDefinition[];
  weekStart: string;
  initialWeekSubmissions: SubmissionRow[];
}

// =============================================================================
// Static config
// =============================================================================

const DATA_TYPE_OPTIONS = [
  { value: "number", label: "Número" },
  { value: "boolean", label: "Sí / No" },
  { value: "percentage", label: "Porcentaje" },
] as const;

type DataType = (typeof DATA_TYPE_OPTIONS)[number]["value"];

const DATA_TYPE_BADGE: Record<DataType, { variant: "info" | "success" | "warning"; label: string }> = {
  number: { variant: "info", label: "Número" },
  boolean: { variant: "success", label: "Sí / No" },
  percentage: { variant: "warning", label: "%" },
};

const DIRECTION_OPTIONS = [
  { value: "asc", label: "Más es mejor (↑)" },
  { value: "desc", label: "Menos es mejor (↓)" },
] as const;

const EMPTY_FORM = {
  name: "",
  description: "",
  data_type: "number" as DataType,
  direction: "asc" as "asc" | "desc",
  target_value: "",
  max_points: "",
  assigned_to: "",
};

// =============================================================================
// Helpers
// =============================================================================

/** Advance a YYYY-MM-DD string by N days (UTC-safe noon anchor). */
function shiftWeek(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().substring(0, 10);
}

// =============================================================================
// Component
// =============================================================================

export function AdminKpisClient({
  initialUsers,
  initialDefinitions,
  weekStart,
  initialWeekSubmissions,
}: Props) {
  // ── Tab ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("definiciones");

  // ── Definiciones state ───────────────────────────────────────────────────────
  const [definitions, setDefinitions] = useState<KpiDefinition[]>(initialDefinitions);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Seguimiento state ────────────────────────────────────────────────────────
  const [selectedWeekStart, setSelectedWeekStart] = useState(weekStart);
  const [weekSubmissions, setWeekSubmissions] = useState<SubmissionRow[]>(initialWeekSubmissions);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedTracking, setExpandedTracking] = useState<KpiTracking[] | null>(null);
  const [expandingUserId, setExpandingUserId] = useState<string | null>(null);

  // Cache: "${weekStart}-${userId}" → KpiTracking[] — prevents re-fetching on repeated expand
  const trackingCacheRef = useRef(new Map<string, KpiTracking[]>());

  // ── Fast lookup maps ─────────────────────────────────────────────────────────

  const userMap = useMemo(() => {
    const map = new Map<string, typeof initialUsers[0]>();
    for (const u of initialUsers) map.set(u.id, u);
    return map;
  }, [initialUsers]);

  // Uses weekSubmissions (reactive) so the map stays up to date after week changes
  const submissionMap = useMemo(() => {
    const map = new Map<string, SubmissionRow>();
    for (const s of weekSubmissions) map.set(s.user_id, s);
    return map;
  }, [weekSubmissions]);

  // Group definitions by assigned user
  const definitionsByUser = useMemo(() => {
    const grouped = new Map<string, KpiDefinition[]>();
    for (const def of definitions) {
      const list = grouped.get(def.assigned_to) ?? [];
      grouped.set(def.assigned_to, [...list, def]);
    }
    return grouped;
  }, [definitions]);

  const activeCount = useMemo(
    () => definitions.filter((d) => d.is_active).length,
    [definitions]
  );

  // Filtered users for Seguimiento member search
  const filteredUsers = useMemo(() => {
    if (!memberFilter.trim()) return initialUsers;
    const q = memberFilter.toLowerCase();
    return initialUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [initialUsers, memberFilter]);

  // Whether the selected week is the current week (disable "next" navigation)
  const isCurrentWeek = selectedWeekStart === weekStart;

  // ── Form handlers ─────────────────────────────────────────────────────────────

  const handleFormChange = useCallback((field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      // Auto-set target_value when switching to boolean
      ...(field === "data_type" && value === "boolean" ? { target_value: "1" } : {}),
    }));
    setFormError(null);
  }, []);

  const handleCreateKpi = useCallback(async () => {
    if (!form.name.trim()) { setFormError("El nombre es requerido."); return; }
    if (!form.assigned_to) { setFormError("Selecciona un miembro asignado."); return; }

    const maxPts = parseInt(form.max_points, 10);
    if (!Number.isInteger(maxPts) || maxPts <= 0) {
      setFormError("Los puntos máximos deben ser un entero positivo.");
      return;
    }

    const targetVal = form.data_type === "boolean" ? 1 : parseFloat(form.target_value);
    if (isNaN(targetVal) || targetVal <= 0) {
      setFormError("La meta debe ser un número mayor a 0.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch("/api/kpis/definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          data_type: form.data_type,
          direction: form.direction,
          target_value: targetVal,
          max_points: maxPts,
          assigned_to: form.assigned_to,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setFormError(json.error ?? "Error al crear el KPI.");
        return;
      }

      const newDef: KpiDefinition = await res.json();
      setDefinitions((prev) => [...prev, newDef]);
      setForm(EMPTY_FORM);
    } catch {
      setFormError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleToggleActive = useCallback(async (def: KpiDefinition) => {
    setTogglingId(def.id);
    try {
      const res = await fetch(`/api/kpis/definitions/${def.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !def.is_active }),
      });
      if (res.ok) {
        const updated: KpiDefinition = await res.json();
        setDefinitions((prev) => prev.map((d) => (d.id === def.id ? updated : d)));
      }
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (defId: string) => {
    if (!confirm("¿Eliminar este KPI? Si tiene historial, será desactivado.")) return;
    setDeletingId(defId);
    try {
      const res = await fetch(`/api/kpis/definitions/${defId}`, { method: "DELETE" });
      if (res.ok) {
        const result = await res.json();
        if (result.soft) {
          setDefinitions((prev) =>
            prev.map((d) => (d.id === defId ? { ...d, is_active: false } : d))
          );
        } else {
          setDefinitions((prev) => prev.filter((d) => d.id !== defId));
        }
      }
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ── Seguimiento handlers ───────────────────────────────────────────────────────

  /**
   * Navigate to a different week. Fetches all users' submissions + tracking
   * for the new week in parallel (team is small — max 6 calls). Results are
   * cached so expanding rows afterward doesn't trigger additional API calls.
   */
  const handleWeekChange = useCallback(
    async (newWeekStart: string) => {
      setSelectedWeekStart(newWeekStart);
      setExpandedUserId(null);
      setExpandedTracking(null);
      setLoadingWeek(true);

      try {
        const results = await Promise.all(
          initialUsers.map(async (u) => {
            const cacheKey = `${newWeekStart}-${u.id}`;
            const res = await fetch(
              `/api/kpis/tracking?week_start=${newWeekStart}&user_id=${u.id}`
            );
            if (!res.ok) return null;
            const json = (await res.json()) as {
              tracking: KpiTracking[];
              submission: SubmissionRow | null;
            };
            // Cache tracking for the new week
            trackingCacheRef.current.set(cacheKey, json.tracking ?? []);
            return json.submission ?? null;
          })
        );

        setWeekSubmissions(
          results.filter((s): s is SubmissionRow => s !== null)
        );
      } finally {
        setLoadingWeek(false);
      }
    },
    [initialUsers]
  );

  /**
   * Toggle expanded row for a member. On first expand for a given week+user,
   * fetches tracking via API and caches it. Subsequent expands are instant.
   */
  const handleExpandUser = useCallback(
    async (userId: string) => {
      if (expandedUserId === userId) {
        setExpandedUserId(null);
        setExpandedTracking(null);
        return;
      }

      setExpandedUserId(userId);

      const cacheKey = `${selectedWeekStart}-${userId}`;
      const cached = trackingCacheRef.current.get(cacheKey);
      if (cached) {
        setExpandedTracking(cached);
        return;
      }

      setExpandingUserId(userId);
      try {
        const res = await fetch(
          `/api/kpis/tracking?week_start=${selectedWeekStart}&user_id=${userId}`
        );
        if (!res.ok) {
          setExpandedTracking([]);
          return;
        }
        const json = (await res.json()) as { tracking: KpiTracking[] };
        const tracking = json.tracking ?? [];
        trackingCacheRef.current.set(cacheKey, tracking);
        setExpandedTracking(tracking);
      } finally {
        setExpandingUserId(null);
      }
    },
    [expandedUserId, selectedWeekStart]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-heading">KPIs del Equipo</h1>
        <p className="mt-1 text-sm text-text-muted">
          Define métricas de desempeño y monitorea el progreso semanal.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-card-secondary p-1 w-fit">
        {(
          [
            { id: "definiciones" as Tab, label: "Definiciones", icon: Target },
            { id: "seguimiento" as Tab, label: "Seguimiento Semanal", icon: BarChart3 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-accent text-white"
                : "text-text-muted hover:bg-white/5 hover:text-text"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Definiciones ─────────────────────────────────────────────────── */}
      {activeTab === "definiciones" && (
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Create form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-accent" />
                Nuevo KPI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* assigned_to */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Miembro asignado
                </label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => handleFormChange("assigned_to", e.target.value)}
                  className={SELECT_CLASSES}
                >
                  <option value="">Seleccionar miembro...</option>
                  {initialUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Nombre del KPI
                </label>
                <Input
                  placeholder="e.g. Videos Publicados"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              {/* data_type */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Tipo de dato
                </label>
                <select
                  value={form.data_type}
                  onChange={(e) => handleFormChange("data_type", e.target.value)}
                  className={SELECT_CLASSES}
                >
                  {DATA_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* direction */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Dirección de la Métrica
                </label>
                <select
                  value={form.direction}
                  onChange={(e) => handleFormChange("direction", e.target.value)}
                  className={SELECT_CLASSES}
                >
                  {DIRECTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-text-muted">
                  {form.direction === "asc"
                    ? "Se premia alcanzar o superar la meta."
                    : "Se premia mantenerse igual o por debajo de la meta (ej. incidentes, errores)."}
                </p>
              </div>

              {/* target_value — hidden for boolean (auto = 1) */}
              {form.data_type !== "boolean" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-muted">
                    {form.data_type === "percentage" ? "Meta (%)" : "Meta (unidades)"}
                  </label>
                  <Input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder={form.data_type === "percentage" ? "90" : "5"}
                    value={form.target_value}
                    onChange={(e) => handleFormChange("target_value", e.target.value)}
                  />
                </div>
              )}

              {/* max_points */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Puntos máximos
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="10"
                  value={form.max_points}
                  onChange={(e) => handleFormChange("max_points", e.target.value)}
                />
              </div>

              {/* description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">
                  Descripción (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ayuda para el miembro al llenar este KPI..."
                  value={form.description}
                  onChange={(e) => handleFormChange("description", e.target.value)}
                  className={cn(SELECT_CLASSES, "resize-none")}
                />
              </div>

              {/* Error message */}
              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <Button onClick={handleCreateKpi} isLoading={saving} className="w-full">
                <Plus className="h-4 w-4" />
                Crear KPI
              </Button>
            </CardContent>
          </Card>

          {/* Definitions table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-accent" />
                KPIs Definidos
                <span className="ml-auto text-sm font-normal text-text-muted">
                  {activeCount} activos · {definitions.length} total
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {definitionsByUser.size === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-text-muted">
                  No hay KPIs definidos aún. Crea el primero con el formulario.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {Array.from(definitionsByUser.entries()).map(([userId, defs]) => {
                    const u = userMap.get(userId);
                    const activeForUser = defs.filter((d) => d.is_active).length;

                    return (
                      <div key={userId}>
                        {/* User group header */}
                        <div className="flex items-center gap-2.5 bg-card px-4 py-2.5">
                          {u?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={u.avatar_url}
                              alt={u.name}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                              {u?.name.charAt(0).toUpperCase() ?? "?"}
                            </div>
                          )}
                          <span className="text-sm font-semibold text-text">
                            {u?.name ?? userId}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                              ROLE_BADGE_COLORS[u?.role ?? "member"]
                            )}
                          >
                            {ROLE_LABELS[u?.role ?? "member"]}
                          </span>
                          <span className="ml-auto text-xs text-text-muted">
                            {activeForUser} activo{activeForUser !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* KPI rows */}
                        {defs.map((def) => (
                          <div
                            key={def.id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]",
                              !def.is_active && "opacity-50"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium text-text">
                                  {def.name}
                                </span>
                                <Badge variant={DATA_TYPE_BADGE[def.data_type as DataType]?.variant ?? "outline"}>
                                  {DATA_TYPE_BADGE[def.data_type as DataType]?.label ?? def.data_type}
                                </Badge>
                                {def.direction === "desc" && (
                                  <Badge variant="outline">Menos es mejor ↓</Badge>
                                )}
                                {!def.is_active && (
                                  <Badge variant="outline">Inactivo</Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-text-muted">
                                Meta:{" "}
                                {def.data_type === "boolean"
                                  ? "Sí / No"
                                  : `${parseDbNumeric(def.target_value as string)}${
                                      def.data_type === "percentage" ? "%" : " uds."
                                    }`}
                                {" · "}
                                <span className="font-medium text-accent">
                                  {def.max_points} pts máx.
                                </span>
                              </p>
                              {def.description && (
                                <p className="mt-0.5 truncate text-xs text-text-muted">
                                  {def.description}
                                </p>
                              )}
                            </div>

                            {/* Toggle active */}
                            <button
                              onClick={() => handleToggleActive(def)}
                              disabled={togglingId === def.id}
                              title={def.is_active ? "Desactivar KPI" : "Activar KPI"}
                              className="rounded p-1 text-text-muted transition-colors hover:text-text disabled:opacity-40"
                            >
                              {def.is_active ? (
                                <ToggleRight className="h-5 w-5 text-success" />
                              ) : (
                                <ToggleLeft className="h-5 w-5" />
                              )}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(def.id)}
                              disabled={deletingId === def.id}
                              title="Eliminar KPI"
                              className="rounded p-1 text-text-muted transition-colors hover:text-danger disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Seguimiento Semanal ────────────────────────────────────────── */}
      {activeTab === "seguimiento" && (
        <div className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Week navigator */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card-secondary px-3 py-2">
              <button
                onClick={() => handleWeekChange(shiftWeek(selectedWeekStart, -1))}
                disabled={loadingWeek}
                className="rounded p-0.5 text-text-muted transition-colors hover:text-text disabled:opacity-40"
                title="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[180px] text-center text-sm font-medium text-text">
                {loadingWeek ? (
                  <span className="flex items-center justify-center gap-1.5 text-text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando…
                  </span>
                ) : (
                  getWeekLabel(selectedWeekStart)
                )}
              </span>
              <button
                onClick={() => handleWeekChange(shiftWeek(selectedWeekStart, 1))}
                disabled={loadingWeek || isCurrentWeek}
                className="rounded p-0.5 text-text-muted transition-colors hover:text-text disabled:opacity-40"
                title={isCurrentWeek ? "Semana actual (no hay futuro)" : "Semana siguiente"}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Member filter */}
            <div className="relative flex-1 min-w-[200px] max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar miembro..."
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className={cn(SELECT_CLASSES, "pl-8 py-2 h-auto")}
              />
            </div>
          </div>

          {/* Tracking table */}
          <Card>
            <CardContent className="p-0">
              {filteredUsers.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-text-muted">
                  No se encontraron miembros.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted w-8" />
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Miembro
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          KPIs activos
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Puntos semana
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const sub = submissionMap.get(u.id);
                        const kpiCount = definitions.filter(
                          (d) => d.assigned_to === u.id && d.is_active
                        ).length;
                        const earned = sub
                          ? parseDbNumeric(sub.total_points as string | null)
                          : null;
                        const maxPossible = sub
                          ? parseDbNumeric(sub.max_possible as string | null)
                          : null;
                        const isExpanded = expandedUserId === u.id;
                        const isExpanding = expandingUserId === u.id;

                        return [
                          // ── Main row ────────────────────────────────────────
                          <tr
                            key={u.id}
                            onClick={() => handleExpandUser(u.id)}
                            className={cn(
                              "border-b border-border cursor-pointer transition-colors hover:bg-white/[0.03]",
                              isExpanded && "bg-white/[0.02]"
                            )}
                          >
                            {/* Expand chevron */}
                            <td className="pl-4 pr-2 py-3 text-text-muted">
                              {isExpanding ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {u.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={u.avatar_url}
                                    alt={u.name}
                                    className="h-7 w-7 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                                    {u.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-medium text-text">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-text-muted">
                              {kpiCount === 0 ? (
                                <span className="text-xs italic">Sin KPIs</span>
                              ) : (
                                `${kpiCount} KPI${kpiCount !== 1 ? "s" : ""}`
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {sub?.status === "submitted" && earned !== null ? (
                                <span className="font-semibold text-text">
                                  {earned}{" "}
                                  <span className="font-normal text-text-muted">
                                    / {maxPossible ?? "—"} pts
                                  </span>
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {!sub ? (
                                <Badge variant="outline">Sin iniciar</Badge>
                              ) : sub.status === "submitted" ? (
                                <Badge variant="success">Enviado</Badge>
                              ) : (
                                <Badge variant="warning">Borrador</Badge>
                              )}
                            </td>
                          </tr>,

                          // ── Expanded row ────────────────────────────────────
                          isExpanded && (
                            <tr key={`${u.id}-expanded`} className="border-b border-border">
                              <td colSpan={5} className="p-0">
                                <ExpandedKpiDetail
                                  user={u}
                                  definitions={definitions.filter(
                                    (d) => d.assigned_to === u.id && d.is_active
                                  )}
                                  tracking={expandedTracking ?? []}
                                  isLoading={isExpanding}
                                />
                              </td>
                            </tr>
                          ),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ExpandedKpiDetail — per-KPI breakdown inside collapsible row
// =============================================================================

interface ExpandedKpiDetailProps {
  user: Pick<User, "id" | "name" | "avatar_url" | "role">;
  definitions: KpiDefinition[];
  tracking: KpiTracking[];
  isLoading: boolean;
}

function ExpandedKpiDetail({ definitions, tracking, isLoading }: ExpandedKpiDetailProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 bg-card-secondary px-8 py-4 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando detalle…
      </div>
    );
  }

  if (definitions.length === 0) {
    return (
      <div className="bg-card-secondary px-8 py-4 text-sm text-text-muted italic">
        Sin KPIs activos asignados.
      </div>
    );
  }

  const scoring = calculateKpiScores(definitions, tracking);

  return (
    <div className="bg-card-secondary">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50">
            <th className="pl-8 pr-4 py-2 text-left font-semibold uppercase tracking-wide text-text-muted">
              KPI
            </th>
            <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-text-muted">
              Meta
            </th>
            <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-text-muted">
              Valor enviado
            </th>
            <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-text-muted pr-8">
              Puntos
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {scoring.perKpi.map((score) => {
            const def = definitions.find((d) => d.id === score.kpi_id);
            if (!def) return null;

            const t = tracking.find((tr) => tr.kpi_id === def.id);
            const pct = score.max_points > 0 ? score.earned / score.max_points : 0;

            let displayValue = "—";
            if (t?.value !== null && t?.value !== undefined) {
              const num = parseDbNumeric(t.value as string);
              if (def.data_type === "boolean") {
                displayValue = num >= 1 ? "Sí ✓" : "No ✗";
              } else if (def.data_type === "percentage") {
                displayValue = `${num}%`;
              } else {
                displayValue = String(num);
              }
            }

            return (
              <tr key={score.kpi_id} className="hover:bg-white/[0.01]">
                <td className="pl-8 pr-4 py-2">
                  <span className="font-medium text-text">{def.name}</span>
                  {def.direction === "desc" && (
                    <span className="ml-1.5 text-text-muted opacity-70">↓</span>
                  )}
                </td>
                <td className="px-4 py-2 text-text-muted">
                  {def.data_type === "boolean"
                    ? "Sí / No"
                    : `${parseDbNumeric(def.target_value as string)}${
                        def.data_type === "percentage" ? "%" : " uds."
                      }`}
                </td>
                <td className="px-4 py-2 text-text-muted">{displayValue}</td>
                <td className="px-4 py-2 text-right pr-8">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      pct >= 1
                        ? "text-success"
                        : pct > 0
                        ? "text-warning"
                        : "text-text-muted"
                    )}
                  >
                    {score.earned}
                  </span>
                  <span className="font-normal text-text-muted"> / {score.max_points}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/50">
            <td colSpan={3} className="pl-8 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
              Total
            </td>
            <td className="pr-8 py-2 text-right text-xs font-bold text-accent tabular-nums">
              {Math.round(scoring.total * 10) / 10} / {scoring.maxPossible} pts
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
