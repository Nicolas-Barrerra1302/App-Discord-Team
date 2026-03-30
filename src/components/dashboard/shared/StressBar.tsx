"use client";

import { Activity, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StressBarProps {
  ratio: number | null;
}

export function StressBar({ ratio }: StressBarProps) {
  const hasData = ratio !== null;
  const val = hasData ? ratio : 0;

  // uipro: Neon Traffic Light — stress zones use electric/neon palette
  // hex required for style={{}} dynamic values — exempt per CLAUDE.md Rule 8
  const barColor = !hasData
    ? "#6B6A72"   // text-muted
    : val <= 20
      ? "#38BFF5" // electric-blue — under control
      : val <= 40
        ? "#FFD740" // warning-neon — elevated
        : "#FF5252"; // danger-neon — critical

  const barColorClass = !hasData
    ? "text-text-muted"
    : val <= 20
      ? "text-electric-blue"
      : val <= 40
        ? "text-warning-neon"
        : "text-danger-neon";

  const barBgClass = !hasData
    ? "bg-text-muted/10"
    : val <= 20
      ? "bg-electric-blue/10"
      : val <= 40
        ? "bg-warning-neon/10"
        : "bg-danger-neon/10";

  // uipro: gradient band uses the same neon traffic-light zones
  const bgGradient = !hasData
    ? "#2E3A48"
    : "linear-gradient(90deg, #38BFF5 0%, #38BFF5 20%, #FFD740 20%, #FFD740 40%, #FF5252 40%, #FF5252 100%)";

  const statusLabel = !hasData
    ? "Sin datos"
    : val <= 20
      ? "Todo bajo control"
      : val <= 40
        ? "Muchos imprevistos"
        : "Operación Crítica";

  const StatusIcon = !hasData ? Activity : val <= 20 ? Activity : Flame;
  const tip = !hasData
    ? "Completa tareas para ver tu ratio"
    : val <= 20
      ? "Operación estable."
      : val <= 40
        ? "Revisa qué genera imprevistos."
        : "Modo bombero. Revisa causa raíz.";

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", barBgClass)}>
          <StatusIcon className={cn("h-5 w-5", barColorClass)} />
        </div>
        <div>
          <p className="text-sm font-medium text-text-heading">Nivel de Estrés Operativo</p>
          <p className="text-[11px] text-text-muted">% tareas incendio vs completadas</p>
        </div>
      </div>

      {/* Big number — hex for style={{}} since it's dynamic */}
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color: barColor }}>
          {hasData ? `${ratio}%` : "—"}
        </span>
        <span className="text-sm font-medium" style={{ color: barColor }}>{statusLabel}</span>
      </div>

      {/* Stress bar — graduated neon gradient background */}
      <div className="relative">
        <div className="h-3 w-full overflow-hidden rounded-full" style={{ opacity: 0.2, background: bgGradient }} />
        <div
          className="absolute left-0 top-0 h-3 rounded-full transition-all duration-700"
          style={{
            width: hasData ? `${Math.min(val, 100)}%` : "0%",
            backgroundColor: barColor,
            boxShadow: hasData ? `0 0 12px ${barColor}60` : "none",
          }}
        />
        {/* Zone separators */}
        <div className="absolute left-[20%] top-0 h-3 w-px bg-white/10" />
        <div className="absolute left-[40%] top-0 h-3 w-px bg-white/10" />
      </div>

      {/* Zone labels — neon traffic light colors */}
      <div className="mt-1.5 flex text-[10px]">
        <span className="w-[20%] text-electric-blue">Control</span>
        <span className="w-[20%] text-warning-neon">Alerta</span>
        <span className="flex-1 text-danger-neon">Crítico</span>
      </div>

      <div className={cn(
        "mt-3 rounded-lg px-3 py-2 text-center text-xs font-medium",
        !hasData        ? "bg-white/5 text-text-muted"
          : val <= 20   ? "bg-electric-blue/10 text-electric-blue"
            : val <= 40 ? "bg-warning-neon/10 text-warning-neon"
              :           "bg-danger-neon/10 text-danger-neon"
      )}>
        {tip}
      </div>
    </Card>
  );
}
