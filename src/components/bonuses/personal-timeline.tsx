"use client";

import { useState, useEffect, useMemo } from "react";
import { Clock, Trophy, TrendingUp, TrendingDown, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User, BonusEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PersonalTimelineProps {
  currentUser: User;
}

// ---------------------------------------------------------------------------
// Event type labels (Spanish)
// ---------------------------------------------------------------------------

const eventTypeLabels: Record<string, string> = {
  task_completed: "Tarea completada",
  early_delivery: "Entrega anticipada",
  late_delivery: "Entrega tardia",
  quality_bonus: "Bonus de calidad",
  initiative: "Iniciativa",
  collaboration: "Colaboracion",
  streak: "Racha",
  penalty: "Penalizacion",
  adjustment: "Ajuste",
  daily_close: "Cierre de dia",
  missed_daily_close: "Olvido cerrar el dia",
  settlement: "Liquidacion",
  other: "Opcion Abierta",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Justo ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  return date.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PersonalTimeline({ currentUser }: PersonalTimelineProps) {
  const [events, setEvents] = useState<BonusEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch events on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/bonuses/events");
        if (!res.ok) throw new Error("Error al cargar eventos");
        const data = await res.json();
        if (!cancelled) {
          setEvents(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchEvents();
    return () => { cancelled = true; };
  }, [currentUser.id]);

  // Filter out zero-point events that don't affect real scoring
  // (legacy simulation events, etc.) — keep missed_daily_close (0 pts penalty)
  const displayEvents = useMemo(
    () => events.filter((e) => e.points !== 0 || e.event_type === "missed_daily_close"),
    [events],
  );

  // Summary calculations (use filtered list)
  const summary = useMemo(() => {
    const totalPoints = displayEvents.reduce((sum, e) => sum + e.points, 0);
    const positiveCount = displayEvents.filter((e) => e.points > 0).length;
    const negativeCount = displayEvents.filter(
      (e) => e.points < 0 || (e.event_type === "missed_daily_close" && e.points <= 0)
    ).length;
    return { totalPoints, positiveCount, negativeCount };
  }, [displayEvents]);

  // =========================================================================
  // RENDER
  // =========================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span className="ml-3 text-sm text-text-muted">Cargando historial...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
          <Clock className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">
            Mi Historial de Puntos
          </h1>
          <p className="text-sm text-text-muted">
            Registro de todos tus eventos de puntos
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total Points */}
        <div className="bg-card-secondary rounded-xl p-4 text-center">
          <p className="text-xs text-text-muted mb-1">Total</p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums [text-shadow:0_0_10px_currentColor]",
              summary.totalPoints > 0
                ? "text-success-neon"
                : summary.totalPoints < 0
                  ? "text-danger-neon"
                  : "text-text"
            )}
          >
            {summary.totalPoints > 0 ? `+${summary.totalPoints}` : summary.totalPoints}
          </p>
        </div>

        {/* Positive Events */}
        <div className="bg-card-secondary rounded-xl p-4 text-center">
          <p className="text-xs text-text-muted mb-1">Positivos</p>
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="w-4 h-4 text-success-neon" />
            <span className="text-2xl font-bold text-success-neon tabular-nums [text-shadow:0_0_10px_currentColor]">
              {summary.positiveCount}
            </span>
          </div>
        </div>

        {/* Negative Events */}
        <div className="bg-card-secondary rounded-xl p-4 text-center">
          <p className="text-xs text-text-muted mb-1">Negativos</p>
          <div className="flex items-center justify-center gap-1">
            <TrendingDown className="w-4 h-4 text-danger-neon" />
            <span className="text-2xl font-bold text-danger-neon tabular-nums [text-shadow:0_0_10px_currentColor]">
              {summary.negativeCount}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {displayEvents.length === 0 ? (
        /* Empty state */
        <div className="text-center py-12">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-card-secondary mx-auto mb-4">
            <Trophy className="w-7 h-7 text-text-muted" />
          </div>
          <p className="text-text font-medium">
            Aun no tienes eventos registrados
          </p>
          <p className="text-sm text-text-muted mt-1">
            Los puntos se asignaran durante los lanzamientos activos
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical center line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {/* Event items */}
          {displayEvents.map((event) => {
            const isMissedClose = event.event_type === "missed_daily_close";
            const isPositive = event.points > 0 && !isMissedClose;
            const label = eventTypeLabels[event.event_type] ?? event.event_type;

            // 3-way color: positive (success-neon), missed close (warning-neon), negative/zero (danger-neon)
            const dotColor = isPositive
              ? "bg-success-neon border-success-neon/40"
              : isMissedClose
                ? "bg-warning-neon border-warning-neon/40"
                : "bg-danger-neon border-danger-neon/40";

            const badgeBg = isPositive
              ? "bg-success-neon/15 text-success-neon [text-shadow:0_0_6px_currentColor]"
              : isMissedClose
                ? "bg-warning-neon/15 text-warning-neon [text-shadow:0_0_6px_currentColor]"
                : "bg-danger-neon/15 text-danger-neon [text-shadow:0_0_6px_currentColor]";

            const pointsDisplay = isPositive
              ? `+${event.points}`
              : isMissedClose
                ? "0 pts"
                : String(event.points);

            return (
              <div key={event.id} className="relative pl-10 pb-6">
                {/* Dot on the line */}
                <div
                  className={cn(
                    "absolute left-[10px] top-4 w-3 h-3 rounded-full border-2",
                    dotColor
                  )}
                />

                {/* Event card */}
                <div className="bg-card-secondary rounded-xl p-4 border border-border">
                  <div className="flex items-center justify-between">
                    {/* Event type badge */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                        badgeBg
                      )}
                    >
                      {isMissedClose && <AlertTriangle className="w-3 h-3" />}
                      {label}
                    </span>

                    {/* Points badge */}
                    <span
                      className={cn(
                        "text-sm font-bold px-2 py-0.5 rounded-lg",
                        badgeBg
                      )}
                    >
                      {pointsDisplay}
                    </span>
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p className="text-sm text-text-muted mt-2">
                      {event.description}
                    </p>
                  )}

                  {/* Missed close — fallback warning message */}
                  {isMissedClose && !event.description && (
                    <p className="text-sm text-warning-neon mt-2">
                      No se registro el cierre de dia. Recuerda cerrar tu dia cada jornada.
                    </p>
                  )}

                  {/* Date */}
                  <p className="text-xs text-text-muted mt-1" suppressHydrationWarning>
                    {formatRelativeTime(event.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
