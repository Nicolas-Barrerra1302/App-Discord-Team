"use client";

import { useMemo } from "react";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/bonuses/calculator";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";
import type { ActiveLaunchSummary, TeamRankingEntry } from "@/app/(dashboard)/bonos/page";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdminDistributionProps {
  ranking: TeamRankingEntry[];
  launch: ActiveLaunchSummary | null;
  users: Pick<User, "id" | "name" | "avatar_url" | "role">[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDistribution({ ranking, launch, users }: AdminDistributionProps) {
  // Active pool dollar amount — computed first so rows can use it
  const totalPool = useMemo(() => {
    if (!launch) return 0;
    const revenue = parseFloat(launch.revenue_bruto ?? "0");
    const marginPct = parseFloat(launch.margen_neto_pct ?? "0");
    const poolPct = parseFloat(launch.pool_pct ?? "0");
    return revenue * (marginPct / 100) * (poolPct / 100);
  }, [launch]);

  // All math runs once via useMemo — no re-computation on re-renders
  const rows = useMemo(() => {
    if (!launch) return [];

    // Sum all points from the global ranking (backend already aggregated)
    const totalGlobalPoints = ranking.reduce(
      (sum, r) => sum + (r.totalPoints ?? 0),
      0
    );

    return ranking.map((entry, idx) => {
      // Guard division by zero — if no one has points show 0
      const sharePct =
        totalGlobalPoints > 0
          ? (entry.totalPoints / totalGlobalPoints) * 100
          : 0;
      const projectedPayout =
        totalGlobalPoints > 0
          ? (entry.totalPoints / totalGlobalPoints) * totalPool
          : 0;

      return {
        rank: idx + 1,
        userId: entry.userId,
        totalPoints: entry.totalPoints,
        sharePct,
        projectedPayout,
      };
    });
  }, [ranking, launch, totalPool]);

  // ---------------------------------------------------------------------------
  // No active launch
  // ---------------------------------------------------------------------------

  if (!launch) {
    return (
      <div className="bg-card-secondary rounded-xl p-8 text-center">
        <DollarSign className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
        <p className="text-text font-medium">Sin lanzamiento activo</p>
        <p className="text-sm text-text-muted mt-1">
          Activa un lanzamiento para ver la distribucion financiera.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
          <TrendingUp className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Distribucion del Pool</h2>
          <p className="text-sm text-text-muted">
            Lanzamiento:{" "}
            <span className="font-medium text-text">{launch.name}</span>
            {" · "}
            Pool total:{" "}
            <span className="font-semibold text-accent">{formatCurrency(totalPool)}</span>
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card-secondary rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Revenue Bruto</p>
          <p className="text-lg font-bold text-text">
            {formatCurrency(parseFloat(launch.revenue_bruto ?? "0"))}
          </p>
        </div>
        <div className="bg-card-secondary rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Pool Total</p>
          <p className="text-lg font-bold text-accent">{formatCurrency(totalPool)}</p>
        </div>
        <div className="bg-card-secondary rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-text-muted mb-1">Miembros</p>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-text-muted" />
            <p className="text-lg font-bold text-text">{ranking.length}</p>
          </div>
        </div>
      </div>

      {/* Distribution table */}
      <div className="bg-card-secondary rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_1fr_5rem_6rem_7rem] gap-x-4 px-4 py-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-text-muted">
          <span>#</span>
          <span>Miembro</span>
          <span className="text-right">Puntos</span>
          <span className="text-right">% del Pool</span>
          <span className="text-right">Pago Estimado</span>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">
            Sin puntos registrados en este lanzamiento.
          </div>
        ) : (
          rows.map((row) => {
            const user = users.find((u) => u.id === row.userId);
            const medals = ["🥇", "🥈", "🥉"];

            return (
              <div
                key={row.userId}
                className="grid grid-cols-[2rem_1fr_5rem_6rem_7rem] gap-x-4 px-4 py-3 border-b border-border/50 last:border-0 items-center hover:bg-card/30 transition-colors"
              >
                {/* Rank */}
                <span className="text-sm font-bold text-text-muted text-center">
                  {row.rank <= 3 ? medals[row.rank - 1] : `#${row.rank}`}
                </span>

                {/* User */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-7 h-7 rounded-full shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                      {user?.name.charAt(0).toUpperCase() ?? "?"}
                    </div>
                  )}
                  <span className="text-sm font-medium text-text truncate">
                    {user?.name ?? "Desconocido"}
                  </span>
                </div>

                {/* Points — neon traffic light for gamification scoring */}
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums text-right",
                    row.totalPoints > 0
                      ? "text-success-neon"
                      : row.totalPoints < 0
                        ? "text-danger-neon"
                        : "text-text-muted"
                  )}
                >
                  {row.totalPoints > 0 ? `+${row.totalPoints}` : row.totalPoints}
                </span>

                {/* Share % */}
                <div className="text-right">
                  <span className="text-sm font-semibold text-text tabular-nums">
                    {row.sharePct.toFixed(2)}%
                  </span>
                </div>

                {/* Payout — neon green for positive financial outcome */}
                <span className="text-sm font-bold text-success-neon tabular-nums text-right">
                  {formatCurrency(row.projectedPayout)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
