"use client";

import { Sparkles, Rocket, Wrench, TimerOff, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { MemberMetrics } from "@/lib/types";

interface ValueMatrixProps {
  valueMatrix: MemberMetrics["value_matrix"];
  /** Whether the card should span 2 columns in a CSS grid context */
  colSpan?: boolean;
  /** Min height for each quadrant cell */
  cellMinHeight?: number;
}

// uipro: 2×2 Value Matrix quadrant colors — "Quiet Luxury + Neon" hybrid
// High-impact quadrants use neon/gold accent; low-value quadrants use structural tones
// hex in style={{}} is exempt per CLAUDE.md Rule 8
const QUADRANT_CONFIG: {
  key: keyof MemberMetrics["value_matrix"];
  label: string;
  ideal: string;
  color: string;
  icon: typeof Rocket;
}[] = [
  // Top-left: High Impact, Low Effort — best quadrant → neon green
  { key: "quick_wins",   label: "Quick Wins",       ideal: "Maximiza aquí",          color: "#00E676", icon: Sparkles },
  // Top-right: High Impact, High Effort — strategic value → Copper Gold
  { key: "key_projects", label: "Proyectos Clave",   ideal: "Alto valor estratégico", color: "#CBA35C", icon: Rocket   },
  // Bottom-left: Low Impact, Low Effort — maintenance → Electric Blue
  { key: "maintenance",  label: "Mantenimiento",     ideal: "Mantén bajo",            color: "#38BFF5", icon: Wrench   },
  // Bottom-right: Low Impact, High Effort — waste → Danger Neon
  { key: "time_sinks",   label: "Sumideros",         ideal: "Elimina estos",          color: "#FF5252", icon: TimerOff },
];

export function ValueMatrix({ valueMatrix: vm, colSpan, cellMinHeight = 100 }: ValueMatrixProps) {
  const total = vm.key_projects + vm.quick_wins + vm.maintenance + vm.time_sinks;
  const hasData = total > 0;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <Card className={cn("p-5", colSpan && "lg:col-span-2")}>
      <div className="mb-4 flex items-center gap-3">
        {/* uipro: use violet token for the matrix icon — consistent with Soft Violet theme */}
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet/10">
          <BarChart3 className="h-5 w-5 text-violet" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-heading">Matriz de Valor</p>
          <p className="text-[11px] text-text-muted">Distribución Impacto vs Esfuerzo de tareas completadas</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex w-5 shrink-0 items-center justify-center">
          <span className="origin-center -rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Impacto
          </span>
        </div>

        <div className="flex-1">
          <div className="mb-1 flex justify-between px-1">
            <span className="text-[10px] text-text-muted/60">Alto ↑</span>
            <span className="text-[10px] text-text-muted/60" />
          </div>

          {/* 2×2 grid — hex in style={{}} is exempt per CLAUDE.md Rule 8 */}
          <div className="grid grid-cols-2 gap-1.5">
            {QUADRANT_CONFIG.map(q => {
              const QIcon = q.icon;
              const value = vm[q.key];
              const isEmpty = value === 0;
              return (
                <div
                  key={q.key}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border p-4 transition-all",
                    isEmpty ? "border-dashed border-border bg-white/[0.01]" : "border-white/10 bg-white/[0.03]"
                  )}
                  style={{
                    minHeight: `${cellMinHeight}px`,
                    borderColor: !isEmpty ? `${q.color}30` : undefined,
                    boxShadow: !isEmpty ? `inset 0 0 30px ${q.color}08` : undefined,
                  }}
                >
                  <div
                    className="mb-2 flex items-center justify-center rounded-full transition-all"
                    style={{
                      width:  isEmpty ? 40 : Math.max(44, Math.min(72, 44 + value * 6)),
                      height: isEmpty ? 40 : Math.max(44, Math.min(72, 44 + value * 6)),
                      backgroundColor: isEmpty ? "rgba(255,255,255,0.03)" : `${q.color}18`,
                      border: `2px ${isEmpty ? "dashed" : "solid"} ${isEmpty ? "rgba(255,255,255,0.08)" : `${q.color}50`}`,
                    }}
                  >
                    {isEmpty ? (
                      <QIcon className="h-4 w-4 text-text-muted/30" />
                    ) : (
                      <span className="text-lg font-bold" style={{ color: q.color }}>{value}</span>
                    )}
                  </div>

                  <p className={cn("text-xs font-semibold", isEmpty ? "text-text-muted/40" : "text-text")}>
                    {q.label}
                  </p>

                  {hasData && !isEmpty && (
                    <p className="text-[10px] text-text-muted">{pct(value)}% del total</p>
                  )}

                  {isEmpty && (
                    <p className="mt-0.5 text-[10px] italic text-text-muted/30">{q.ideal}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex justify-between px-1">
            <span className="text-[10px] text-text-muted/60">← Bajo esfuerzo</span>
            <span className="text-[10px] text-text-muted/60">Alto esfuerzo →</span>
          </div>
          <div className="mt-0.5 flex justify-start px-1">
            <span className="text-[10px] text-text-muted/60">Bajo ↓</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
