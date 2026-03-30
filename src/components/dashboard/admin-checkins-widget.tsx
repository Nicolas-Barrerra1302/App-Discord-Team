"use client";

import Image from "next/image";
import { CheckCheck, Clock, Flame, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckinListItem {
  user: { id: string; name: string; avatar_url: string | null };
  checkin: {
    hours_worked: string; // numeric from PostgREST
    fires_handled: number;
    blocks_count: number;
    summary: string;
    completion_pct: number;
  } | null;
}

interface AdminCheckinsWidgetProps {
  checkinsList: CheckinListItem[];
  title?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminCheckinsWidget({ checkinsList, title = "Cierres de Hoy" }: AdminCheckinsWidgetProps) {
  const closedCount = checkinsList.filter(c => c.checkin !== null).length;
  const total = checkinsList.length;

  return (
    <div className="rounded-xl border border-border/30 bg-card-secondary p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-neon/10">
            <CheckCheck className="h-5 w-5 text-success-neon" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            <p className="text-[11px] text-[#9e9e9e]">
              {closedCount} de {total} miembros
            </p>
          </div>
        </div>

        {/* Progress pill */}
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: closedCount === total ? "#00e67620" : "#ff980020",
            color: closedCount === total ? "#00e676" : "#ff9800",
          }}
        >
          {closedCount === total ? "Completo" : `${total - closedCount} pendientes`}
        </span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {checkinsList.map((item) => {
          const done = item.checkin !== null;
          return (
            <div
              key={item.user.id}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-all ${
                done
                  ? "border-[#00e676]/10 bg-[#00e676]/[0.03]"
                  : "border-white/5 bg-white/[0.01] opacity-60"
              }`}
            >
              {/* Avatar */}
              <div className="shrink-0 pt-0.5">
                {item.user.avatar_url ? (
                  <Image
                    src={item.user.avatar_url}
                    alt={item.user.name}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                    {item.user.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{item.user.name}</span>
                  {done ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#00e676]/15 px-2 py-0.5 text-[10px] font-semibold text-[#00e676]">
                      <CheckCheck className="h-3 w-3" /> Cerrado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-[#9e9e9e]">
                      <Clock className="h-3 w-3" /> Pendiente
                    </span>
                  )}
                </div>

                {done && item.checkin && (
                  <>
                    {/* Metrics row */}
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#e0e0e0]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#2196f3]" />
                        {Number(item.checkin.hours_worked).toFixed(1)}h
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-[#f44336]" />
                        {item.checkin.fires_handled}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-[#ff9800]" />
                        {item.checkin.blocks_count}
                      </span>
                    </div>
                    {/* Summary */}
                    <p className="mt-1 line-clamp-2 text-xs italic text-[#9e9e9e]">
                      {item.checkin.summary}
                    </p>
                  </>
                )}
              </div>

              {/* Mini completion ring (only for closed) */}
              {done && item.checkin && (
                <div className="shrink-0 self-center">
                  <CompletionRing pct={item.checkin.completion_pct} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini SVG completion ring
// ---------------------------------------------------------------------------

function CompletionRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const color = clamped >= 80 ? "#00e676" : clamped >= 50 ? "#ff9800" : "#f44336";
  // Circle math: r=16, C=2πr≈100.53. We use strokeDasharray=100.53
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg viewBox="0 0 36 36" className="h-8 w-8">
      {/* Background track */}
      <circle
        cx="18" cy="18" r="16"
        fill="none"
        stroke="#333"
        strokeWidth="3"
      />
      {/* Progress arc */}
      <circle
        cx="18" cy="18" r="16"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 18 18)"
      />
      {/* Percentage text */}
      <text
        x="18" y="18"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="9"
        fontWeight="700"
      >
        {clamped}
      </text>
    </svg>
  );
}
