"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Clock,
  AlertTriangle,
  Repeat,
  Paperclip,
  CheckCircle2,
  MoreHorizontal,
  Archive,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isOverdue, formatDueDate } from "@/lib/tasks";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import type { Task, User } from "@/lib/types";

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: "#64748B", label: "Baja" },
  medium: { color: "#FFD740", label: "Media" },
  high: { color: "#FF8C00", label: "Alta" },
  urgent: { color: "#B026FF", label: "Urgente" },
};

interface TaskCardProps {
  task: Task & { subtask_count?: number; subtask_completed_count?: number };
  onClick: (task: Task) => void;
  overlay?: boolean;
  users?: User[];
  isAdmin?: boolean;
  onArchived?: (taskId: string) => void;
  onDeleted?: (taskId: string) => void;
}

function TaskCardInner({
  task,
  onClick,
  overlay,
  users,
  isAdmin,
  onArchived,
  onDeleted,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = isOverdue(task);
  // isOverdue() correctly excludes blocked tasks for KPI metrics, but for visual
  // display a past due_date must still render RED on blocked tasks — fix the badge variant.
  const isDueDatePast = !!task.due_date && (() => {
    const dueStr = task.due_date!.substring(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return dueStr < todayStr;
  })();
  const dateIsRed = overdue || (isDueDatePast && task.status !== "completed");
  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  // Action menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Resolve assignee
  const assignee = users?.find((u) => u.id === task.assigned_to);

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        onArchived?.(task.id);
      }
    } catch {
      /* ignore */
    }
    setArchiving(false);
    setMenuOpen(false);
  };

  const handleHardDelete = async () => {
    setHardDeleteLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}?permanent=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted?.(task.id);
      }
    } catch {
      /* ignore */
    }
    setHardDeleteLoading(false);
    setHardDeleteOpen(false);
    setMenuOpen(false);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group relative rounded-xl bg-card-secondary p-3 cursor-pointer transition-all",
          "border border-white/5 hover:border-white/15 hover:scale-[1.01]",
          isDragging && "opacity-50",
          overlay && "shadow-2xl rotate-2",
          overdue &&
            "border-danger/40 shadow-[0_0_12px_rgba(244,67,54,0.15)]"
        )}
        onClick={() => onClick(task)}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          style={{ touchAction: isDragging ? "none" : "manipulation" }}
          className="absolute left-1 top-1/2 -translate-y-1/2 p-1 text-text-muted/0 group-hover:text-text-muted/60 transition-colors cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Action menu (3 dots) */}
        {!overlay && (
          <div ref={menuRef} className="absolute right-1.5 top-1.5 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="rounded-md p-1 text-text-muted/0 group-hover:text-text-muted/60 hover:!text-text hover:bg-white/5 transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warning hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {archiving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Archive className="h-3.5 w-3.5" />
                  )}
                  Archivar
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHardDeleteOpen(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-danger hover:bg-white/5 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar definitivo
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="pl-4 pr-5">
          {/* Title */}
          <div className="flex items-start gap-1.5 mb-2">
            {task.status === "completed" && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-neon" />
            )}
            <p
              className={cn(
                "text-sm font-medium line-clamp-2",
                task.status === "completed"
                  ? "text-text-muted line-through decoration-text-muted/40"
                  : "text-text"
              )}
            >
              {task.title}
            </p>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Priority — uses dynamic color via style, exempt from Badge */}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                task.priority === "urgent" && "animate-pulse"
              )}
              style={{
                backgroundColor: `${priorityCfg.color}20`,
                color: priorityCfg.color,
              }}
            >
              {priorityCfg.label}
            </span>

            {/* Due date — traffic light: neon green if on time, neon red if overdue */}
            {task.due_date && (
              <Badge variant={dateIsRed ? "danger-neon" : "success-neon"} className="gap-1 rounded-full text-[10px]">
                <Clock className="h-3 w-3" />
                {formatDueDate(task.due_date)}
              </Badge>
            )}

            {/* Recurring */}
            {task.is_recurring_instance && (
              <Badge variant="info" className="rounded-full px-1.5 py-0.5">
                <Repeat className="h-3 w-3" />
              </Badge>
            )}

            {/* Attachments count */}
            {Array.isArray(task.attachments) &&
              task.attachments.length > 0 && (
                <Badge variant="outline" className="gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]">
                  <Paperclip className="h-3 w-3" />
                  {task.attachments.length}
                </Badge>
              )}

            {/* Warning: about to be due */}
            {!overdue && task.priority === "urgent" && task.due_date && (
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            )}
          </div>

          {/* Subtask progress */}
          {task.subtask_count != null && task.subtask_count > 0 && (
            <div className="mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{
                  width: `${task.subtask_count ? ((task.subtask_completed_count ?? 0) / task.subtask_count) * 100 : 0}%`,
                }}
              />
            </div>
          )}

          {/* Assignee indicator */}
          {assignee && (
            <div className="mt-2 flex items-center gap-1.5">
              {assignee.avatar_url ? (
                <img
                  src={assignee.avatar_url}
                  alt={assignee.name}
                  className="h-4 w-4 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent">
                  {assignee.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[10px] text-text-muted truncate max-w-[120px]">
                {assignee.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Hard delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={hardDeleteOpen}
        onClose={() => setHardDeleteOpen(false)}
        onConfirm={handleHardDelete}
        title="Eliminar definitivamente"
        message="Si eliminas esta tarea, se borrara de las metricas de rendimiento. Si solo quieres limpiar tu tablero, usa Archivar."
        confirmLabel="Eliminar definitivo"
        isLoading={hardDeleteLoading}
      />
    </>
  );
}

export const TaskCard = memo(TaskCardInner, (prev, next) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.status === next.task.status &&
    prev.task.updated_at === next.task.updated_at &&
    prev.task.title === next.task.title &&
    prev.task.priority === next.task.priority &&
    prev.task.due_date === next.task.due_date &&
    prev.task.is_archived === next.task.is_archived &&
    prev.task.time_spent === next.task.time_spent &&
    prev.task.block_type === next.task.block_type &&
    prev.task.subtask_count === next.task.subtask_count &&
    prev.task.subtask_completed_count === next.task.subtask_completed_count &&
    prev.overlay === next.overlay &&
    prev.isAdmin === next.isAdmin &&
    prev.onClick === next.onClick &&
    prev.onArchived === next.onArchived &&
    prev.onDeleted === next.onDeleted
  );
});
