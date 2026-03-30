"use client";

import { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";
import type { Task, User } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

interface KanbanColumnProps {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  tasks: (Task & { subtask_count?: number })[];
  onTaskClick: (task: Task) => void;
  users?: User[];
  isAdmin?: boolean;
  onArchived?: (taskId: string) => void;
  onDeleted?: (taskId: string) => void;
}

export const KanbanColumn = memo(function KanbanColumn({
  id,
  title,
  icon: Icon,
  color,
  tasks,
  onTaskClick,
  users,
  isAdmin,
  onArchived,
  onDeleted,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  // Stable items array — prevents SortableContext from seeing a new reference
  // on every render even when the task list hasn't changed.
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[200px] w-[85vw] min-w-[85vw] max-w-[85vw] shrink-0 snap-center flex-col rounded-xl border border-white/5 bg-card/50 transition-colors",
        "md:w-80 md:min-w-[300px] md:max-w-none md:shrink md:snap-align-none",
        isOver && "border-white/20 bg-card/80"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <Icon className="h-4 w-4" style={{ color }} />
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <span
          className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Tasks list */}
      <div className="flex-1 space-y-2 p-2">
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted/50">
              Sin tareas
            </p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                users={users}
                isAdmin={isAdmin}
                onArchived={onArchived}
                onDeleted={onDeleted}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}, (prev, next) => {
  // Bail early on stable scalar props and stable function references
  // (all callbacks are guaranteed stable via useCallback in KanbanBoard).
  if (
    prev.id !== next.id ||
    prev.title !== next.title ||
    prev.color !== next.color ||
    prev.isAdmin !== next.isAdmin ||
    prev.onTaskClick !== next.onTaskClick ||
    prev.onArchived !== next.onArchived ||
    prev.onDeleted !== next.onDeleted ||
    prev.users !== next.users
  ) return false;

  // Structural task comparison: only re-render if the task list in THIS column
  // actually changed. Because columnTasks useMemo creates new array references
  // for all columns on every recompute, reference equality alone would cause
  // all 4 columns to re-render on every drag. This comparator limits re-renders
  // to the source and destination columns only.
  const pt = prev.tasks;
  const nt = next.tasks;
  if (pt.length !== nt.length) return false;
  for (let i = 0; i < pt.length; i++) {
    if (
      pt[i].id !== nt[i].id ||
      pt[i].status !== nt[i].status ||
      pt[i].updated_at !== nt[i].updated_at
    ) return false;
  }
  return true;
});
