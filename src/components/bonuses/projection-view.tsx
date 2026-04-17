"use client";

import { TrendingUp, Trophy, Users, DollarSign, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/bonuses/calculator";
import type { User } from "@/lib/types";
import type { ActiveLaunchSummary, TeamRankingEntry } from "@/app/(dashboard)/bonos/page";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProjectionViewProps {
  currentUser: User;
  activeLaunch: ActiveLaunchSummary | null;
  teamRanking: TeamRankingEntry[];
  myEstimatedBonus: number | null;
  /** Full user list for avatar/name resolution */
  users: Pick<User, "id" | "name" | "avatar_url">[];
  /** Admin override: view the projection from another member's perspective */
  viewUserId?: string;
  /** Pre-computed estimated bonus for the viewUserId (admin impersonation only) */
  viewEstimatedBonus?: number | null;
  /** Gate: whether the current user can see monetary bonus values */
  canViewMoney: boolean;
}

// ---------------------------------------------------------------------------
// Tier helpers
// ---------------------------------------------------------------------------

function getTierLabel(position: number, total: number): { label: string; color: string } {
  if (position === 1) return { label: "Lider", color: "text-success-neon [text-shadow:0_0_6px_currentColor]" };
  if (position === 2) return { label: "Segundo lugar", color: "text-electric-blue" };
  if (position === 3) return { label: "Tercer lugar", color: "text-warning-neon" };
  if (position <= Math.ceil(total / 2)) return { label: "Top 50%", color: "text-text" };
  return { label: "En el equipo", color: "text-text-muted" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectionView({
  currentUser,
  activeLaunch,
  teamRanking,
  myEstimatedBonus,
  users,
  viewUserId,
  viewEstimatedBonus,
  canViewMoney,
}: ProjectionViewProps) {
  // When admin impersonates a member, all ranking math uses the member's ID
  const effectiveUserId = viewUserId ?? currentUser.id;
  const effectiveBonus =
    viewUserId !== undefined ? (viewEstimatedBonus ?? null) : myEstimatedBonus;

  const myRank = teamRanking.findIndex((e) => e.userId === effectiveUserId);
  const myPoints = teamRanking[myRank]?.totalPoints ?? 0;
  const myRankPosition = myRank + 1; // 1-based
  const totalMembers = teamRanking.length;

  const leaderPoints = teamRanking[0]?.totalPoints ?? 0;
  const progressPct =
    leaderPoints > 0 ? Math.min(100, (myPoints / leaderPoints) * 100) : 0;

  // Delta to the next position above the user
  const nextAbove =
    myRankPosition > 1 ? teamRanking[myRankPosition - 2] : null;
  const pointsToNextPosition = nextAbove
    ? nextAbove.totalPoints - myPoints + 1
    : null;

  const tier = getTierLabel(myRankPosition, totalMembers);

  // Helper: resolve user name from id
  const getUserName = (userId: string) =>
    users.find((u) => u.id === userId)?.name ?? "Desconocido";

  // =========================================================================
  // NO ACTIVE LAUNCH STATE
  // =========================================================================

  if (!activeLaunch) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Mi Proyeccion</h2>
            <p className="text-sm text-text-muted">Estado del lanzamiento activo</p>
          </div>
        </div>

        <div className="bg-card-secondary rounded-xl p-8 text-center">
          <Trophy className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text font-medium">Sin lanzamiento activo</p>
          <p className="text-sm text-text-muted mt-1">
            Los puntos se acumularan cuando el administrador active un nuevo lanzamiento.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
          <TrendingUp className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Mi Proyeccion</h2>
          <p className="text-sm text-text-muted">
            Lanzamiento:{" "}
            <span className="font-medium text-text">{activeLaunch.name}</span>
            {" · "}
            <span
              className={cn(
                "text-xs font-semibold uppercase",
                activeLaunch.status === "active" ? "text-success-neon [text-shadow:0_0_6px_currentColor]" : "text-electric-blue"
              )}
            >
              {activeLaunch.status === "active" ? "Activo" : "Proyectado"}
            </span>
          </p>
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* My points */}
        <div className="bg-card-secondary rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Mis puntos</p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums [text-shadow:0_0_10px_currentColor]",
              myPoints > 0 ? "text-success-neon" : myPoints < 0 ? "text-danger-neon" : "text-text"
            )}
          >
            {myPoints > 0 ? `+${myPoints}` : myPoints}
          </p>
        </div>

        {/* Rank position */}
        <div className="bg-card-secondary rounded-xl p-4">
          <p className="text-xs text-text-muted mb-1">Posicion</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-text">#{myRankPosition}</p>
            <p className="text-xs text-text-muted">de {totalMembers}</p>
          </div>
          <p className={cn("text-xs font-semibold mt-0.5", tier.color)}>
            {tier.label}
          </p>
        </div>

        {/* Estimated bonus */}
        <div className="bg-card-secondary rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-text-muted mb-1">Bono estimado</p>
          {!canViewMoney ? (
            <div className="flex items-center gap-1 mt-1">
              <Lock className="w-3.5 h-3.5 text-text-muted" />
              <p className="text-sm text-text-muted">Visible solo para administración</p>
            </div>
          ) : effectiveBonus !== null ? (
            <p className="text-2xl font-bold text-success-neon tabular-nums [text-shadow:0_0_10px_currentColor]">
              {formatCurrency(effectiveBonus)}
            </p>
          ) : (
            <div className="flex items-center gap-1 mt-1">
              <Lock className="w-3.5 h-3.5 text-text-muted" />
              <p className="text-sm text-text-muted">Sin datos financieros</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar vs leader */}
      <div className="bg-card-secondary rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-text">
            Progreso vs. lider ({getUserName(teamRanking[0]?.userId ?? "")})
          </p>
          <p className="text-sm font-bold text-text tabular-nums">
            {progressPct.toFixed(1)}%
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent/60 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>0 pts</span>
          <span>{leaderPoints} pts</span>
        </div>

        {/* Delta to next position */}
        {pointsToNextPosition !== null && pointsToNextPosition > 0 ? (
          <div className="pt-1 border-t border-border">
            <p className="text-sm text-text-muted">
              Necesitas{" "}
              <span className="font-bold text-electric-blue [text-shadow:0_0_8px_currentColor]">+{pointsToNextPosition} pts</span>{" "}
              para superar a{" "}
              <span className="font-medium text-text">
                {getUserName(nextAbove!.userId)}
              </span>{" "}
              (puesto #{myRankPosition - 1})
            </p>
          </div>
        ) : myRankPosition === 1 ? (
          <div className="pt-1 border-t border-border">
            <p className="text-sm text-success-neon font-medium [text-shadow:0_0_6px_currentColor]">
              Eres el lider del lanzamiento. Mantente arriba!
            </p>
          </div>
        ) : null}
      </div>

      {/* Mini leaderboard (read-only) */}
      <div className="bg-card-secondary rounded-xl divide-y divide-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <Users className="w-4 h-4 text-text-muted" />
          <p className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Ranking del equipo
          </p>
        </div>
        {teamRanking.map((entry, index) => {
          const isMe = entry.userId === effectiveUserId;
          const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

          return (
            <div
              key={entry.userId}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                isMe && "bg-accent/5"
              )}
            >
              <span className="w-7 text-center text-sm font-bold text-text-muted shrink-0">
                {index < 3 ? medals[index] : `#${index + 1}`}
              </span>
              <p
                className={cn(
                  "flex-1 text-sm font-medium truncate",
                  isMe ? "text-accent" : "text-text"
                )}
              >
                {getUserName(entry.userId)}
                {isMe && (
                  <span className="ml-1.5 text-xs text-text-muted font-normal">
                    (yo)
                  </span>
                )}
              </p>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums shrink-0 [text-shadow:0_0_8px_currentColor]",
                  entry.totalPoints > 0
                    ? "text-success-neon"
                    : entry.totalPoints < 0
                      ? "text-danger-neon"
                      : "text-text-muted"
                )}
              >
                {entry.totalPoints > 0 ? `+${entry.totalPoints}` : entry.totalPoints}
              </span>
            </div>
          );
        })}

        {teamRanking.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-text-muted">
            <DollarSign className="w-6 h-6 mx-auto mb-2 opacity-30" />
            Sin puntos registrados en este lanzamiento.
          </div>
        )}
      </div>
    </div>
  );
}
