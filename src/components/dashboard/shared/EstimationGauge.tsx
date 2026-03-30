"use client";

import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface EstimationGaugeProps {
  gap: number | null;
  /** Tailwind size classes for the SVG element. Default: "h-44 w-72" */
  svgClassName?: string;
}

export function EstimationGauge({ gap, svgClassName = "h-44 w-72" }: EstimationGaugeProps) {
  const hasData = gap !== null;
  const clamped = hasData ? Math.max(-50, Math.min(50, gap)) : 0;
  const normalized = (clamped + 50) / 100;
  const absGap = hasData ? Math.abs(gap) : 0;

  // uipro: Neon Traffic Light — gauge uses neon palette for precision thresholds
  // hex required for SVG stroke/fill attributes — exempt per CLAUDE.md Rule 8
  const needleColor = !hasData
    ? "#6B6A72"           // text-muted
    : absGap <= 10
      ? "#00E676"         // success-neon — precise
      : absGap <= 30
        ? "#FFD740"       // warning-neon — moderate drift
        : "#FF5252";      // danger-neon — high drift

  const needleColorClass = !hasData
    ? "text-text-muted"
    : absGap <= 10
      ? "text-success-neon"
      : absGap <= 30
        ? "text-warning-neon"
        : "text-danger-neon";

  const needleBgClass = !hasData
    ? "bg-text-muted/10"
    : absGap <= 10
      ? "bg-success-neon/10"
      : absGap <= 30
        ? "bg-warning-neon/10"
        : "bg-danger-neon/10";

  const description = !hasData
    ? "Necesitas tareas con estimación y tiempo real registrado"
    : gap === 0
      ? "Estimación perfecta"
      : gap > 0
        ? `Sueles tardar un ${gap}% más de lo planeado`
        : `Sueles terminar un ${Math.abs(gap)}% antes de lo planeado`;

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", needleBgClass)}>
          <Crosshair className={cn("h-5 w-5", needleColorClass)} />
        </div>
        <div>
          <p className="text-sm font-medium text-text-heading">Precisión de Estimación</p>
          <p className="text-[11px] text-text-muted">Gap entre tiempo real vs estimado</p>
        </div>
      </div>

      {/* SVG Gauge — hex required for SVG stroke/fill attributes */}
      {/* uipro: Gauge Chart — "Red→Yellow→Green gradient, threshold colors" */}
      <div className="flex justify-center py-2">
        <svg viewBox="0 0 260 150" className={svgClassName}>
          <defs>
            <filter id="sharedGaugeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Arc zones: cx=130, cy=120, r=90 — semicircle from 180° to 0° */}
          {/* danger-neon zones (outer) */}
          <path d="M 22.15 72.71 A 90 90 0 0 1 40.47 44.87" fill="none" stroke="#FF5252" strokeWidth="12" strokeLinecap="round" opacity="0.35" />
          {/* warning-neon zone */}
          <path d="M 40.47 44.87 A 90 90 0 0 1 75.03 12.36" fill="none" stroke="#FFD740" strokeWidth="12" strokeLinecap="round" opacity="0.35" />
          {/* success-neon zone (center — precision) */}
          <path d="M 75.03 12.36 A 90 90 0 0 1 184.97 12.36" fill="none" stroke="#00E676" strokeWidth="12" strokeLinecap="round" opacity="0.50" />
          {/* warning-neon zone */}
          <path d="M 184.97 12.36 A 90 90 0 0 1 219.53 44.87" fill="none" stroke="#FFD740" strokeWidth="12" strokeLinecap="round" opacity="0.35" />
          {/* danger-neon zone (outer) */}
          <path d="M 219.53 44.87 A 90 90 0 0 1 237.85 72.71" fill="none" stroke="#FF5252" strokeWidth="12" strokeLinecap="round" opacity="0.35" />

          <text x="10"  y="92"  fill="#FF5252" fontSize="10" textAnchor="middle" opacity="0.7">-50%</text>
          <text x="130" y="10"  fill="#00E676" fontSize="11" textAnchor="middle" fontWeight="700">0%</text>
          <text x="250" y="92"  fill="#FF5252" fontSize="10" textAnchor="middle" opacity="0.7">+50%</text>
          <text x="18"  y="108" fill="#6B6A72" fontSize="9"  textAnchor="middle">Rápido</text>
          <text x="242" y="108" fill="#6B6A72" fontSize="9"  textAnchor="middle">Lento</text>

          {hasData ? (
            <>
              {(() => {
                const gcx = 130, gcy = 120, gr = 90;
                const gAngle = Math.PI * (1 - normalized);
                const gnx = gcx + gr * Math.cos(gAngle);
                const gny = gcy - gr * Math.sin(gAngle);
                return (
                  <>
                    <line x1={gcx} y1={gcy} x2={gnx} y2={gny} stroke={needleColor} strokeWidth="3" strokeLinecap="round" filter="url(#sharedGaugeGlow)" />
                    <circle cx={gnx} cy={gny} r="6" fill={needleColor} filter="url(#sharedGaugeGlow)" />
                    {/* Needle center — Carbon card color */}
                    <circle cx={gcx} cy={gcy} r="5" fill="#141418" stroke={needleColor} strokeWidth="2.5" />
                  </>
                );
              })()}
              <text x="130" y="145" fill={needleColor} fontSize="18" fontWeight="700" textAnchor="middle">
                {gap > 0 ? "+" : ""}{gap}%
              </text>
            </>
          ) : (
            <text x="130" y="120" fill="#6B6A72" fontSize="16" textAnchor="middle">—</text>
          )}
        </svg>
      </div>

      <p className="mt-2 text-center text-sm text-text-muted">{description}</p>
    </Card>
  );
}
