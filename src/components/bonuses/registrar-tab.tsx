"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PlusCircle,
  Loader2,
  Clock,
  Zap,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegistrarTabProps {
  users: Pick<User, "id" | "name" | "avatar_url" | "role" | "area" | "is_active">[];
}

// ---------------------------------------------------------------------------
// Local Types
// ---------------------------------------------------------------------------

interface LaunchOption {
  id: string;
  name: string;
  status: string;
  type: string;
}

interface RecentEvent {
  id: string;
  user_id: string;
  event_type: string;
  points: number;
  description: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Event Type Config
// ---------------------------------------------------------------------------

// Only manual event types are allowed here.
// Automated events (task_completed, early_delivery, streak, etc.) are
// handled by the gamification engine — registering them here would
// create duplicates and compromise the audit trail.
const EVENT_TYPES = [
  { value: "culture_bonus", label: "Bonus de cultura" },
  { value: "other", label: "Otro (requiere descripcion)" },
] as const;

const eventTypeLabels: Record<string, string> = Object.fromEntries(
  EVENT_TYPES.map((et) => [et.value, et.label])
);

// ---------------------------------------------------------------------------
// Role Badges
// ---------------------------------------------------------------------------

const roleBadgeLabel: Record<string, string> = {
  super_admin: "Super Admin",
  ceo: "CEO",
  member: "Miembro",
};

// ---------------------------------------------------------------------------
// Quick Point Buttons
// ---------------------------------------------------------------------------

const QUICK_POINTS = [+1, +2, +3, -1, -2, -3];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return "hace un momento";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return new Date(isoString).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegistrarTab({ users }: RegistrarTabProps) {
  // --- Form state ---
  const [selectedLaunchId, setSelectedLaunchId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [eventType, setEventType] = useState("culture_bonus");
  const [points, setPoints] = useState(0);
  const [description, setDescription] = useState("");

  // --- UI state ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // --- Data state ---
  const [launches, setLaunches] = useState<LaunchOption[]>([]);
  const [loadingLaunches, setLoadingLaunches] = useState(true);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // --- Close launch state ---
  const [revenueReal, setRevenueReal] = useState(0);
  const [margenReal, setMargenReal] = useState(40);
  const [isClosing, setIsClosing] = useState(false);
  const [closeMessage, setCloseMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // --- User lookup helper ---
  const getUserName = useCallback(
    (userId: string): string => {
      const u = users.find((u) => u.id === userId);
      return u?.name ?? userId.slice(0, 8) + "...";
    },
    [users]
  );

  // --- Fetch launches (reusable) ---
  const fetchLaunches = useCallback(async () => {
    try {
      const res = await fetch("/api/bonuses");
      if (!res.ok) throw new Error("Error al cargar lanzamientos");
      const data = await res.json();
      // Map to LaunchOption — only need id, name, status, type
      const options: LaunchOption[] = (data as Array<Record<string, unknown>>).map(
        (l: Record<string, unknown>) => ({
          id: l.id as string,
          name: l.name as string,
          status: l.status as string,
          type: l.type as string,
        })
      );
      // Filter to active/projected only
      const filtered = options.filter(
        (l) => l.status === "active" || l.status === "projected"
      );
      setLaunches(filtered);
      // Auto-select first launch if available
      if (filtered.length > 0 && !filtered.find((l) => l.id === selectedLaunchId)) {
        setSelectedLaunchId(filtered[0].id);
      }
      // If selected launch was closed and no longer in list, clear selection
      if (selectedLaunchId && !filtered.find((l) => l.id === selectedLaunchId)) {
        setSelectedLaunchId(filtered.length > 0 ? filtered[0].id : "");
      }
    } catch {
      // Silently fail — empty dropdown
    } finally {
      setLoadingLaunches(false);
    }
  }, [selectedLaunchId]);

  // --- Fetch launches on mount ---
  useEffect(() => {
    fetchLaunches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Fetch recent events when launch changes ---
  const fetchRecentEvents = useCallback(async (launchId: string) => {
    if (!launchId) {
      setRecentEvents([]);
      return;
    }

    setLoadingEvents(true);
    try {
      const res = await fetch(
        `/api/bonuses/events?launch_id=${encodeURIComponent(launchId)}`
      );
      if (!res.ok) throw new Error("Error al cargar eventos");
      const data: RecentEvent[] = await res.json();
      // Take first 10 (already ordered desc by API)
      setRecentEvents(data.slice(0, 10));
    } catch {
      setRecentEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentEvents(selectedLaunchId);
  }, [selectedLaunchId, fetchRecentEvents]);

  // --- Submit handler ---
  const handleSubmit = async () => {
    // Validation
    if (!selectedLaunchId) {
      setMessage({ type: "error", text: "Selecciona un lanzamiento" });
      return;
    }
    if (!selectedUserId) {
      setMessage({ type: "error", text: "Selecciona un miembro" });
      return;
    }
    if (points === 0) {
      setMessage({ type: "error", text: "Los puntos no pueden ser 0" });
      return;
    }
    if (eventType === "other" && !description.trim()) {
      setMessage({
        type: "error",
        text: "Debes describir el motivo cuando el tipo es \"Otro\"",
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        launch_id: selectedLaunchId,
        user_id: selectedUserId,
        event_type: eventType,
        points,
        description: description.trim() || undefined,
      };

      const res = await fetch("/api/bonuses/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al registrar evento");
      }

      setMessage({
        type: "success",
        text: "Evento registrado correctamente",
      });

      // Reset form (keep launch selected)
      setSelectedUserId("");
      setEventType("culture_bonus");
      setPoints(0);
      setDescription("");

      // Re-fetch recent events
      fetchRecentEvents(selectedLaunchId);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Close launch handler ---
  const handleCloseLaunch = async () => {
    if (!selectedLaunchId) return;
    if (revenueReal <= 0) {
      setCloseMessage({ type: "error", text: "Revenue real debe ser mayor a 0" });
      return;
    }

    // Confirmation prompt
    if (
      !window.confirm(
        "¿Estas seguro? Esta accion es irreversible. Se calcularan los bonos definitivos y se cerrara el lanzamiento."
      )
    )
      return;

    setIsClosing(true);
    setCloseMessage(null);

    try {
      const res = await fetch(`/api/bonuses/${selectedLaunchId}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revenue_real: revenueReal,
          margen_real_pct: margenReal,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al cerrar");
      }

      setCloseMessage({
        type: "success",
        text: "Lanzamiento cerrado. Bonos definitivos calculados.",
      });

      // Reset close form
      setRevenueReal(0);
      setMargenReal(40);

      // Re-fetch launches to update the dropdown (closed ones will be filtered out)
      fetchLaunches();
    } catch (err) {
      setCloseMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsClosing(false);
    }
  };

  // --- Clear message after 5 seconds ---
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  // --- Clear close message after 5 seconds ---
  useEffect(() => {
    if (!closeMessage) return;
    const timer = setTimeout(() => setCloseMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [closeMessage]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
          <PlusCircle className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">
            Registrar Evento de Puntos
          </h2>
          <p className="text-sm text-text-muted">
            Asigna puntos positivos o negativos a los miembros del equipo
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-card-secondary rounded-xl p-5 space-y-5">
        {/* Row 1: Launch selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Lanzamiento
          </label>
          {loadingLaunches ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando lanzamientos...
            </div>
          ) : launches.length === 0 ? (
            <p className="text-sm text-danger">
              No hay lanzamientos activos o proyectados. Crea uno primero desde
              el Simulador.
            </p>
          ) : (
            <select
              value={selectedLaunchId}
              onChange={(e) => setSelectedLaunchId(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border border-border",
                "bg-background text-text text-sm",
                "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              )}
            >
              <option value="">Seleccionar lanzamiento...</option>
              {launches.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.status === "active" ? "Activo" : "Proyectado"} — {l.type === "principal" ? "Principal" : "Low Ticket"})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Row 2: Member selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Miembro
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className={cn(
              "w-full px-3 py-2 rounded-lg border border-border",
              "bg-background text-text text-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            )}
          >
            <option value="">Seleccionar miembro...</option>
            {users
              .filter((u) => u.is_active)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {roleBadgeLabel[u.role] ?? "Miembro"}
                  {u.area ? ` (${u.area})` : ""}
                </option>
              ))}
          </select>
        </div>

        {/* Row 3: Event type selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Tipo de Evento
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className={cn(
              "w-full px-3 py-2 rounded-lg border border-border",
              "bg-background text-text text-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            )}
          >
            {EVENT_TYPES.map((et) => (
              <option key={et.value} value={et.value}>
                {et.label}
              </option>
            ))}
          </select>
        </div>

        {/* Row 4: Points input with quick buttons */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Puntos
          </label>

          {/* Quick point buttons */}
          <div className="flex flex-wrap gap-2">
            {QUICK_POINTS.map((qp) => (
              <Button
                key={qp}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPoints(qp)}
                className={cn(
                  "px-3 tabular-nums font-semibold",
                  points === qp
                    ? qp > 0
                      ? "bg-success/30 text-success ring-1 ring-success/50 hover:bg-success/30"
                      : "bg-danger/30 text-danger ring-1 ring-danger/50 hover:bg-danger/30"
                    : "bg-border text-text hover:bg-border/80"
                )}
              >
                {qp > 0 ? `+${qp}` : qp}
              </Button>
            ))}
          </div>

          {/* Number input */}
          <Input
            type="number"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 0)}
            className={cn(
              "text-lg font-semibold tabular-nums appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              points > 0
                ? "text-success"
                : points < 0
                  ? "text-danger"
                  : "text-text"
            )}
          />
          <p className="text-xs text-text-muted">
            Usa valores negativos para penalizaciones
          </p>
        </div>

        {/* Row 5: Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Descripcion{" "}
            <span className="normal-case">
              {eventType === "other" ? (
                <span className="text-danger">(obligatorio)</span>
              ) : (
                "(opcional)"
              )}
            </span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el motivo..."
            rows={2}
            className={cn(
              "w-full px-3 py-2 rounded-lg border border-border",
              "bg-background text-text text-sm resize-none",
              "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
              "placeholder:text-text-muted/50"
            )}
          />
        </div>

        {/* Row 6: Submit button */}
        <Button
          type="button"
          variant="default"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedLaunchId || !selectedUserId || points === 0}
          className="w-full"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          {isSubmitting ? "Registrando..." : "Registrar Evento"}
        </Button>
      </div>

      {/* Toast / Message area */}
      {message && (
        <div
          className={cn(
            "px-4 py-2 rounded-lg text-sm",
            message.type === "success"
              ? "bg-success/20 text-success"
              : "bg-danger/20 text-danger"
          )}
        >
          {message.text}
        </div>
      )}

      {/* ================================================================= */}
      {/* Recent Events Section */}
      {/* ================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Eventos Recientes
          </h3>
        </div>

        {/* Loading */}
        {loadingEvents && (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando eventos...
          </div>
        )}

        {/* Empty state */}
        {!loadingEvents && recentEvents.length === 0 && (
          <div className="bg-card-secondary rounded-xl p-6 text-center">
            <Zap className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted">
              {selectedLaunchId
                ? "No hay eventos registrados en este lanzamiento"
                : "Selecciona un lanzamiento para ver eventos"}
            </p>
          </div>
        )}

        {/* Event list */}
        {!loadingEvents && recentEvents.length > 0 && (
          <div className="space-y-2">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="bg-card-secondary rounded-lg px-4 py-3 flex items-center gap-3"
              >
                {/* User name */}
                <span className="text-sm font-medium text-text min-w-[100px] truncate">
                  {getUserName(event.user_id)}
                </span>

                {/* Event type badge */}
                <Badge variant="outline" className="whitespace-nowrap">
                  {eventTypeLabels[event.event_type] ?? event.event_type}
                </Badge>

                {/* Points */}
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums whitespace-nowrap",
                    event.points > 0
                      ? "text-success"
                      : event.points < 0
                        ? "text-danger"
                        : "text-text-muted"
                  )}
                >
                  {event.points > 0 ? `+${event.points}` : event.points}
                </span>

                {/* Description */}
                <span className="text-xs text-text-muted truncate flex-1 min-w-0">
                  {event.description ?? ""}
                </span>

                {/* Relative time */}
                <span className="text-xs text-text-muted whitespace-nowrap ml-auto">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Cierre Contable — close the selected launch definitively */}
      {/* ================================================================= */}
      {selectedLaunchId && (
        <div className="bg-card-secondary rounded-xl p-5 space-y-4 border border-warning/30">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-warning flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Cierre Contable
          </h2>
          <p className="text-xs text-text-muted">
            Ingresa los datos financieros reales para cerrar este lanzamiento de
            forma definitiva. Los bonos finales se calcularan con los puntos
            acumulados y los datos reales.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue Real input */}
            <div className="space-y-1">
              <label className="text-xs text-text-muted">
                Revenue Real (USD)
              </label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={revenueReal}
                onChange={(e) => setRevenueReal(Number(e.target.value) || 0)}
                className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:ring-warning/50 focus:border-warning"
              />
            </div>

            {/* Margen Real % input */}
            <div className="space-y-1">
              <label className="text-xs text-text-muted">Margen Real %</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={margenReal}
                onChange={(e) => setMargenReal(Number(e.target.value) || 0)}
                className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:ring-warning/50 focus:border-warning"
              />
            </div>
          </div>

          {/* Close button */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleCloseLaunch}
            disabled={isClosing}
            className="w-full justify-center bg-warning text-black hover:bg-warning/80"
          >
            {isClosing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Lock className="w-4 h-4 mr-2" />
            )}
            {isClosing ? "Cerrando..." : "Cerrar Mes Definitivo"}
          </Button>

          {/* Close message */}
          {closeMessage && (
            <div
              className={cn(
                "px-4 py-2 rounded-lg text-sm",
                closeMessage.type === "success"
                  ? "bg-success/20 text-success"
                  : "bg-danger/20 text-danger"
              )}
            >
              {closeMessage.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
