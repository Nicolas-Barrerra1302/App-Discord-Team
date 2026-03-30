"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, CalendarOff, Repeat, Trash2, Zap, Loader2, X } from "lucide-react";
import type {
  TaskRecurrence,
  TaskCategory,
  User,
  UserAbsence,
} from "@/lib/types";
import { RecurrenceCard } from "./recurrence-card";
import { RecurrenceModal } from "./recurrence-modal";
import { AbsenceModal } from "./absence-modal";

interface RecurrencesManagerProps {
  initialRecurrences: TaskRecurrence[];
  initialAbsences: UserAbsence[];
  users: User[];
  categories: TaskCategory[];
  currentUser: User;
  serverToday: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

export function RecurrencesManager({
  initialRecurrences,
  initialAbsences,
  users,
  categories,
  currentUser,
  serverToday,
}: RecurrencesManagerProps) {
  const router = useRouter();
  const toastIdRef = useRef(0);

  const [recurrences, setRecurrences] =
    useState<TaskRecurrence[]>(initialRecurrences);
  const [absences, setAbsences] = useState<UserAbsence[]>(initialAbsences);
  const [cats, setCats] = useState<TaskCategory[]>(categories);

  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false);
  const [editingRecurrence, setEditingRecurrence] = useState<
    TaskRecurrence | undefined
  >(undefined);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"recurrences" | "absences">(
    "recurrences"
  );

  // --- Toast system ---
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Cron dev tool ---
  const [cronLoading, setCronLoading] = useState(false);

