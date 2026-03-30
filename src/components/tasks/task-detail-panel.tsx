"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X,
  Edit3,
  Archive,
  MessageSquare,
  ListChecks,
  Plus,
  Send,
  Loader2,
  Paperclip,
  ExternalLink,
  Flame,
  CalendarClock,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDate, isOverdue } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { SubtaskItem } from "./subtask-item";
import { CommentItem } from "./comment-item";
import type { Task, TaskCategory, User } from "@/lib/types";

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Baja", color: "#64748B" },
  medium: { label: "Media", color: "#FFD740" },
  high: { label: "Alta", color: "#FF8C00" },
  urgent: { label: "Urgente", color: "#B026FF" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#ff9800" },
  in_progress: { label: "En Progreso", color: "#2196f3" },
  completed: { label: "Completada", color: "#00e676" },
  blocked: { label: "Bloqueada", color: "#f44336" },
};

interface CommentData {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string | null;
}

interface TaskDetailPanelProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  categories: TaskCategory[];
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
  onEdit: (task: Task) => void;
}

export function TaskDetailPanel({
  task,
  isOpen,
  onClose,
  currentUser,
  categories,
  onTaskUpdated,
  onTaskDeleted,
  onEdit,
}: TaskDetailPanelProps) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  const category = categories.find((c) => c.id === task.category_id);
  const overdue = isOverdue(task);
  const priorityCfg = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.medium;
  const statusCfg = STATUS_LABELS[task.status] ?? STATUS_LABELS.pending;

  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSubtasks(data.subtasks ?? []);
      setComments(data.comments ?? []);
    } catch { /* ignore */ }
  }, [task.id]);

  useEffect(() => {
    if (isOpen) fetchDetails();
  }, [isOpen, fetchDetails]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const completedSubtasks = subtasks.filter((s) => s.status === "completed").length;
  const subtaskProgress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

  const handleSubtaskToggle = async (id: string, completed: boolean) => {
    const newStatus = completed ? "completed" : "pending";
    const previousSubtasks = subtasks;
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      // DT-3: Propagate updated subtask counts to parent Kanban
      const updatedSubtasks = subtasks.map((s) =>
        s.id === id ? { ...s, status: newStatus } : s
      );
      const newCompletedCount = updatedSubtasks.filter(
        (s) => s.status === "completed"
      ).length;
      onTaskUpdated({
        ...task,
        subtask_count: updatedSubtasks.length,
        subtask_completed_count: newCompletedCount,
      } as Task & { subtask_count: number; subtask_completed_count: number });
    } catch {
      setSubtasks(previousSubtasks);
    }
  };

  const handleAddSubtask = async () => {
    const title = newSubtask.trim();
    if (!title) return;
    setNewSubtask("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          parent_task_id: task.id,
          status: "pending",
          priority: "medium",
          assigned_to: task.assigned_to,
          due_date: task.due_date,
          category_id: task.category_id,
          task_type: task.task_type ?? "planeada",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        const newSubtasks = [...subtasks, created];
        setSubtasks(newSubtasks);
        // DT-3: Propagate new subtask count to parent Kanban
        const newCompletedCount = newSubtasks.filter(
          (s) => s.status === "completed"
        ).length;
        onTaskUpdated({
          ...task,
          subtask_count: newSubtasks.length,
          subtask_completed_count: newCompletedCount,
        } as Task & { subtask_count: number; subtask_completed_count: number });
      }
    } catch { /* ignore */ }
  };

  const handleAddComment = async () => {
    const content = newComment.trim();
    if (!content) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [...prev, created]);
        setNewComment("");
      }
    } catch { /* ignore */ }
    setCommentLoading(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        onTaskDeleted(task.id);
      }
    } catch { /* ignore */ }
    setDeleteLoading(false);
    setDeleteOpen(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l border-white/10 bg-background shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/5 bg-background px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-text-heading break-words">
              {task.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* Status badge — color from STATUS_LABELS, exempt via style={} */}
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${statusCfg.color}20`,
                  color: statusCfg.color,
                }}
              >
                {statusCfg.label}
              </span>
              {/* Priority badge — color from PRIORITY_LABELS, exempt via style={} */}
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${priorityCfg.color}20`,
                  color: priorityCfg.color,
                }}
              >
                {priorityCfg.label}
              </span>
              {overdue && (
                <Badge variant="danger">Atrasada</Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ml-4 h-8 w-8 text-text-muted hover:text-text"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Details */}
        <div className="space-y-6 px-6 py-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Fecha limite
              </p>
              <p
                className={cn(
                  "mt-1 text-text",
                  overdue && "text-danger-neon [text-shadow:0_0_8px_currentColor]"
                )}
              >
                {formatDueDate(task.due_date)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Categoria
              </p>
              <p className="mt-1 text-text">
                {category ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </span>
                ) : (
                  "Sin categoria"
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Tipo
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-text">
                {task.task_type === "incendio" ? (
                  <>
                    <Flame className="h-3.5 w-3.5 text-danger-neon" />
                    Incendio
                  </>
                ) : (
                  <>
                    <CalendarClock className="h-3.5 w-3.5 text-electric-blue" />
                    Planeada
                  </>
                )}
              </p>
            </div>
            {task.time_spent != null && task.time_spent > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Tiempo invertido
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-text">
                  <Timer className="h-3.5 w-3.5 text-success-neon" />
                  {Math.floor(task.time_spent / 60) > 0 && `${Math.floor(task.time_spent / 60)}h `}
                  {task.time_spent % 60}m
                </p>
              </div>
            )}
          </div>

          {/* Attachments */}
          {Array.isArray(task.attachments) && task.attachments.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-text-muted" />
                <p className="text-xs font-semibold text-text-muted">
                  Adjuntos ({task.attachments.length})
                </p>
              </div>
              <div className="space-y-1">
                {(task.attachments as string[]).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-info hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Descripcion
              </p>
              <p className="text-sm text-text/80 whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Subtasks */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-text-muted" />
              <p className="text-xs font-semibold text-text-muted">
                Subtareas ({completedSubtasks}/{subtasks.length})
              </p>
            </div>

            {subtasks.length > 0 && (
              <div className="mb-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>
            )}

            <div className="space-y-0.5">
              {subtasks.map((s) => (
                <SubtaskItem
                  key={s.id}
                  subtask={s}
                  onToggle={handleSubtaskToggle}
                />
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <Input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), handleAddSubtask())
                }
                placeholder="Agregar subtarea..."
                className="h-8 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddSubtask}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Comments */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-text-muted" />
              <p className="text-xs font-semibold text-text-muted">
                Comentarios ({comments.length})
              </p>
            </div>

            <div className="space-y-2 mb-3">
              {comments.length === 0 && (
                <p className="text-xs text-text-muted/50 py-2">
                  Sin comentarios aun
                </p>
              )}
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  isOwn={c.user_id === currentUser.id}
                />
              ))}
            </div>

            {/* Add comment */}
            <div className="flex gap-2">
              <Input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), handleAddComment())
                }
                placeholder="Escribe un comentario..."
                className="h-9 text-xs"
              />
              <Button
                variant="default"
                size="icon"
                onClick={handleAddComment}
                disabled={commentLoading || !newComment.trim()}
                className="h-9 w-9"
              >
                {commentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-white/5 bg-background px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(task)}
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="border border-warning/20 text-warning hover:bg-warning/10"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archivar
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Archivar tarea"
        message="La tarea sera archivada y dejara de aparecer en el Kanban. Los KPIs se preservan."
        isLoading={deleteLoading}
      />
    </>
  );
}
