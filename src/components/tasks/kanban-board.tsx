"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Clock,
  PlayCircle,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  X,
  Loader2,
  Timer,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Task, TaskCategory, TaskStatus, User } from "@/lib/types";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { TaskToolbar } from "./task-toolbar";
import { TaskModal } from "./task-modal";
import { TaskDetailPanel } from "./task-detail-panel";

const COLUMNS: {
  id: TaskStatus;
  title: string;
  icon: typeof Clock;
  color: string;
}[] = [
  { id: "pending", title: "Pendiente", icon: Clock, color: "#ff9800" },
  { id: "in_progress", title: "En Progreso", icon: PlayCircle, color: "#2196f3" },
  { id: "blocked", title: "Bloqueada", icon: ShieldAlert, color: "#f44336" },
  { id: "completed", title: "Completada", icon: CheckCircle2, color: "#00e676" },
];

const COLUMN_IDS = new Set(COLUMNS.map((c) => c.id as string));

/** Valid DB enum values — guards resolved drop targets before API calls */
const VALID_STATUSES: readonly TaskStatus[] = ["pending", "in_progress", "completed", "blocked"] as const;

/**
 * Custom collision detection: prioritise column droppables when the pointer
 * is physically inside one. This prevents `closestCorners` from picking a
 * compact task-card droppable in an adjacent column over a large empty column.
 */
const columnAwareCollision: CollisionDetection = (args) => {
  // 1. Check which droppables the pointer is physically inside
  const withinCollisions = pointerWithin(args);
  // 2. Keep only column-level droppables
  const columnHits = withinCollisions.filter((c) => COLUMN_IDS.has(String(c.id)));
  if (columnHits.length > 0) return columnHits;
  // 3. Fallback to closestCorners (handles edge cases like fast drags)
  return closestCorners(args);
};

export type SortMode = "default" | "due_date" | "priority";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface KanbanBoardProps {
  initialTasks: (Task & { subtask_count?: number; subtask_completed_count?: number })[];
  categories: TaskCategory[];
  users: User[];
  currentUser: User;
}

// ---------------------------------------------------------------------------
// Block-reason modal (shown before moving a task to "blocked")
// ---------------------------------------------------------------------------
function BlockReasonModal({
  task,
  onConfirm,
  onCancel,
}: {
  task: Task;
  onConfirm: (blockType: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [blockType, setBlockType] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!blockType) {
      setError("Selecciona el tipo de bloqueo");
      return;
    }
    if (!reason.trim()) {
      setError("El motivo del bloqueo es obligatorio");
      return;
    }
    setSaving(true);
    onConfirm(blockType, reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/10 bg-card-secondary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <ShieldAlert className="h-5 w-5 text-danger" />
          <div>
            <h3 className="text-sm font-semibold text-text-heading">
              Motivo del bloqueo
            </h3>
            <p className="text-xs text-text-muted line-clamp-1">
              {task.title}
            </p>
          </div>
        </div>

        <div className="space-y-3 px-6 py-4">
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-text-muted">
              Tipo de bloqueo *
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBlockType("interno")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium",
                  blockType === "interno"
                    ? "border-warning/50 bg-warning/10 text-warning"
                    : "border-border bg-card text-text-muted hover:bg-white/5"
                )}
              >
                Interno (Equipo)
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBlockType("externo")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium",
                  blockType === "externo"
                    ? "border-danger/50 bg-danger/10 text-danger"
                    : "border-border bg-card text-text-muted hover:bg-white/5"
                )}
              >
                Externo (Cliente)
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-text-muted">
              Motivo *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explica por qué la tarea está bloqueada..."
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-muted/50 focus:border-accent/50 focus:outline-none resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) handleSave();
              }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 px-6 py-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Bloquear
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time-spent modal (shown before marking a task as completed)
// ---------------------------------------------------------------------------
function TimeSpentModal({
  task,
  onConfirm,
  onCancel,
}: {
  task: Task;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
}) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const h = parseInt(hours || "0", 10);
    const m = parseInt(minutes || "0", 10);
    if (isNaN(h) || isNaN(m) || (h === 0 && m === 0)) {
      setError("Ingresa al menos 1 minuto");
      return;
    }
    if (h < 0 || m < 0) {
      setError("Los valores deben ser positivos");
      return;
    }
    setSaving(true);
    onConfirm(h * 60 + m);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/10 bg-card-secondary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <Timer className="h-5 w-5 text-success" />
          <div>
            <h3 className="text-sm font-semibold text-text-heading">
              Registrar tiempo invertido
            </h3>
            <p className="text-xs text-text-muted line-clamp-1">
              {task.title}
            </p>
          </div>
        </div>

        <div className="space-y-3 px-6 py-4">
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-text-muted">
                Horas
              </label>
              <Input
                type="number"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="text-center text-lg"
                autoFocus
              />
            </div>
            <span className="pb-2 text-lg text-text-muted">:</span>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-text-muted">
                Minutos
              </label>
              <Input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                className="text-center text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 px-6 py-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={saving}
            className="bg-success hover:bg-success/80 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Completar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------
