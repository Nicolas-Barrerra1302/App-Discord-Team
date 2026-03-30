"use client";

import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

interface SubtaskItemProps {
  subtask: Task;
  onToggle: (id: string, completed: boolean) => void;
}

export function SubtaskItem({ subtask, onToggle }: SubtaskItemProps) {
  const completed = subtask.status === "completed";

  return (
    <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer">
      <input
        type="checkbox"
        checked={completed}
        onChange={() => onToggle(subtask.id, !completed)}
        className="h-4 w-4 rounded border-white/20 bg-card-secondary accent-accent"
      />
      <span
        className={cn(
          "text-sm transition-colors",
          completed
            ? "text-text-muted line-through"
            : "text-text"
        )}
      >
        {subtask.title}
      </span>
    </label>
  );
}
