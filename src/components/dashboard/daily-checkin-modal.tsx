"use client";

import { useState } from "react";
import { X, Clock, Flame, AlertTriangle, Loader2, FileCheck } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CheckinMetrics {
  hours_worked: number;
  fires_handled: number;
  blocks_count: number;
  completion_pct: number;
}

interface DailyCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: CheckinMetrics;
  onSuccess: (summary: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailyCheckinModal({ isOpen, onClose, metrics, onSuccess }: DailyCheckinModalProps) {
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSubmit = summary.trim().length > 0 && !isLoading;

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkins/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: summary.trim() }),
      });

      if (res.status === 201) {
        onSuccess(summary.trim());
        setSummary("");
        return;
      }

      const body = await res.json().catch(() => ({ error: "Error desconocido" }));
      setError(body.error ?? `Error ${res.status}`);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative mx-4 w-full max-w-lg rounded-2xl border border-border bg-card-elevated p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-neon/10">
              <FileCheck className="h-5 w-5 text-success-neon" />
            </div>
            <h2 className="text-lg font-bold text-white">Cierre de Día</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9e9e9e] transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Completion ring */}
        <div className="mb-5 flex flex-col items-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#333" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke={
                  metrics.completion_pct >= 80 ? "#00e676"
                    : metrics.completion_pct >= 50 ? "#ff9800" : "#f44336"
                }
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 - (metrics.completion_pct / 100) * 2 * Math.PI * 16}
                className="transition-all duration-500"
              />
            </svg>
            <span className="text-lg font-bold text-white">{Math.round(metrics.completion_pct)}%</span>
          </div>
          <p className="mt-1.5 text-xs text-[#9e9e9e]">Cumplimiento del día</p>
        </div>

        {/* Metrics grid (read-only) */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/30 bg-card/60 p-4 text-center">
            <Clock className="mx-auto mb-2 h-5 w-5 text-[#2196f3]" />
            <p className="text-2xl font-bold text-white">{metrics.hours_worked}h</p>
            <p className="mt-1 text-xs text-[#9e9e9e]">Horas</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/60 p-4 text-center">
            <Flame className="mx-auto mb-2 h-5 w-5 text-[#f44336]" />
            <p className="text-2xl font-bold text-white">{metrics.fires_handled}</p>
            <p className="mt-1 text-xs text-[#9e9e9e]">Incendios</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/60 p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-[#ff9800]" />
            <p className="text-2xl font-bold text-white">{metrics.blocks_count}</p>
            <p className="mt-1 text-xs text-[#9e9e9e]">Bloqueos</p>
          </div>
        </div>

        {/* Summary textarea */}
        <div className="mb-6">
          <label htmlFor="checkin-summary" className="mb-2 block text-sm font-medium text-[#e0e0e0]">
            ¿Cuál fue tu mayor logro o métrica principal de hoy?
          </label>
          <textarea
            id="checkin-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Ej: Cerré la integración del API de pagos y resolví 2 bugs críticos..."
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-text placeholder-text-muted/50 outline-none transition-colors focus:border-accent"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-[#f44336]/20 bg-[#f44336]/10 px-4 py-2.5 text-sm text-[#f44336]">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-[#9e9e9e] transition-colors hover:border-white/20 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-lg bg-success-neon px-5 py-2 text-sm font-semibold text-background transition-all hover:brightness-110 hover:shadow-neon-success disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar Cierre
          </button>
        </div>
      </div>
    </div>
  );
}
