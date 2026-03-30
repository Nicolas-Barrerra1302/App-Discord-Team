"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Lock,
  AlertTriangle,
  Save,
  Send,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, parseDbNumeric } from "@/lib/utils";
import { getWeekLabel } from "@/lib/kpis/week-helpers";
import { calculateKpiScores } from "@/lib/kpis/scoring";
import type { KpiDefinition, KpiTracking, KpiSubmission } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface Props {
  definitions: KpiDefinition[];
  initialTracking: KpiTracking[];
  initialSubmission: KpiSubmission | null;
  weekStart: string;
  /** UTC ISO string from getDeadlineUtc() — Sunday 23:59 COT as UTC */
  deadlineUtc: string;
  /** Computed server-side at request time via isBeforeDeadline() */
  serverDeadlinePassed: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expirado";
  const totalSecs = Math.floor(ms / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function buildMockTracking(defId: string, weekStart: string, value: string | null): KpiTracking {
  return {
    id: `mock-${defId}`,
    user_id: "",
    kpi_id: defId,
    week_start: weekStart,
    value,
    created_at: "",
    updated_at: "",
  };
}

// =============================================================================
// Component
// =============================================================================

export function KpisClient({
  definitions,
  initialTracking,
  initialSubmission,
  weekStart,
  deadlineUtc,
  serverDeadlinePassed,
}: Props) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [trackingData, setTrackingData] = useState<KpiTracking[]>(initialTracking);
  const [submission, setSubmission] = useState<KpiSubmission | null>(initialSubmission);

  // Form values: kpi_id → input string (empty string = unfilled)
  // String() cast ensures Supabase numeric values (may arrive as JS number) compare
  // correctly against the "1"/"0" strings used by the boolean toggle buttons.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const def of definitions) {
      const t = initialTracking.find((tr) => tr.kpi_id === def.id);
      init[def.id] =
        t?.value !== null && t?.value !== undefined ? String(t.value) : "";
    }
    return init;
  });

  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Countdown state — starts at 0 to avoid SSR mismatch, fills after mount
  const [msRemaining, setMsRemaining] = useState(0);
  const [isExpiredClient, setIsExpiredClient] = useState(false);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isSubmitted = submission?.status === "submitted";
  const isExpired = serverDeadlinePassed || isExpiredClient;
  const canEdit = !isSubmitted && !isExpired;

  // ── Countdown ticker (COT deadline from getDeadlineUtc) ────────────────────
  // deadlineUtc is Sunday 23:59:59.999 COT expressed as UTC ISO string
  // We only use Date.now() to compute elapsed milliseconds — the deadline
  // itself comes from the server-side week helper, not from local logic.

  useEffect(() => {
    if (serverDeadlinePassed || isSubmitted) return;

    const deadlineMs = new Date(deadlineUtc).getTime();

    const tick = () => {
      const remaining = deadlineMs - Date.now();
      if (remaining <= 0) {
        setIsExpiredClient(true);
        setMsRemaining(0);
      } else {
        setMsRemaining(remaining);
      }
    };

    tick(); // run immediately on mount
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadlineUtc, serverDeadlinePassed, isSubmitted]);

  // ── Countdown color ────────────────────────────────────────────────────────

  const countdownColor = useMemo(() => {
    const hours = msRemaining / 3_600_000;
    if (hours > 24) return "text-success-neon [text-shadow:0_0_8px_currentColor]";
    if (hours > 1) return "text-warning-neon [text-shadow:0_0_8px_currentColor]";
    return "text-danger-neon [text-shadow:0_0_8px_currentColor]";
  }, [msRemaining]);

  // ── Live scoring — built from current form values (before save) ───────────

  const liveScoring = useMemo(() => {
    if (definitions.length === 0) return null;
    const mockTracking = definitions.map((def) =>
      buildMockTracking(def.id, weekStart, values[def.id] !== "" ? values[def.id] : null)
    );
    return calculateKpiScores(definitions, mockTracking);
  }, [definitions, values, weekStart]);

  // Index live score by kpi_id for O(1) per-row access
  const liveScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    if (liveScoring) {
      for (const s of liveScoring.perKpi) map.set(s.kpi_id, s.earned);
    }
    return map;
  }, [liveScoring]);

  // ── Saved scoring — built from persisted tracking (for read-only view) ─────

  const savedScoring = useMemo(
    () => calculateKpiScores(definitions, trackingData),
    [definitions, trackingData]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleValueChange = useCallback((defId: string, val: string) => {
    setValues((prev) => ({ ...prev, [defId]: val }));
    setApiError(null);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    setSavingDraft(true);
    setApiError(null);
    try {
      const entries = definitions.map((def) => ({
        kpi_id: def.id,
        value: values[def.id] !== "" ? parseFloat(values[def.id]) : null,
      }));

      const res = await fetch("/api/kpis/tracking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, entries }),
      });

      if (!res.ok) {
        const json = await res.json();
        setApiError(json.error ?? "Error al guardar el borrador.");
        return;
      }

      const json = await res.json();
      if (json.tracking) setTrackingData(json.tracking);
      if (json.submission) setSubmission(json.submission);
    } catch {
      setApiError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSavingDraft(false);
    }
  }, [definitions, values, weekStart]);

  const handleSubmit = useCallback(async () => {
    if (
      !window.confirm(
        "¿Estás seguro?\n\nEsta acción es irreversible. Una vez enviados, los valores de esta semana quedan cerrados definitivamente y no se pueden modificar."
      )
    )
      return;

    setSubmitting(true);
    setApiError(null);
    try {
      // Send current in-memory values as entries so the server always scores the
      // latest state — fixes the race condition when Submit is clicked without
      // first clicking Save Draft (server would otherwise read empty DB rows).
      const entries = definitions.map((def) => ({
        kpi_id: def.id,
        value: values[def.id] !== "" ? parseFloat(values[def.id]) : null,
      }));

      const res = await fetch("/api/kpis/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, entries }),
      });

      if (!res.ok) {
        const json = await res.json();
        setApiError(json.error ?? "Error al enviar los KPIs.");
        return;
      }

      const json = await res.json();
      if (json.submission) setSubmission(json.submission);

      // Sync local tracking state with what was just submitted.
      // This is critical when Submit is clicked without first clicking Save Draft:
      // trackingData would still be empty, making the read-only view show 0 pts.
      // We rebuild it from the current form values (same data the server just upserted).
      const submittedTracking: KpiTracking[] = definitions.map((def) => ({
        id: `submitted-${def.id}`,
        user_id: "",
        kpi_id: def.id,
        week_start: weekStart,
        value: values[def.id] !== "" ? values[def.id] : null,
        created_at: "",
        updated_at: new Date().toISOString(),
      }));
      setTrackingData(submittedTracking);
    } catch {
      setApiError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }, [weekStart, definitions, values]);

  // ── Value display for read-only view ───────────────────────────────────────

  const getValueDisplay = useCallback(
    (def: KpiDefinition) => {
      const t = trackingData.find((tr) => tr.kpi_id === def.id);
      if (!t || t.value === null) return "—";
      if (def.data_type === "boolean") {
        return parseDbNumeric(t.value) >= 1 ? "Sí ✓" : "No ✗";
      }
      const num = parseDbNumeric(t.value);
      return def.data_type === "percentage" ? `${num}%` : String(num);
    },
    [trackingData]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const weekLabel = getWeekLabel(weekStart);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-heading">Mis KPIs Semanales</h1>
        <p className="mt-1 text-sm text-text-muted">
          Registra tus métricas antes del cierre del domingo a las 11:59 PM COT.
        </p>
      </div>

      {/* Week + deadline card */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 flex-shrink-0 text-accent" />
            <div>
              <p className="text-sm font-semibold text-text-heading">{weekLabel}</p>
              <p className="text-xs text-text-muted">Semana actual</p>
            </div>
          </div>

          {/* Dynamic status indicator */}
          {isSubmitted ? (
            <Badge variant="success-neon" className="gap-1.5 self-start sm:self-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Enviado ·{" "}
              {parseDbNumeric(submission?.total_points)} /{" "}
              {parseDbNumeric(submission?.max_possible)} pts
            </Badge>
          ) : isExpired ? (
            <Badge variant="danger" className="gap-1.5 self-start sm:self-center">
              <Lock className="h-3.5 w-3.5" />
              Expirado · 0 pts
            </Badge>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 flex-shrink-0 text-text-muted" />
              <span className="text-text-muted">Cierra en:</span>
              {/* suppressHydrationWarning: starts at "…" on SSR, fills in on mount */}
              <span
                suppressHydrationWarning
                className={cn("font-semibold tabular-nums", countdownColor)}
              >
                {msRemaining > 0 ? formatCountdown(msRemaining) : "…"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── No KPIs assigned ──────────────────────────────────────────────── */}
      {definitions.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center text-sm text-text-muted">
            No tienes KPIs activos asignados esta semana.
            <br />
            Contacta a tu administrador para que te asigne métricas.
          </CardContent>
        </Card>
      )}

      {/* ── SUBMITTED: Read-only view ─────────────────────────────────────── */}
      {definitions.length > 0 && isSubmitted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-success-neon" />
              Semana cerrada definitivamente
              <Badge variant="success-neon" className="ml-auto">
                {savedScoring.total} / {savedScoring.maxPossible} pts
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                    KPI
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Valor enviado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Puntos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {savedScoring.perKpi.map((score) => {
                  const def = definitions.find((d) => d.id === score.kpi_id);
                  if (!def) return null;
                  const pct = score.max_points > 0 ? score.earned / score.max_points : 0;
                  return (
                    <tr key={score.kpi_id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text">{def.name}</p>
                        {def.description && (
                          <p className="mt-0.5 text-xs text-text-muted">{def.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{getValueDisplay(def)}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span
                          className={cn(
                            "tabular-nums [text-shadow:0_0_8px_currentColor]",
                            pct >= 1
                              ? "text-success-neon"
                              : pct > 0
                              ? "text-warning-neon"
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
            </table>
            {submission?.bonus_event_id && (
              <div className="border-t border-border px-4 py-3 text-xs text-success-neon [text-shadow:0_0_6px_currentColor]">
                ✓ Puntos registrados en el bono activo
              </div>
            )}
            {!submission?.bonus_event_id && (
              <div className="border-t border-border px-4 py-3 text-xs text-text-muted">
                Sin bono activo — los puntos quedarán registrados cuando se active un lanzamiento.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── EXPIRED: Deadline passed, not submitted ───────────────────────── */}
      {definitions.length > 0 && !isSubmitted && isExpired && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <AlertTriangle className="h-4 w-4" />
              Semana expirada — 0 puntos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-text-muted">
            <p>
              El plazo para enviar los KPIs de esta semana ya cerró (domingo 11:59 PM COT).
              Esta semana no generará puntos en el bono.
            </p>
            <p>Los KPIs de la próxima semana estarán disponibles el lunes.</p>
          </CardContent>
        </Card>
      )}

      {/* ── ACTIVE FORM: Before deadline, not submitted ───────────────────── */}
      {definitions.length > 0 && canEdit && (
        <div className="space-y-4">
          {/* Live score banner */}
          {liveScoring && liveScoring.maxPossible > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card-secondary px-4 py-3">
              <span className="text-sm text-text-muted">Puntos en tiempo real</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xl font-bold tabular-nums [text-shadow:0_0_10px_currentColor]",
                    liveScoring.total >= liveScoring.maxPossible && liveScoring.maxPossible > 0
                      ? "text-success-neon"
                      : liveScoring.total > 0
                      ? "text-warning-neon"
                      : "text-text-muted"
                  )}
                >
                  {Math.round(liveScoring.total * 10) / 10}
                </span>
                <span className="text-sm text-text-muted">
                  / {liveScoring.maxPossible} pts
                </span>
                {liveScoring.total >= liveScoring.maxPossible && liveScoring.maxPossible > 0 && (
                  <Badge variant="success-neon">¡Máximo!</Badge>
                )}
              </div>
            </div>
          )}

          {/* KPI input rows */}
          {definitions.map((def) => {
            const earned = liveScoreMap.get(def.id) ?? 0;
            const pct = def.max_points > 0 ? earned / def.max_points : 0;
            const currentValue = values[def.id] ?? "";

            return (
              <Card key={def.id}>
                <CardContent className="p-4">
                  {/* KPI header row */}
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-text">{def.name}</p>
                      {def.description && (
                        <p className="mt-0.5 text-xs text-text-muted">{def.description}</p>
                      )}
                      <p className="mt-0.5 text-xs text-text-muted">
                        {def.data_type === "boolean"
                          ? "Sí / No"
                          : def.data_type === "percentage"
                          ? `Meta: ${parseDbNumeric(def.target_value)}%`
                          : `Meta: ${parseDbNumeric(def.target_value)} unidades`}
                      </p>
                    </div>

                    {/* Per-KPI live score */}
                    <div className="flex-shrink-0 text-right">
                      <span
                        className={cn(
                          "text-lg font-bold tabular-nums [text-shadow:0_0_8px_currentColor]",
                          pct >= 1
                            ? "text-success-neon"
                            : pct > 0
                            ? "text-warning-neon"
                            : "text-text-muted"
                        )}
                      >
                        {Math.round(earned * 10) / 10}
                      </span>
                      <span className="text-xs text-text-muted"> / {def.max_points} pts</span>
                    </div>
                  </div>

                  {/* Widget per data type */}
                  {def.data_type === "boolean" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleValueChange(def.id, "1")}
                        className={cn(
                          "flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors",
                          currentValue === "1"
                            ? "border-success bg-success/15 text-success"
                            : "border-border bg-transparent text-text-muted hover:bg-white/5 hover:text-text"
                        )}
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => handleValueChange(def.id, "0")}
                        className={cn(
                          "flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors",
                          currentValue === "0"
                            ? "border-danger bg-danger/15 text-danger"
                            : "border-border bg-transparent text-text-muted hover:bg-white/5 hover:text-text"
                        )}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      step={def.data_type === "percentage" ? "0.1" : "1"}
                      max={def.data_type === "percentage" ? "100" : undefined}
                      placeholder={
                        def.data_type === "percentage"
                          ? `0 – 100 (meta: ${parseDbNumeric(def.target_value)}%)`
                          : `0 – ${parseDbNumeric(def.target_value)}`
                      }
                      value={currentValue}
                      onChange={(e) => handleValueChange(def.id, e.target.value)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* API error */}
          {apiError && (
            <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {apiError}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              isLoading={savingDraft}
              disabled={submitting}
              className="flex-1"
            >
              <Save className="h-4 w-4" />
              Guardar Borrador
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={submitting}
              disabled={savingDraft}
              className="flex-1"
            >
              <Send className="h-4 w-4" />
              Enviar Definitivo
            </Button>
          </div>

          <p className="text-center text-xs text-text-muted">
            <strong>Borrador</strong> guarda y permite seguir editando.{" "}
            <strong>Enviar Definitivo</strong> cierra la semana de forma permanente e irreversible.
          </p>
        </div>
      )}
    </div>
  );
}
