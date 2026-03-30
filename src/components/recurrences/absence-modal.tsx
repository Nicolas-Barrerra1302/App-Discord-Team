"use client";

import { useEffect, useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User, UserAbsence } from "@/lib/types";

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User;
  onSaved: (absence: UserAbsence) => void;
}

export function AbsenceModal({
  isOpen,
  onClose,
  users,
  currentUser,
  onSaved,
}: AbsenceModalProps) {
  const isMember = currentUser.role === "member";
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setUserId(isMember ? currentUser.id : "");
      setStartDate("");
      setEndDate("");
      setReason("");
      setError("");
    }
  }, [isOpen, isMember, currentUser.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (!userId) {
      setError("Selecciona un miembro");
      return;
    }
    if (!startDate) {
      setError("La fecha de inicio es obligatoria");
      return;
    }
    if (!endDate) {
      setError("La fecha de fin es obligatoria");
      return;
    }
    if (endDate < startDate) {
      setError("La fecha de fin debe ser posterior a la de inicio");
      return;
    }

    setLoading(true);
    setError("");

    const body = {
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      reason: reason.trim() || null,
      created_by: currentUser.id,
    };

    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al registrar ausencia");
      }

      const saved = await res.json();
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card-secondary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            Registrar Ausencia
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#9e9e9e] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {error && (
            <p className="rounded-lg bg-[#f44336]/10 px-3 py-2 text-sm text-[#f44336]">
              {error}
            </p>
          )}

          {/* Miembro */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#9e9e9e]">
              Miembro *
            </label>
            {isMember ? (
              <div className="flex h-10 w-full items-center rounded-lg border border-border/50 bg-card/60 px-3 text-sm text-text">
                {currentUser.name}
              </div>
            ) : (
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-text focus:border-accent/50 focus:outline-none"
              >
                <option value="">Seleccionar miembro</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha inicio + Fecha fin */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9e9e9e]">
                Fecha inicio *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs text-text focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#9e9e9e]">
                Fecha fin *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs text-text focus:border-accent/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#9e9e9e]">
              Motivo
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vacaciones, enfermedad, etc."
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-text placeholder-text-muted/50 focus:border-accent/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/5 px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#9e9e9e] hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
              "bg-accent hover:bg-accent-hover text-background disabled:opacity-50"
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
