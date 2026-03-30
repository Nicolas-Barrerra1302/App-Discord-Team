"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TaskCategory, TaskPriority, TaskStatus, User } from "@/lib/types";

const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string; color: string }[] = [
  { value: "all", label: "Todas", color: "#6B6A72" },
  { value: "pending", label: "Pendiente", color: "#FFB000" },
  { value: "in_progress", label: "En Progreso", color: "#38BFF5" },
  { value: "completed", label: "Completada", color: "#00FF7F" },
  { value: "blocked", label: "Bloqueada", color: "#FF004D" },
];

const PRIORITY_OPTIONS: { value: TaskPriority | "all"; label: string; color: string }[] = [
  { value: "all", label: "Todas", color: "#6B6A72" },
  { value: "low", label: "Baja", color: "#64748B" },
  { value: "medium", label: "Media", color: "#FFD740" },
  { value: "high", label: "Alta", color: "#FF8C00" },
  { value: "urgent", label: "Urgente", color: "#B026FF" },
];

interface TaskFiltersProps {
  categories: TaskCategory[];
  users: User[];
  showAssigneeFilter?: boolean;
}

export function TaskFiltersPanel({
  categories,
  users,
  showAssigneeFilter,
}: TaskFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Read current filter values from URL
  const status = (searchParams.get("status") ?? "all") as TaskStatus | "all";
  const priority = (searchParams.get("priority") ?? "all") as TaskPriority | "all";
  const categoryId = searchParams.get("category_id") ?? "all";
  const assignedTo = searchParams.get("assigned_to") ?? "all";
  const dueFrom = searchParams.get("due_from") ?? "";
  const dueTo = searchParams.get("due_to") ?? "";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all" && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("priority");
    params.delete("category_id");
    params.delete("assigned_to");
    params.delete("due_from");
    params.delete("due_to");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const activeCount = [
    status !== "all",
    priority !== "all",
    categoryId !== "all",
    assignedTo !== "all",
    !!dueFrom,
    !!dueTo,
  ].filter(Boolean).length;

  const isDefault = activeCount === 0;

  return (
    <div>
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className={cn(
          "border border-white/10",
          open
            ? "border-accent/30 bg-accent/10 text-accent hover:bg-accent/10"
            : "bg-card-secondary text-text-muted hover:text-text"
        )}
      >
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        Filtros
        {activeCount > 0 && (
          <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </Button>

      {/* Expandable panel */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "mt-3 max-h-[75vh] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="max-h-[75vh] overflow-y-auto overscroll-contain rounded-xl border border-white/5 bg-card/50 p-4 pb-6 space-y-4">
          {/* Status pills */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Estado
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateParam("status", opt.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    status === opt.value
                      ? "text-white"
                      : "bg-white/5 text-text-muted hover:bg-white/10"
                  )}
                  style={
                    status === opt.value
                      ? { backgroundColor: `${opt.color}30`, color: opt.color }
                      : undefined
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority pills */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Prioridad
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateParam("priority", opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    priority === opt.value
                      ? "text-white"
                      : "bg-white/5 text-text-muted hover:bg-white/10"
                  )}
                  style={
                    priority === opt.value
                      ? { backgroundColor: `${opt.color}30`, color: opt.color }
                      : undefined
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category + Date range row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Category */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Categoria
              </p>
              <select
                value={categoryId}
                onChange={(e) => updateParam("category_id", e.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-card-secondary px-3 text-xs text-text focus:border-accent/50 focus:outline-none"
              >
                <option value="all">Todas</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Desde
              </p>
              <input
                type="date"
                value={dueFrom}
                onChange={(e) => updateParam("due_from", e.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-card-secondary px-3 text-xs text-text focus:border-accent/50 focus:outline-none"
              />
            </div>

            {/* Date to */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Hasta
              </p>
              <input
                type="date"
                value={dueTo}
                onChange={(e) => updateParam("due_to", e.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-card-secondary px-3 text-xs text-text focus:border-accent/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Assignee filter (admin only) */}
          {showAssigneeFilter && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Asignado a
              </p>
              <select
                value={assignedTo}
                onChange={(e) => updateParam("assigned_to", e.target.value)}
                className="h-9 w-full rounded-lg border border-white/10 bg-card-secondary px-3 text-xs text-text focus:border-accent/50 focus:outline-none sm:w-1/3"
              >
                <option value="all">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear */}
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-text-muted hover:text-accent p-0 h-auto"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
