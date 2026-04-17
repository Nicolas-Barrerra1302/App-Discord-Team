"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  Trophy,
  Minus,
  Plus,
  Save,
  History,
  Loader2,
  ClipboardList,
  Clock,
  Medal,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculateBonuses, formatCurrency } from "@/lib/bonuses/calculator";
import { canViewBonusMoney } from "@/lib/bonuses/access";
import BonusHistory from "@/components/bonuses/bonus-history";
import RegistrarTab from "@/components/bonuses/registrar-tab";
import PersonalTimeline from "@/components/bonuses/personal-timeline";
import RankingTab from "@/components/bonuses/ranking-tab";
import ProjectionView from "@/components/bonuses/projection-view";
import AdminDistribution from "@/components/bonuses/admin-distribution";
import type { User, BonusMemberInput, UserRole } from "@/lib/types";
import type { ActiveLaunchSummary, TeamRankingEntry } from "@/app/(dashboard)/bonos/page";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BonusesClientProps {
  users: Pick<User, "id" | "name" | "avatar_url" | "role" | "area" | "is_active">[];
  currentUser: User;
  activeLaunch: ActiveLaunchSummary | null;
  teamRanking: TeamRankingEntry[];
  myEstimatedBonus: number | null;
}

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type ActiveTab = "projection" | "simulator" | "history" | "ranking" | "registrar" | "timeline" | "distribution";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BonusesClient({
  users,
  currentUser,
  activeLaunch,
  teamRanking,
  myEstimatedBonus,
}: BonusesClientProps) {
  const isAdminUser = currentUser.role === "super_admin" || currentUser.role === "ceo";
  const canViewMoney = canViewBonusMoney(currentUser);

  // ── All hooks at the top — React hooks rules require unconditional calls ──

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    isAdminUser ? "simulator" : "projection"
  );

  // --- Simulator state (admin-only usage, but hooks must be unconditional) ---
  const [revenue, setRevenue] = useState(80000);
  const [marginPct, setMarginPct] = useState(40);
  const [poolPct, setPoolPct] = useState(7);
  const [memberPoints, setMemberPoints] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [launchName, setLaunchName] = useState("");
  const [launchType, setLaunchType] = useState<"principal" | "low_ticket">("principal");
  const [revenueInput, setRevenueInput] = useState("80000");

  // --- Admin member filter state (used in "projection" tab to impersonate members) ---
  const [selectedMemberId, setSelectedMemberId] = useState(currentUser.id);

  // Pre-compute the selected member's estimated bonus from ranking + launch data
  const selectedMemberBonus = useMemo<number | null>(() => {
    if (selectedMemberId === currentUser.id) return myEstimatedBonus;
    if (!activeLaunch) return null;
    const rev = parseFloat(activeLaunch.revenue_bruto ?? "0");
    const mPct = parseFloat(activeLaunch.margen_neto_pct ?? "0");
    const pPct = parseFloat(activeLaunch.pool_pct ?? "0");
    if (rev <= 0 || mPct <= 0 || pPct <= 0) return null;
    const membersInput: BonusMemberInput[] = users
      .filter((u) => u.role !== 'ceo')
      .map((u) => ({
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatar_url,
        role: u.role as UserRole,
        points: teamRanking.find((r) => r.userId === u.id)?.totalPoints ?? 0,
      }));
    const sim = calculateBonuses(rev, mPct, pPct, membersInput);
    return sim.results.find((r) => r.userId === selectedMemberId)?.simulatedBonus ?? null;
  }, [selectedMemberId, currentUser.id, myEstimatedBonus, activeLaunch, users, teamRanking]);

  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const u of users) {
      initial[u.id] = 0;
    }
    setMemberPoints(initial);
  }, [users]);

  const netProfit = revenue * (marginPct / 100);
  const totalPool = netProfit * (poolPct / 100);

  const simulation = useMemo(() => {
    const membersInput: BonusMemberInput[] = users
      .filter((u) => u.role !== 'ceo')
      .map((u) => ({
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatar_url,
        role: u.role as UserRole,
        points: memberPoints[u.id] ?? 0,
      }));
    return calculateBonuses(revenue, marginPct, poolPct, membersInput);
  }, [revenue, marginPct, poolPct, memberPoints, users]);

  const updatePoints = useCallback((userId: string, delta: number) => {
    setMemberPoints((prev) => {
      const current = prev[userId] ?? 0;
      const next = current + delta;
      if (next < -10) return prev;
      return { ...prev, [userId]: next };
    });
  }, []);

  const handleRevenueChange = useCallback((value: string) => {
    setRevenueInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setRevenue(parsed);
    }
  }, []);

  const handleSaveLaunch = useCallback(async () => {
    if (!launchName.trim()) {
      setSaveMessage({ type: "error", text: "Ingresa un nombre para el lanzamiento" });
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        name: launchName.trim(),
        type: launchType,
        revenue,
        marginPct,
        poolPct,
        payments: simulation.results.map((r) => ({
          userId: r.userId,
          points: memberPoints[r.userId] ?? 0,
          simulatedBonus: r.simulatedBonus,
          poolPercentage: r.poolPercentage,
        })),
      };
      const res = await fetch("/api/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
      setSaveMessage({ type: "success", text: "Lanzamiento guardado correctamente" });
      setLaunchName("");
    } catch (err) {
      setSaveMessage({ type: "error", text: err instanceof Error ? err.message : "Error desconocido" });
    } finally {
      setIsSaving(false);
    }
  }, [launchName, launchType, revenue, marginPct, poolPct, simulation.results, memberPoints]);

  // =========================================================================
  // MEMBER VIEW — projection, ranking, timeline (no admin tabs)
  // =========================================================================

  if (!isAdminUser) {
    return (
      <div className="space-y-6">
        {/* Tab navigation */}
        <div className="flex gap-1 bg-card-secondary rounded-xl p-1 w-fit">
          <Button
            variant={activeTab === "projection" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("projection")}
            className={cn(activeTab !== "projection" && "text-text-muted hover:text-text hover:bg-card")}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Mi Proyeccion
          </Button>
          <Button
            variant={activeTab === "ranking" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("ranking")}
            className={cn(activeTab !== "ranking" && "text-text-muted hover:text-text hover:bg-card")}
          >
            <Medal className="w-4 h-4 mr-2" />
            Ranking
          </Button>
          <Button
            variant={activeTab === "timeline" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("timeline")}
            className={cn(activeTab !== "timeline" && "text-text-muted hover:text-text hover:bg-card")}
          >
            <Clock className="w-4 h-4 mr-2" />
            Mis Puntos
          </Button>
        </div>

        {/* Tab content */}
        {activeTab === "projection" && (
          <ProjectionView
            currentUser={currentUser}
            activeLaunch={activeLaunch}
            teamRanking={teamRanking}
            myEstimatedBonus={myEstimatedBonus}
            users={users}
            canViewMoney={canViewMoney}
          />
        )}
        {activeTab === "ranking" && <RankingTab users={users.filter((u) => u.role !== 'ceo')} />}
        {activeTab === "timeline" && <PersonalTimeline currentUser={currentUser} />}
      </div>
    );
  }

  // =========================================================================
  // ADMIN VIEW — all member tabs + simulator + history + registrar
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-card-secondary rounded-xl p-1 w-fit flex-wrap">
        {(["projection", "ranking", "timeline", "simulator", "history", "distribution"] as const).map((tab) => {
          const tabConfig: Record<string, { label: string; icon: React.ReactNode }> = {
            projection: { label: "Mi Proyeccion", icon: <TrendingUp className="w-4 h-4 mr-2" /> },
            ranking: { label: "Ranking", icon: <Medal className="w-4 h-4 mr-2" /> },
            timeline: { label: "Mis Puntos", icon: <Clock className="w-4 h-4 mr-2" /> },
            simulator: { label: "Simulador", icon: <Trophy className="w-4 h-4 mr-2" /> },
            history: { label: "Historial", icon: <History className="w-4 h-4 mr-2" /> },
            distribution: { label: "CEO Dashboard", icon: <BarChart3 className="w-4 h-4 mr-2" /> },
          };
          const cfg = tabConfig[tab];
          return (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className={cn(activeTab !== tab && "text-text-muted hover:text-text hover:bg-card")}
            >
              {cfg.icon}
              {cfg.label}
            </Button>
          );
        })}
        {(currentUser.role === "super_admin" || currentUser.role === "ceo") && (
          <Button
            variant={activeTab === "registrar" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("registrar")}
            className={cn(activeTab !== "registrar" && "text-text-muted hover:text-text hover:bg-card")}
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Registrar
          </Button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "projection" && (
        <div className="space-y-4">
          {/* Member filter — admin impersonates any member's projection */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-text-muted whitespace-nowrap">
              Ver como:
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === currentUser.id ? " (yo)" : ""}
                </option>
              ))}
            </select>
          </div>
          <ProjectionView
            currentUser={currentUser}
            activeLaunch={activeLaunch}
            teamRanking={teamRanking}
            myEstimatedBonus={myEstimatedBonus}
            users={users}
            viewUserId={selectedMemberId !== currentUser.id ? selectedMemberId : undefined}
            viewEstimatedBonus={selectedMemberId !== currentUser.id ? selectedMemberBonus : undefined}
            canViewMoney={canViewMoney}
          />
        </div>
      )}
      {activeTab === "simulator" && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
              <Trophy className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Simulador de Bonos</h1>
              <p className="text-sm text-text-muted">
                Ajusta los parametros para estimar la distribucion del pool
              </p>
            </div>
          </div>

          {/* Panel de Control */}
          <div className="bg-card-secondary rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Panel de Control
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Revenue Bruto */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-text">
                  <DollarSign className="w-4 h-4 text-accent" />
                  Revenue Bruto
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={revenueInput}
                  onChange={(e) => handleRevenueChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <p className="text-xs text-text-muted">{formatCurrency(revenue)}</p>
              </div>

              {/* Margen Neto */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-text">
                  <TrendingUp className="w-4 h-4 text-success" />
                  Margen Neto %
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={marginPct}
                  onChange={(e) => setMarginPct(Number(e.target.value))}
                  className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">0%</span>
                  <span className="text-lg font-semibold text-text">{marginPct}%</span>
                  <span className="text-xs text-text-muted">100%</span>
                </div>
              </div>

              {/* Pool del Equipo */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-text">
                  <Users className="w-4 h-4 text-info" />
                  Pool del Equipo %
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={poolPct}
                  onChange={(e) => setPoolPct(Number(e.target.value))}
                  className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">0%</span>
                  <span className="text-lg font-semibold text-text">{poolPct}%</span>
                  <span className="text-xs text-text-muted">20%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
              <div className="text-sm text-text-muted">
                Utilidad Neta:{" "}
                <span className="font-semibold text-success">{formatCurrency(netProfit)}</span>
              </div>
              <div className="text-sm text-text-muted">
                Pool Total:{" "}
                <span className="font-semibold text-accent">{formatCurrency(totalPool)}</span>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-card-secondary rounded-xl p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
                <DollarSign className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Revenue Bruto</p>
                <p className="text-lg font-bold text-text">{formatCurrency(revenue)}</p>
              </div>
            </div>
            <div className="bg-card-secondary rounded-xl p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success-neon/10">
                <TrendingUp className="w-5 h-5 text-success-neon" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Utilidad Neta</p>
                <p className="text-lg font-bold text-success-neon">{formatCurrency(netProfit)}</p>
              </div>
            </div>
            <div className="bg-card-secondary rounded-xl p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-electric-blue/10">
                <Trophy className="w-5 h-5 text-electric-blue" />
              </div>
              <div>
                <p className="text-xs text-text-muted">Pool Total</p>
                <p className="text-lg font-bold text-electric-blue">{formatCurrency(totalPool)}</p>
              </div>
            </div>
          </div>

          {/* Member cards */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Panel de Miembros
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.filter((u) => u.role !== 'ceo').map((u) => {
                const result = simulation.results.find((r) => r.userId === u.id);
                const points = memberPoints[u.id] ?? 0;
                return (
                  <div key={u.id} className="bg-card-secondary rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.name} className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{u.name}</p>
                        <Badge variant="outline" className="bg-role-member/20 text-role-member border-transparent">
                          {u.role === "super_admin" ? "Super Admin" : u.role === "ceo" ? "CEO" : "Miembro"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-text-muted font-medium">Puntos</p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => updatePoints(u.id, -1)}
                          disabled={points <= -10}
                          className="w-8 h-8"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span
                          className={cn(
                            "w-12 text-center text-lg font-bold tabular-nums",
                            points > 0 ? "text-success-neon" : points < 0 ? "text-danger-neon" : "text-text"
                          )}
                        >
                          {points}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => updatePoints(u.id, 1)}
                          className="w-8 h-8"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {result && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-text-muted">Bono Estimado</p>
                            <p className="text-2xl font-bold text-text">
                              {formatCurrency(result.simulatedBonus)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-text-muted">del Pool</p>
                            <p className="text-sm font-semibold text-text">
                              {result.poolPercentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        {result.isClamped === "min" && (
                          <Badge variant="danger">PISO</Badge>
                        )}
                        {result.isClamped === "max" && (
                          <Badge variant="warning">TECHO</Badge>
                        )}
                        {result.isClamped === false && (
                          <Badge variant="success">NORMAL</Badge>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Launch */}
          <div className="bg-card-secondary rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Guardar Lanzamiento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-text-muted">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Marzo 2026"
                  value={launchName}
                  onChange={(e) => setLaunchName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-muted">Tipo</label>
                <select
                  value={launchType}
                  onChange={(e) => setLaunchType(e.target.value as "principal" | "low_ticket")}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                >
                  <option value="principal">Principal</option>
                  <option value="low_ticket">Low Ticket</option>
                </select>
              </div>
              <div className="flex items-end">
                {/* uipro: "Guardar Lanzamiento" — high-importance commit action = electric CTA */}
                <Button
                  variant="electric"
                  onClick={handleSaveLaunch}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {isSaving ? "Guardando..." : "Guardar Lanzamiento"}
                </Button>
              </div>
            </div>
            {saveMessage && (
              <div
                className={cn(
                  "px-4 py-2 rounded-lg text-sm",
                  saveMessage.type === "success"
                    ? "bg-success/20 text-success"
                    : "bg-danger/20 text-danger"
                )}
              >
                {saveMessage.text}
              </div>
            )}
          </div>
        </>
      )}
      {activeTab === "history" && <BonusHistory currentUser={currentUser} users={users} />}
      {activeTab === "timeline" && <PersonalTimeline currentUser={currentUser} />}
      {activeTab === "ranking" && <RankingTab users={users.filter((u) => u.role !== 'ceo')} />}
      {activeTab === "distribution" && (
        <AdminDistribution ranking={teamRanking} launch={activeLaunch} users={users} />
      )}
      {activeTab === "registrar" && currentUser.role === "super_admin" && (
        <RegistrarTab users={users} />
      )}
    </div>
  );
}
