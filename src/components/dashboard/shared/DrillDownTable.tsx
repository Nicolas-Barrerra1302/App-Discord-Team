"use client";

import { Clock, Flame } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeSpent } from "@/lib/utils";
import { formatDateShort } from "@/lib/dashboard/utils";
import { isOverdue } from "@/lib/tasks";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRIORITY_DOT, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import type { Task, TaskCategory } from "@/lib/types";

interface DrillDownTableProps {
  title: string;
  tasks: Task[];
  catMap: Map<string, TaskCategory>;
  blockReasons?: Record<string, string>;
  showBlockReason?: boolean;
  onClose: () => void;
}

export function DrillDownTable({
  title,
  tasks,
  catMap,
  blockReasons,
  showBlockReason,
  onClose,
}: DrillDownTableProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-white/5 px-5 py-3">
        <CardTitle className="text-sm">
          {title} ({tasks.length})
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="h-8 w-8 text-text-muted hover:text-white hover:bg-transparent"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      {tasks.length > 0 ? (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-left text-sm" aria-label={title}>
            <thead className="sticky top-0 bg-card-secondary">
              <tr className="border-b border-white/5">
                <th scope="col" className="px-4 py-2 font-medium text-text-muted">Título</th>
                <th scope="col" className="px-4 py-2 font-medium text-text-muted">Estado</th>
                <th scope="col" className="hidden px-4 py-2 font-medium text-text-muted sm:table-cell">Tipo</th>
                <th scope="col" className="hidden px-4 py-2 font-medium text-text-muted md:table-cell">Categoría</th>
                <th scope="col" className="hidden px-4 py-2 font-medium text-text-muted sm:table-cell">Prioridad</th>
                <th scope="col" className="px-4 py-2 font-medium text-text-muted">Fecha límite</th>
                <th scope="col" className="px-4 py-2 font-medium text-text-muted">Completada el</th>
                <th scope="col" className="hidden px-4 py-2 font-medium text-text-muted md:table-cell">Tiempo</th>
                {showBlockReason && (
                  <th scope="col" className="px-4 py-2 font-medium text-text-muted">Motivo</th>
                )}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const cat = task.category_id ? catMap.get(task.category_id) : null;
                return (
                  <tr key={task.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-text-heading">{task.title}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={task.status as "pending" | "in_progress" | "completed" | "blocked"} className="rounded-full text-[11px]">
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <Badge
                        variant={task.task_type === "incendio" ? "danger-neon" : "electric-blue"}
                        className="gap-1 rounded-full text-[11px]"
                      >
                        {task.task_type === "incendio" && <Flame className="h-3 w-3" />}
                        {task.task_type === "incendio" ? "Incendio" : "Planeada"}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      {cat ? (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("inline-block h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])} />
                        <span className="text-text text-xs">{PRIORITY_LABELS[task.priority]}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                      {isOverdue(task) ? (
                        <Badge variant="danger-neon" className="gap-1 rounded-full text-[10px]">
                          <Clock className="h-3 w-3" />
                          {formatDateShort(task.due_date)}
                        </Badge>
                      ) : (
                        <span className="text-text">{formatDateShort(task.due_date)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                      {task.completed_at ? (
                        <span className={
                          !task.due_date || task.completed_at.substring(0, 10) <= task.due_date.substring(0, 10)
                            ? "text-success-neon [text-shadow:0_0_6px_currentColor]"
                            : "text-danger-neon [text-shadow:0_0_6px_currentColor]"
                        }>
                          {formatDateShort(task.completed_at)}
                        </span>
                      ) : (
                        <span className="text-text-muted">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-text text-xs md:table-cell">
                      {task.time_spent != null ? formatTimeSpent(task.time_spent) : "\u2014"}
                    </td>
                    {showBlockReason && (
                      <td className="max-w-[180px] truncate px-4 py-2.5 text-xs text-danger-neon [text-shadow:0_0_6px_currentColor]">
                        {blockReasons?.[task.id] ?? "\u2014"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <CardContent className="py-6 text-center text-sm text-text-muted">
          Sin tareas en esta categoría
        </CardContent>
      )}
    </Card>
  );
}
