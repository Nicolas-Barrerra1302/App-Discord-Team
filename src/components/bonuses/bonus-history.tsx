"use client";

import { useState, useEffect } from "react";
import {
  History,
  ChevronDown,
  ChevronRight,
  Calendar,
  Users,
} from "lucide-react";
import { cn, parseDbNumeric } from "@/lib/utils";
import { formatCurrency } from "@/lib/bonuses/calculator";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BonusEvent {
  id: string;
  launch_id: string;
  user_id: string;
  event_type: string;
  points: number;
  description: string | null;
  registered_by: string;
  final_bonus_amount: string | null;
  created_at: string;
}

interface LaunchWithEvents {
  id: string;
  name: string;
  type: "principal" | "low_ticket";
  status: "active" | "projected" | "closed";
  revenue_bruto: string;
  margen_neto_pct: string;
  pool_pct: string;
  revenue_real: string | null;
  margen_real_pct: string | null;
  created_at: string;
  closed_at: string | null;
  events: BonusEvent[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BonusHistoryProps {
  currentUser: User;
  users: Pick<User, "id" | "name" | "avatar_url" | "role" | "area" | "is_active">[];
}

// ---------------------------------------------------------------------------
// Badge Maps
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  projected: "bg-warning-neon/15 text-warning-neon border border-warning-neon/40 [text-shadow:0_0_6px_currentColor]",
  active: "bg-success-neon/15 text-success-neon border border-success-neon/40 [text-shadow:0_0_6px_currentColor]",
  closed: "bg-white/10 text-text-muted",
};

const statusLabels: Record<string, string> = {
  projected: "Proyectado",
  active: "Activo",
  closed: "Cerrado",
};

const typeLabels: Record<string, string> = {
  principal: "Principal",
  low_ticket: "Low Ticket",
};

const typeColors: Record<string, string> = {
  principal: "bg-accent/20 text-accent border border-accent/30",
  low_ticket: "bg-electric-blue/15 text-electric-blue border border-electric-blue/40 [text-shadow:0_0_6px_currentColor]",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BonusHistory({ currentUser, users }: BonusHistoryProps) {
  const [launches, setLaunches] = useState<LaunchWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLaunchId, setExpandedLaunchId] = useState<string | null>(null);

  // Suppress unused variable warning — currentUser reserved for future access control
  void currentUser;

  // --- User name lookup ---
  const userNameMap = new Map(users.map((u) => [u.id, u.name]));
  const getUserName = (userId: string) => userNameMap.get(userId) ?? userId.slice(0, 8) + "...";

  // --- Fetch launches on mount ---
  useEffect(() => {
    let cancelled = false;

    async function fetchLaunches() {
      try {
        const res = await fetch("/api/bonuses");
        if (!res.ok) throw new Error("Error al cargar lanzamientos");
        const data: LaunchWithEvents[] = await res.json();
        if (!cancelled) {
          setLaunches(data);
        }
      } catch {
        // silently fail — empty state will show
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLaunches();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Toggle expanded launch ---
  const toggleExpand = (launchId: string) => {
    setExpandedLaunchId((prev) => (prev === launchId ? null : launchId));
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
          <History className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">
            Historial de Lanzamientos
          </h2>
          <p className="text-sm text-text-muted">
            Registro de todos los lanzamientos y pagos de bonos
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <p className="text-sm text-text-muted">Cargando historial...</p>
      )}

      {/* Empty State */}
      {!loading && launches.length === 0 && (
        <div className="bg-card-secondary rounded-xl p-8 text-center">
          <History className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted">
            No hay lanzamientos registrados aun
          </p>
        </div>
      )}

      {/* Launch Cards */}
      {!loading &&
        launches.map((launch) => {
          // For closed launches, show real financials; otherwise projected
          const isClosed = launch.status === "closed";
          const revenueBruto = isClosed && launch.revenue_real
            ? parseDbNumeric(launch.revenue_real)
            : parseDbNumeric(launch.revenue_bruto);
          const margenPct = isClosed && launch.margen_real_pct
            ? parseDbNumeric(launch.margen_real_pct)
            : parseDbNumeric(launch.margen_neto_pct);
          const poolPct = parseDbNumeric(launch.pool_pct);
          const utilidadNeta = revenueBruto * (margenPct / 100);
          const poolTotal = utilidadNeta * (poolPct / 100);
          const isExpanded = expandedLaunchId === launch.id;
          const eventCount = launch.events.length;

          return (
            <div
              key={launch.id}
              className="bg-card-secondary rounded-xl p-5 space-y-4"
            >
              {/* Row 1: Name + Type Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-lg font-bold text-text">
                  {launch.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block text-xs px-2.5 py-0.5 rounded-full font-medium",
                      typeColors[launch.type] ?? typeColors.principal
                    )}
                  >
                    {typeLabels[launch.type] ?? launch.type}
                  </span>
                  <span
                    className={cn(
                      "inline-block text-xs px-2.5 py-0.5 rounded-full font-medium",
                      statusColors[launch.status] ?? statusColors.projected
                    )}
                  >
                    {statusLabels[launch.status] ?? launch.status}
                  </span>
                </div>
              </div>

              {/* Row 2: Date */}
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Calendar className="w-4 h-4" />
                <span>Creado: {formatDate(launch.created_at)}</span>
                {launch.closed_at && (
                  <span className="ml-2">
                    | Cerrado: {formatDate(launch.closed_at)}
                  </span>
                )}
              </div>

              {/* Row 3: Financial Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-text-muted">
                    Revenue{isClosed ? " Real" : ""}
                  </p>
                  <p className="text-sm font-semibold text-text">
                    {formatCurrency(revenueBruto)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">
                    Margen{isClosed ? " Real" : ""}
                  </p>
                  <p className="text-sm font-semibold text-text">
                    {margenPct}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Pool</p>
                  <p className="text-sm font-semibold text-text">
                    {poolPct}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Utilidad Neta</p>
                  <p className="text-sm font-bold text-success-neon tabular-nums [text-shadow:0_0_8px_currentColor]">
                    {formatCurrency(utilidadNeta)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Pool Total</p>
                  <p className="text-sm font-bold text-accent tabular-nums">
                    {formatCurrency(poolTotal)}
                  </p>
                </div>
              </div>

              {/* Row 4: Expandable Events Section */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => toggleExpand(launch.id)}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-colors",
                    "text-text-muted hover:text-text"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Users className="w-4 h-4" />
                  <span>
                    Ver detalle ({eventCount}{" "}
                    {eventCount === 1 ? "pago" : "pagos"})
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {eventCount === 0 ? (
                      <p className="text-xs text-text-muted pl-6">
                        Sin eventos registrados
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-text-muted uppercase tracking-wider">
                              <th className="text-left py-2 pr-4">Usuario</th>
                              <th className="text-center py-2 px-4">Puntos</th>
                              <th className="text-left py-2 px-4">Tipo</th>
                              <th className="text-left py-2 px-4">
                                Descripcion
                              </th>
                              <th className="text-right py-2 px-4">Bono</th>
                              <th className="text-right py-2 pl-4">Fecha</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {launch.events.map((event) => {
                              const isSettlement = event.event_type === "settlement";
                              const bonusAmount = isSettlement && event.final_bonus_amount
                                ? parseDbNumeric(event.final_bonus_amount)
                                : null;

                              return (
                                <tr key={event.id}>
                                  <td className="py-2 pr-4 text-text font-medium whitespace-nowrap">
                                    {getUserName(event.user_id)}
                                  </td>
                                  <td className="py-2 px-4 text-center">
                                    {isSettlement ? (
                                      <span className="text-text-muted">—</span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "font-semibold tabular-nums [text-shadow:0_0_8px_currentColor]",
                                          event.points > 0
                                            ? "text-success-neon"
                                            : event.points < 0
                                              ? "text-danger-neon"
                                              : "text-text-muted"
                                        )}
                                      >
                                        {event.points > 0
                                          ? `+${event.points}`
                                          : event.points}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-4 whitespace-nowrap">
                                    {isSettlement ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-warning/20 text-warning">
                                        Cierre
                                      </span>
                                    ) : (
                                      <span className="text-text-muted">{event.event_type}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-4 text-text">
                                    {event.description ?? "—"}
                                  </td>
                                  <td className="py-2 px-4 text-right whitespace-nowrap">
                                    {bonusAmount !== null ? (
                                      <span className="font-bold text-success-neon tabular-nums [text-shadow:0_0_8px_currentColor]">
                                        {formatCurrency(bonusAmount)}
                                      </span>
                                    ) : (
                                      <span className="text-text-muted">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 pl-4 text-text-muted text-right whitespace-nowrap">
                                    {formatDate(event.created_at)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
