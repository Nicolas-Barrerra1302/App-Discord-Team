"use client";

import { useState, useEffect, useMemo } from "react";
import { Medal, Loader2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { User, BonusLaunch, BonusEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RankingTabProps {
  users: Pick<User, "id" | "name" | "avatar_url" | "role" | "area" | "is_active">[];
}

// ---------------------------------------------------------------------------
// Ranked member type
// ---------------------------------------------------------------------------

interface RankedMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  area: string | null;
  totalPoints: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RankingTab({ users }: RankingTabProps) {
  const [launches, setLaunches] = useState<BonusLaunch[]>([]);
  const [selectedLaunchId, setSelectedLaunchId] = useState<string | null>(null);
  const [events, setEvents] = useState<BonusEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Fetch launches on mount ---
  useEffect(() => {
    let cancelled = false;

    async function fetchLaunches() {
      try {
        const res = await fetch("/api/bonuses");
        if (!res.ok) return;
        const data: BonusLaunch[] = await res.json();
        if (cancelled) return;

        // Keep only non-closed launches for selection
        const nonClosed = data.filter((l) => l.status !== "closed");
        setLaunches(nonClosed);

        // Auto-select the most recent non-closed launch
        if (nonClosed.length > 0) {
          setSelectedLaunchId(nonClosed[0].id);
        }
      } catch {
        // Silently fail — empty state will show
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchLaunches();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Fetch ranking when selected launch changes ---
  useEffect(() => {
    if (!selectedLaunchId) {
      setEvents([]);
      return;
    }

    let cancelled = false;

    async function fetchRanking() {
      setIsLoading(true);
      try {
        // Use dedicated ranking endpoint: returns aggregated {userId, totalPoints}[]
        // for ALL team members regardless of the caller's role.
        const res = await fetch(
          `/api/bonuses/ranking?launch_id=${selectedLaunchId}`
        );
        if (!res.ok) return;
        const data: { userId: string; totalPoints: number }[] = await res.json();
        if (cancelled) return;
        // Convert to BonusEvent shape only for compatibility with the existing
        // rankedMembers useMemo — we only need user_id and points fields.
        setEvents(
          data.map((entry) => ({
            id: entry.userId,
            launch_id: selectedLaunchId!,
            user_id: entry.userId,
            event_type: 'adjustment' as BonusEvent['event_type'],
            points: entry.totalPoints,
            description: null,
            registered_by: entry.userId,
            final_bonus_amount: null,
            metadata: null,
            created_at: new Date().toISOString(),
          }))
        );
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchRanking();
    return () => {
      cancelled = true;
    };
  }, [selectedLaunchId]);

  // --- Compute ranking (events are already aggregated per user from the API) ---
  const rankedMembers = useMemo<RankedMember[]>(() => {
    const pointsMap: Record<string, number> = {};
    for (const evt of events) {
      // Each entry from /api/bonuses/ranking already represents total per user
      pointsMap[evt.user_id] = evt.points;
    }

    return users
      .map((u) => ({
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatar_url,
        role: u.role,
        area: u.area,
        totalPoints: pointsMap[u.id] ?? 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [events, users]);

  const maxPoints = useMemo(
    () => Math.max(...rankedMembers.map((r) => Math.abs(r.totalPoints)), 1),
    [rankedMembers]
  );

  const selectedLaunch = launches.find((l) => l.id === selectedLaunchId);

  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

  // --- Avatar helper ---
  const renderAvatar = (
    member: RankedMember,
    size: "sm" | "md" | "lg" = "md"
  ) => {
    const sizeClasses = {
      sm: "w-8 h-8 text-xs",
      md: "w-10 h-10 text-sm",
      lg: "w-14 h-14 text-lg",
    };

    if (member.avatarUrl) {
      return (
        <img
          src={member.avatarUrl}
          alt={member.name}
          className={cn("rounded-full mx-auto", sizeClasses[size])}
        />
      );
    }

    return (
      <div
        className={cn(
          "rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold mx-auto",
          sizeClasses[size]
        )}
      >
        {member.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  if (isLoading && launches.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando ranking...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
          <Medal className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">
            Ranking del Equipo
          </h1>
          <p className="text-sm text-text-muted">
            {selectedLaunch
              ? `Lanzamiento: ${selectedLaunch.name}`
              : "Sin lanzamiento seleccionado"}
          </p>
        </div>
      </div>

      {/* Launch selector (if multiple non-closed launches) */}
      {launches.length > 1 && (
        <div>
          <select
            value={selectedLaunchId ?? ""}
            onChange={(e) => setSelectedLaunchId(e.target.value || null)}
            className={cn(
              "px-3 py-2 rounded-lg border border-border",
              "bg-background text-text text-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            )}
          >
            {launches.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.status === "active" ? "Activo" : "Proyectado"})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* No launch state */}
      {!selectedLaunch && !isLoading && (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
          <p className="text-text-muted">
            No hay lanzamientos activos. Crea uno desde el Simulador.
          </p>
        </div>
      )}

      {/* Loading events */}
      {isLoading && selectedLaunch && (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Cargando puntos...
        </div>
      )}

      {/* Ranking content */}
      {selectedLaunch && !isLoading && (
        <>
          {/* Podium — Top 3 */}
          {rankedMembers.length >= 1 && (
            <div className="grid grid-cols-3 gap-3">
              {/* 2nd place (left) */}
              {rankedMembers.length >= 2 ? (
                <div className="bg-card-secondary rounded-xl p-4 text-center mt-6">
                  <div className="text-3xl mb-2">{medals[1]}</div>
                  {renderAvatar(rankedMembers[1], "md")}
                  <p className="font-semibold text-text mt-2 truncate">
                    {rankedMembers[1].name}
                  </p>
                  <p className="text-2xl font-bold text-text">
                    {rankedMembers[1].totalPoints} pts
                  </p>
                </div>
              ) : (
                <div />
              )}

              {/* 1st place (center, taller) */}
              <div className="bg-gradient-to-b from-accent/20 to-card-secondary rounded-xl p-4 text-center border border-accent/30">
                <div className="text-4xl mb-2">{medals[0]}</div>
                {renderAvatar(rankedMembers[0], "lg")}
                <p className="font-semibold text-text mt-2 truncate">
                  {rankedMembers[0].name}
                </p>
                <p className="text-3xl font-bold text-accent">
                  {rankedMembers[0].totalPoints} pts
                </p>
                <span className="text-xs text-accent font-medium uppercase tracking-wider">
                  {"L\u00EDDER"}
                </span>
              </div>

              {/* 3rd place (right) */}
              {rankedMembers.length >= 3 ? (
                <div className="bg-card-secondary rounded-xl p-4 text-center mt-8">
                  <div className="text-3xl mb-2">{medals[2]}</div>
                  {renderAvatar(rankedMembers[2], "md")}
                  <p className="font-semibold text-text mt-2 truncate">
                    {rankedMembers[2].name}
                  </p>
                  <p className="text-2xl font-bold text-text">
                    {rankedMembers[2].totalPoints} pts
                  </p>
                </div>
              ) : (
                <div />
              )}
            </div>
          )}

          {/* Full ranking list */}
          <div className="bg-card-secondary rounded-xl divide-y divide-border">
            {rankedMembers.map((member, index) => (
              <div
                key={member.userId}
                className="flex items-center gap-4 p-4"
              >
                {/* Position number */}
                <span className="text-lg font-bold text-text-muted w-8 text-center shrink-0">
                  {index < 3 ? medals[index] : `#${index + 1}`}
                </span>

                {/* Avatar */}
                <div className="shrink-0">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name + area/role */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {member.area ?? member.role}
                  </p>
                </div>

                {/* Progress bar relative to max */}
                <div className="flex-1 max-w-[200px] hidden sm:block">
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent/60"
                      style={{
                        width: `${
                          maxPoints > 0
                            ? (Math.abs(member.totalPoints) / maxPoints) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Points — neon traffic light for leaderboard scores */}
                <div className="text-right shrink-0">
                  <span
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      member.totalPoints > 0
                        ? "text-success-neon"
                        : member.totalPoints < 0
                          ? "text-danger-neon"
                          : "text-text"
                    )}
                  >
                    {member.totalPoints > 0
                      ? `+${member.totalPoints}`
                      : member.totalPoints}
                  </span>
                  <p className="text-xs text-text-muted">puntos</p>
                </div>

                {/* Badge — neon tier variants for gamification context */}
                <Badge
                  variant={
                    member.totalPoints > 0
                      ? "success-neon"
                      : member.totalPoints === 0
                        ? "outline"
                        : "danger-neon"
                  }
                  className="shrink-0 hidden md:inline-flex"
                >
                  {member.totalPoints > 0
                    ? "SOBRE META"
                    : member.totalPoints === 0
                      ? "BASE"
                      : "BAJO META"}
                </Badge>
              </div>
            ))}

            {/* Empty list */}
            {rankedMembers.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                No hay miembros para mostrar.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
