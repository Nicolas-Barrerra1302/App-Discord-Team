"use client";

import Link from "next/link";
import { Plus, ArrowUpDown, Repeat } from "lucide-react";
import { TaskSearchBar } from "./task-search-bar";
import { TaskFiltersPanel } from "./task-filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskCategory, User } from "@/lib/types";
import type { SortMode } from "./kanban-board";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "default", label: "Reciente" },
  { value: "due_date", label: "Vencimiento" },
  { value: "priority", label: "Prioridad" },
];

interface TaskToolbarProps {
  categories: TaskCategory[];
  users: User[];
  isAdmin: boolean;
  onCreateTask: () => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
}

export function TaskToolbar({
  categories,
  users,
  isAdmin,
  onCreateTask,
  sortMode,
  onSortChange,
}: TaskToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Top row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TaskSearchBar />
        <div className="flex items-center gap-2">
          {/* Sort control */}
          <div className="flex items-center rounded-lg border border-white/10 bg-card-secondary">
            <ArrowUpDown className="ml-2.5 h-3.5 w-3.5 text-text-muted" />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={cn(
                  "px-2.5 py-2 text-xs font-medium transition-colors",
                  sortMode === opt.value
                    ? "text-accent"
                    : "text-text-muted hover:text-text"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <TaskFiltersPanel
            categories={categories}
            users={users}
            showAssigneeFilter={isAdmin}
          />
          <Link
            href="/tareas/recurrentes"
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-card-secondary px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-white/5 active:scale-95"
          >
            <Repeat className="h-4 w-4 text-info" />
            Recurrentes
          </Link>
          <Button
            variant="default"
            size="sm"
            onClick={onCreateTask}
            className="active:scale-95"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        </div>
      </div>
    </div>
  );
}
