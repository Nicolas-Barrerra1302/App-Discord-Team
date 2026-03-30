"use client";

import { useState } from "react";
import { Pencil, Trash2, Calendar, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TaskRecurrence,
  TaskCategory,
  User,
  RecurrenceFrequency,
} from "@/lib/types";

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  custom: "Personalizada",
};

const FREQUENCY_COLORS: Record<RecurrenceFrequency, string> = {
  daily: "#00e676",
  weekly: "#2196f3",
  biweekly: "#9c27b0",
  monthly: "#ff9800",
  custom: "#607d8b",
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: "#64748B", label: "Baja" },
  medium: { color: "#FFD740", label: "Media" },
  high: { color: "#FF8C00", label: "Alta" },
  urgent: { color: "#B026FF", label: "Urgente" },
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

interface RecurrenceCardProps {
  recurrence: TaskRecurrence;
  users: User[];
  categories: TaskCategory[];
  onEdit: (recurrence: TaskRecurrence) => void;
  onDelete: (id: string) => void;
  onToggleActive: (recurrence: TaskRecurrence, newActive: boolean) => void;
}

export function RecurrenceCard({
  recurrence,
  users,
  categories,
  onEdit,
  onDelete,
  onToggleActive,
}: RecurrenceCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const freq = FREQUENCY_LABELS[recurrence.frequency] ?? recurrence.frequency;
  const freqColor = FREQUENCY_COLORS[recurrence.frequency] ?? "#607d8b";
  const priorityCfg = PRIORITY_CONFIG[recurrence.priority] ?? PRIORITY_CONFIG.medium;

  const assignedUser = recurrence.assigned_to
    ? users.find((u) => u.id === recurrence.assigned_to)
    : null;

  const category = recurrence.category_id
    ? categories.find((c) => c.id === recurrence.category_id)
    : null;

  const showDaysOfWeek =
    recurrence.frequency === "weekly" ||
    recurrence.frequency === "biweekly" ||
    recurrence.frequency === "custom";

  const formatNextDue = (date: string | null) => {
    if (!date) return null;
    return new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(recurrence.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border border-white/5 bg-[#1e1e2e] p-4 transition-all hover:border-white/15",
        !recurrence.is_active && "opacity-60"
      )}
    >
      {/* Top row: title + actions */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#e0e0e0] line-clamp-2">
          {recurrence.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(recurrence)}
            className="rounded-lg p-1.5 text-[#9e9e9e] hover:bg-white/5 hover:text-white transition-colors"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDeleteClick}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              confirmDelete
                ? "bg-[#f44336]/15 text-[#f44336]"
                : "text-[#9e9e9e] hover:bg-[#f44336]/10 hover:text-[#f44336]"
            )}
            title={confirmDelete ? "Confirmar eliminar" : "Eliminar"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Description if exists */}
      {recurrence.description && (
        <p className="mt-1 text-xs text-[#9e9e9e] line-clamp-2">
          {recurrence.description}
        </p>
      )}

      {/* Badges row */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {/* Frequency badge */}
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: `${freqColor}20`,
            color: freqColor,
          }}
        >
          {freq}
        </span>

        {/* Priority badge */}
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: `${priorityCfg.color}20`,
            color: priorityCfg.color,
          }}
        >
          {priorityCfg.label}
        </span>

        {/* Category badge */}
        {category && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${category.color}20`,
              color: category.color,
            }}
          >
            {category.name}
          </span>
        )}
      </div>

      {/* Days of week */}
      {showDaysOfWeek && recurrence.days_of_week.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {DAY_LABELS.map((label, index) => {
            const isSelected = recurrence.days_of_week.includes(index);
            return (
              <span
                key={index}
                className={cn(
                  "inline-flex h-6 w-8 items-center justify-center rounded text-[10px] font-medium",
                  isSelected
                    ? "bg-[#2196f3]/20 text-[#2196f3]"
                    : "bg-white/5 text-[#9e9e9e]/40"
                )}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Info row: assigned user + next due */}
      <div className="mt-3 flex flex-col gap-1.5">
        {/* Assigned user */}
        <div className="flex items-center gap-1.5">
          <UserCircle className="h-3.5 w-3.5 text-[#9e9e9e]/60" />
          <span className="text-xs text-[#9e9e9e]">
            {assignedUser?.name ?? "Sin asignar"}
          </span>
        </div>

        {/* Next due date */}
        {recurrence.next_due_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#9e9e9e]/60" />
            <span className="text-xs text-[#9e9e9e]" suppressHydrationWarning>
              Proxima: {formatNextDue(recurrence.next_due_date)}
            </span>
          </div>
        )}
      </div>

      {/* Active toggle */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-xs text-[#9e9e9e]">
          {recurrence.is_active ? "Activa" : "Inactiva"}
        </span>
        <button
          onClick={() => onToggleActive(recurrence, !recurrence.is_active)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
            recurrence.is_active ? "bg-[#00e676]" : "bg-white/15"
          )}
          role="switch"
          aria-checked={recurrence.is_active}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
              recurrence.is_active ? "translate-x-[18px]" : "translate-x-[3px]"
            )}
          />
        </button>
      </div>

      {/* Confirm delete overlay */}
      {confirmDelete && (
        <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-[#f44336]/10 backdrop-blur-sm px-4 py-2 text-center">
          <span className="text-xs text-[#f44336]">
            Haz clic de nuevo para confirmar
          </span>
        </div>
      )}
    </div>
  );
}
