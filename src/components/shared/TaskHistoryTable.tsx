"use client";

import { useState, useCallback } from "react";
import { Clock, Flame, ChevronDown } from "lucide-react";
import { cn, formatTimeSpent } from "@/lib/utils";
import { isOverdue } from "@/lib/tasks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import type { Task, TaskCategory } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-priority-low",
  medium: "bg-priority-medium",
  high: "bg-priority-high",
  urgent: "bg-priority-urgent",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.substring(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return parseDateOnly(dateStr).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskHistoryTableProps {
  initialTasks: Task[];
  userId: string;
  categories: TaskCategory[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskHistoryTable({ initialTasks, userId, categories }: TaskHistoryTableProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [offset, setOffset] = useState(initialTasks.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialTasks.length >= PAGE_SIZE);

  const catMap = new Map(categories.map(c => [c.id, c]));

  const loadMoreTasks = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        assigned_to: userId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");

      const json = await res.json() as Task[] | { data?: Task[] };
      const newTasks = Array.isArray(json) ? json : (json.data ?? []);
      setTasks((prev) => [...prev, ...newTasks]);
      setOffset((prev) => prev + newTasks.length);
      setHasMore(newTasks.length >= PAGE_SIZE);
    } catch (err) {
      console.error("Error loading more tasks:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, offset, userId]);

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center text-text-muted">
        Sin tareas registradas
      </Card>
    );
  }

  return (
    <div>
      <Card className="overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-card-secondary">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium text-text-muted">Titulo</th>
                <th className="px-4 py-3 font-medium text-text-muted">Estado</th>
                <th className="hidden px-4 py-3 font-medium text-text-muted sm:table-cell">Tipo</th>
                <th className="hidden px-4 py-3 font-medium text-text-muted md:table-cell">Categoria</th>
                <th className="px-4 py-3 font-medium text-text-muted">Prioridad</th>
                <th className="px-4 py-3 font-medium text-text-muted">Fecha límite</th>
                <th className="hidden px-4 py-3 font-medium text-text-muted md:table-cell">Tiempo</th>
                <th className="px-4 py-3 font-medium text-text-muted">Completada el</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const cat = task.category_id ? catMap.get(task.category_id) : null;
                return (
                  <tr key={task.id} className="border-b border-border last:border-0 transition-colors hover:bg-white/[0.02]">
                    <td className="max-w-[240px] truncate px-4 py-3 text-text-heading">{task.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant={task.status as "pending" | "in_progress" | "completed" | "blocked"} className="rounded-full text-xs">
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Badge
                        variant={task.task_type === "incendio" ? "danger-neon" : "electric-blue"}
                        className="gap-1 rounded-full text-[11px]"
                      >
                        {task.task_type === "incendio" && <Flame className="h-3 w-3" />}
                        {task.task_type === "incendio" ? "Incendio" : "Planeada"}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {cat ? (
                        <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                          {cat.name}
                        </span>
                      ) : <span className="text-xs text-text-muted">{"\u2014"}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("inline-block h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} />
                        <span className="text-text">{PRIORITY_LABELS[task.priority]}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {isOverdue(task) ? (
                        <Badge variant="danger-neon" className="gap-1 rounded-full text-[10px]">
                          <Clock className="h-3 w-3" />
                          {formatDate(task.due_date)}
                        </Badge>
                      ) : (
                        <span className="text-text">{formatDate(task.due_date)}</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-text md:table-cell">
                      {task.time_spent != null ? formatTimeSpent(task.time_spent) : "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {task.completed_at ? (
                        <span className={
                          !task.due_date || task.completed_at.substring(0, 10) <= task.due_date.substring(0, 10)
                            ? "text-success-neon [text-shadow:0_0_6px_currentColor]"
                            : "text-danger-neon [text-shadow:0_0_6px_currentColor]"
                        }>
                          {formatDate(task.completed_at)}
                        </span>
                      ) : (
                        <span className="text-text-muted">{"\u2014"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Load more button */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={loadMoreTasks}
            disabled={isLoadingMore}
            isLoading={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore ? "Cargando..." : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Cargar más tareas
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