export function KanbanBoard({
  initialTasks,
  categories: initialCategories,
  users,
  currentUser,
}: KanbanBoardProps) {
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState(initialTasks);
  const [categories, setCategories] = useState(initialCategories);
  const [loading, setLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Time-spent modal state
  const [timeTask, setTimeTask] = useState<{
    task: Task;
    newStatus: TaskStatus;
  } | null>(null);

  // Block-reason modal state
  const [blockTask, setBlockTask] = useState<{
    task: Task;
    newStatus: TaskStatus;
  } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToastMsg({ type, text: message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const showErrorToast = useCallback((msg: string) => {
    showToast("error", msg);
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Fetch tasks from API when URL params change (skip first render — server already fetched)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    let cancelled = false;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tasks?${searchParams.toString()}`);
        if (res.ok && !cancelled) {
          setTasks(await res.json());
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    };

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const isAdmin = currentUser.role === "super_admin" || currentUser.role === "ceo";

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Stable column arrays — only recompute when tasks or sortMode change
  const columnTasks = useMemo(() => {
    const map: Record<TaskStatus, (Task & { subtask_count?: number; subtask_completed_count?: number })[]> = {
      pending: [],
      in_progress: [],
      blocked: [],
      completed: [],
    };
    for (const t of tasks) {
      if (!t.is_archived && map[t.status]) {
        map[t.status].push(t);
      }
    }
    if (sortMode === "due_date") {
      for (const status of VALID_STATUSES) {
        map[status].sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
      }
    } else if (sortMode === "priority") {
      for (const status of VALID_STATUSES) {
        map[status].sort(
          (a, b) =>
            (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
        );
      }
    }
    return map;
  }, [tasks, sortMode]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      setActiveTask(task ?? null);
    },
    [tasks]
  );

  // Helper: actually PUT the status change to API
  const applyStatusChange = useCallback(
    async (
      taskId: string,
      originalTask: Task,
      newStatus: TaskStatus,
      timeSpent?: number
    ) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus,
                completed_at:
                  newStatus === "completed" ? new Date().toISOString() : null,
                time_spent:
                  timeSpent !== undefined ? timeSpent : t.time_spent,
              }
            : t
        )
      );

      try {
        const body: Record<string, unknown> = { status: newStatus };
        if (timeSpent !== undefined) body.time_spent = timeSpent;
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
      } catch {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? originalTask : t))
        );
        showErrorToast("Error al mover la tarea. Se revirtió el cambio.");
      }
    },
    [showErrorToast]
  );

  // Resolve the target column when a drop lands on a task card instead of
  // the column droppable.  When over.id is a task UUID we look up which
  // column that task belongs to and use *that* status.
  const resolveDropColumn = useCallback(
    (overId: string | number): TaskStatus | null => {
      const id = String(overId);
      // If overId matches a valid column id directly, use it
      if (VALID_STATUSES.includes(id as TaskStatus)) return id as TaskStatus;
      // Otherwise it's a task id — find the task and return its status
      const overTask = tasks.find((t) => t.id === id);
      if (!overTask) return null;
      // Guard: ensure the task's status is a valid enum
      if (VALID_STATUSES.includes(overTask.status as TaskStatus)) {
        return overTask.status as TaskStatus;
      }
      return null;
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const newStatus = resolveDropColumn(over.id);
      // Strict guard: only proceed with valid DB enums
      if (!newStatus || !VALID_STATUSES.includes(newStatus)) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;

      // If moving to completed → show time-spent modal first
      if (newStatus === "completed" && task.status !== "completed") {
        setTimeTask({ task, newStatus });
        return;
      }

      // If moving to blocked → show block-reason modal first
      if (newStatus === "blocked" && task.status !== "blocked") {
        setBlockTask({ task, newStatus });
        return;
      }

      applyStatusChange(taskId, task, newStatus);
    },
    [tasks, applyStatusChange, resolveDropColumn]
  );

  // Called when user confirms time in the modal
  const handleTimeConfirm = useCallback(
    (minutes: number) => {
      if (!timeTask) return;
      applyStatusChange(
        timeTask.task.id,
        timeTask.task,
        timeTask.newStatus,
        minutes
      );
      setTimeTask(null);
    },
    [timeTask, applyStatusChange]
  );

  const handleTimeCancelled = useCallback(() => {
    setTimeTask(null);
  }, []);

  // Called when user confirms reason in block modal
  const handleBlockConfirm = useCallback(
    async (blockType: string, reason: string) => {
      if (!blockTask) return;
      const { task } = blockTask;

      const dbBlockType = blockType === "interno" ? "internal" : "external";

      // Save the block reason as a comment
      try {
        const label = blockType === "interno" ? "Interno (Equipo)" : "Externo (Cliente/Proveedor)";
        await fetch(`/api/tasks/${task.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🚫 Bloqueada — ${label}: ${reason}`,
          }),
        });
      } catch {
        /* comment save failed — still apply status */
      }

      // Optimistic update with block fields
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: "blocked" as const, block_type: dbBlockType, block_reason: reason, completed_at: null }
            : t
        )
      );

      try {
        const res = await fetch(`/api/tasks/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "blocked",
            block_type: dbBlockType,
            block_reason: reason,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? task : t))
        );
        showErrorToast("Error al bloquear la tarea. Se revirtió el cambio.");
      }

      setBlockTask(null);
    },
    [blockTask, showErrorToast]
  );

  const handleBlockCancelled = useCallback(() => {
    setBlockTask(null);
  }, []);

  const handleTaskClick = useCallback((task: Task) => {
    setDetailTask(task);
  }, []);

  const handleCreateTask = useCallback(() => {
    setEditingTask(undefined);
    setModalOpen(true);
  }, []);

  const handleTaskSaved = useCallback((saved: Task) => {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === saved.id);
      if (exists) {
        return prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t));
      }
      return [saved, ...prev];
    });
    setModalOpen(false);
    setEditingTask(undefined);
  }, []);

  const handleTaskUpdated = useCallback((updated: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
    );
    setDetailTask(updated);
  }, []);

  const handleTaskDeleted = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_archived: true } : t))
    );
    setDetailTask(null);
  }, []);

  // Called from TaskCard action menu: archive (same as detail panel delete)
  const handleCardArchived = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_archived: true } : t))
    );
  }, []);

  // Called from TaskCard action menu: permanent hard delete
  const handleCardHardDeleted = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const handleEditFromDetail = useCallback((task: Task) => {
    setDetailTask(null);
    setEditingTask(task);
    setModalOpen(true);
  }, []);

  const handleCategoriesChanged = useCallback((cats: TaskCategory[]) => {
    setCategories(cats);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingTask(undefined);
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailTask(null);
  }, []);

  const visibleCount = useMemo(
    () => tasks.filter((t) => !t.is_archived).length,
    [tasks]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {isAdmin ? "Todas las Tareas" : "Mis Tareas"}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {visibleCount} tarea{visibleCount !== 1 ? "s" : ""} en total
        </p>
      </div>

      {/* Toolbar: search + filters + create */}
      <TaskToolbar
        categories={categories}
        users={users}
        isAdmin={isAdmin}
        onCreateTask={handleCreateTask}
        sortMode={sortMode}
        onSortChange={setSortMode}
      />

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={columnAwareCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={cn(
            "flex flex-nowrap gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none transition-opacity",
            loading && "opacity-60"
          )}
        >
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              icon={col.icon}
              color={col.color}
              tasks={columnTasks[col.id]}
              onTaskClick={handleTaskClick}
              users={users}
              isAdmin={isAdmin}
              onArchived={handleCardArchived}
              onDeleted={handleCardHardDeleted}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} onClick={handleTaskClick} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Loading indicator */}
      {loading && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-xl border border-border bg-card-secondary px-4 py-2 shadow-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="text-xs text-text-muted">Actualizando...</span>
        </div>
      )}

      {/* Create / Edit modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        task={editingTask}
        categories={categories}
        users={users}
        currentUser={currentUser}
        onSaved={handleTaskSaved}
        onCategoriesChanged={handleCategoriesChanged}
        onToast={showToast}
      />

      {/* Time-spent modal */}
      {timeTask && (
        <TimeSpentModal
          task={timeTask.task}
          onConfirm={handleTimeConfirm}
          onCancel={handleTimeCancelled}
        />
      )}

      {/* Block-reason modal */}
      {blockTask && (
        <BlockReasonModal
          task={blockTask.task}
          onConfirm={handleBlockConfirm}
          onCancel={handleBlockCancelled}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border bg-card-secondary px-4 py-3 shadow-2xl ${
          toastMsg.type === "error"
            ? "border-danger/30"
            : "border-success/30"
        }`}>
          <AlertTriangle className={`h-5 w-5 shrink-0 ${
            toastMsg.type === "error" ? "text-danger" : "text-success"
          }`} />
          <p className="text-sm text-text">{toastMsg.text}</p>
          <button
            onClick={() => setToastMsg(null)}
            className="ml-1 rounded p-0.5 text-text-muted hover:text-text-heading transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          isOpen={!!detailTask}
          onClose={handleDetailClose}
          currentUser={currentUser}
          categories={categories}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
          onEdit={handleEditFromDetail}
        />
      )}
    </div>
  );
}