  const handleForceCron = async () => {
    setCronLoading(true);
    try {
      const res = await fetch("/api/cron/generate-tasks?force=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ""}` },
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showToast("success", `Cron ejecutado — ${data?.generated ?? 0} tarea(s) generada(s)${data?.force_mode ? ' (force)' : ''}`);
        router.refresh();
      } else {
        showToast("error", `Cron fallo: ${data?.error ?? res.statusText}`);
      }
    } catch (err) {
      showToast("error", `Error de red: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setCronLoading(false);
    }
  };

  // --- Recurrence handlers ---

  const handleCreateRecurrence = () => {
    setEditingRecurrence(undefined);
    setRecurrenceModalOpen(true);
  };

  const handleEditRecurrence = (recurrence: TaskRecurrence) => {
    setEditingRecurrence(recurrence);
    setRecurrenceModalOpen(true);
  };

  const handleRecurrenceSaved = (saved: TaskRecurrence) => {
    setRecurrences((prev) => {
      const exists = prev.find((r) => r.id === saved.id);
      if (exists) {
        return prev.map((r) => (r.id === saved.id ? saved : r));
      }
      return [saved, ...prev];
    });
    setRecurrenceModalOpen(false);
    setEditingRecurrence(undefined);
    router.refresh();
  };

  const handleToggleActive = async (
    recurrence: TaskRecurrence,
    newActive: boolean
  ) => {
    // Optimistic update
    setRecurrences((prev) =>
      prev.map((r) =>
        r.id === recurrence.id ? { ...r, is_active: newActive } : r
      )
    );

    try {
      const res = await fetch(`/api/recurrences/${recurrence.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Error ${res.status}`);
      }

      router.refresh();
    } catch (err) {
      // Revert on error
      setRecurrences((prev) =>
        prev.map((r) =>
          r.id === recurrence.id
            ? { ...r, is_active: recurrence.is_active }
            : r
        )
      );
      showToast(
        "error",
        `No se pudo ${newActive ? "activar" : "desactivar"}: ${err instanceof Error ? err.message : "Error desconocido"}`
      );
    }
  };

  const handleDeleteRecurrence = async (id: string) => {
    const prev = recurrences;
    setRecurrences((list) => list.filter((r) => r.id !== id));

    try {
      const res = await fetch(`/api/recurrences/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Error ${res.status}`);
      }

      showToast("success", "Plantilla eliminada");
      router.refresh();
    } catch (err) {
      // Revert on error
      setRecurrences(prev);
      showToast(
        "error",
        `No se pudo eliminar: ${err instanceof Error ? err.message : "Error desconocido"}`
      );
    }
  };

  // --- Absence handlers ---

  const handleCreateAbsence = () => {
    setAbsenceModalOpen(true);
  };

  const handleAbsenceSaved = (saved: UserAbsence) => {
    setAbsences((prev) => [saved, ...prev]);
    setAbsenceModalOpen(false);
  };

  const handleDeleteAbsence = async (id: string) => {
    const prev = absences;
    setAbsences((list) => list.filter((a) => a.id !== id));

    try {
      const res = await fetch(`/api/absences/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setAbsences(prev);
    }
  };

  // --- Helpers ---

  const getUserName = (userId: string | null) => {
    if (!userId) return "Sin asignar";
    const u = users.find((u) => u.id === userId);
    return u?.name ?? "Desconocido";
  };

  const formatDateRange = (start: string, end: string) => {
    const fmt = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      });
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const activeCount = recurrences.filter((r) => r.is_active).length;
  const inactiveCount = recurrences.length - activeCount;

  return (
    <div className="flex flex-col gap-6">
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
                toast.type === "success"
                  ? "bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/20"
                  : "bg-[#f44336]/15 text-[#f44336] border border-[#f44336]/20"
              }`}
            >
              <span className="max-w-xs">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="ml-2 shrink-0 rounded p-0.5 hover:bg-white/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tareas Recurrentes</h1>
        <p className="mt-1 text-sm text-[#9e9e9e]">
          {recurrences.length} plantilla{recurrences.length !== 1 ? "s" : ""}{" "}
          ({activeCount} activa{activeCount !== 1 ? "s" : ""}, {inactiveCount}{" "}
          inactiva{inactiveCount !== 1 ? "s" : ""})
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 rounded-lg bg-card-secondary p-1">
        <button
          onClick={() => setActiveTab("recurrences")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "recurrences"
              ? "bg-[#1e1e2e] text-white shadow"
              : "text-[#9e9e9e] hover:text-[#e0e0e0]"
          }`}
        >
          <Repeat className="h-4 w-4" />
          Plantillas Recurrentes
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
            {recurrences.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("absences")}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "absences"
              ? "bg-[#1e1e2e] text-white shadow"
              : "text-[#9e9e9e] hover:text-[#e0e0e0]"
          }`}
        >
          <CalendarOff className="h-4 w-4" />
          Ausencias
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
            {absences.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {activeTab === "recurrences" && (
        <div className="flex flex-col gap-4">
          {/* Section header with buttons */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Plantillas Recurrentes
            </h2>
            <div className="flex items-center gap-2">
              {/* Dev-only cron trigger (admin only) */}
              {process.env.NODE_ENV === "development" && (currentUser.role === "super_admin" || currentUser.role === "ceo") && (
                <button
                  onClick={handleForceCron}
                  disabled={cronLoading}
                  className="flex items-center gap-2 rounded-lg border border-[#ff9800]/30 bg-[#ff9800]/10 px-3 py-2 text-xs font-medium text-[#ff9800] hover:bg-[#ff9800]/20 transition-colors disabled:opacity-50"
                >
                  {cronLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Forzar Cron (Dev)
                </button>
              )}
              <button
                onClick={handleCreateRecurrence}
                className="flex items-center gap-2 rounded-lg bg-accent hover:bg-accent-hover px-4 py-2 text-sm font-medium text-background transition-all"
              >
                <Plus className="h-4 w-4" />
                Nueva Plantilla
              </button>
            </div>
          </div>

          {/* Recurrence cards grid */}
          {recurrences.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#1e1e2e] p-12 text-center">
              <Repeat className="mx-auto mb-3 h-10 w-10 text-[#9e9e9e]/40" />
              <p className="text-[#9e9e9e]">
                No hay plantillas recurrentes configuradas
              </p>
              <p className="mt-1 text-xs text-[#9e9e9e]/60">
                Crea una plantilla para generar tareas automaticamente
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recurrences.map((recurrence) => (
                <RecurrenceCard
                  key={recurrence.id}
                  recurrence={recurrence}
                  users={users}
                  categories={cats}
                  onEdit={handleEditRecurrence}
                  onDelete={handleDeleteRecurrence}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "absences" && (
        <div className="flex flex-col gap-4">
          {/* Section header with button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Ausencias</h2>
            <button
              onClick={handleCreateAbsence}
              className="flex items-center gap-2 rounded-lg bg-accent hover:bg-accent-hover px-4 py-2 text-sm font-medium text-background transition-all"
            >
              <Plus className="h-4 w-4" />
              Registrar Ausencia
            </button>
          </div>

          {/* Absence list */}
          {absences.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#1e1e2e] p-12 text-center">
              <CalendarOff className="mx-auto mb-3 h-10 w-10 text-[#9e9e9e]/40" />
              <p className="text-[#9e9e9e]">No hay ausencias registradas</p>
              <p className="mt-1 text-xs text-[#9e9e9e]/60">
                Registra ausencias para pausar tareas recurrentes
                automaticamente
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {absences.map((absence) => {
                const isActive =
                  absence.start_date <= serverToday && absence.end_date >= serverToday;
                const isFuture = absence.start_date > serverToday;

                return (
                  <div
                    key={absence.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-[#1e1e2e] p-4 hover:border-white/15 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Status indicator */}
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isActive
                            ? "bg-[#f44336] animate-pulse"
                            : isFuture
                              ? "bg-[#ff9800]"
                              : "bg-[#9e9e9e]"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-[#e0e0e0]">
                          {getUserName(absence.user_id)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-3">
                          <span className="text-xs text-[#9e9e9e]" suppressHydrationWarning>
                            {formatDateRange(
                              absence.start_date,
                              absence.end_date
                            )}
                          </span>
                          {isActive && (
                            <span className="rounded-full bg-[#f44336]/15 px-2 py-0.5 text-[10px] font-medium text-[#f44336]">
                              Activa
                            </span>
                          )}
                          {isFuture && (
                            <span className="rounded-full bg-[#ff9800]/15 px-2 py-0.5 text-[10px] font-medium text-[#ff9800]">
                              Programada
                            </span>
                          )}
                        </div>
                        {absence.reason && (
                          <p className="mt-1 text-xs text-[#9e9e9e]/70">
                            {absence.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            "Seguro que deseas eliminar esta ausencia?"
                          )
                        ) {
                          handleDeleteAbsence(absence.id);
                        }
                      }}
                      className="rounded-lg p-2 text-[#9e9e9e] hover:bg-[#f44336]/10 hover:text-[#f44336] transition-colors"
                      title="Eliminar ausencia"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recurrence modal */}
      <RecurrenceModal
        isOpen={recurrenceModalOpen}
        onClose={() => {
          setRecurrenceModalOpen(false);
          setEditingRecurrence(undefined);
        }}
        recurrence={editingRecurrence}
        categories={cats}
        users={users}
        currentUser={currentUser}
        onSaved={handleRecurrenceSaved}
        onCategoriesChanged={setCats}
        onToast={showToast}
      />

      {/* Absence modal */}
      <AbsenceModal
        isOpen={absenceModalOpen}
        onClose={() => setAbsenceModalOpen(false)}
        users={users}
        currentUser={currentUser}
        onSaved={handleAbsenceSaved}
      />
    </div>
  );
}
