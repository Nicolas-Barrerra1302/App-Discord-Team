import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/database";
import { redirect } from "next/navigation";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import type { Task, TaskCategory, User } from "@/lib/types";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const param = (key: string): string | undefined => {
    const v = searchParams[key];
    return typeof v === "string" ? v : undefined;
  };

  // Build filtered query — mirrors GET /api/tasks logic
  let query = supabase
    .from("tasks")
    .select("*")
    .is("parent_task_id", null)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(50);

  // Members: only tasks where they are assigned_to OR created_by
  if (!isAdmin(user)) {
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
  }

  const status = param("status");
  const priority = param("priority");
  const categoryId = param("category_id");
  const assignedTo = param("assigned_to");
  const dueFrom = param("due_from");
  const dueTo = param("due_to");
  const search = param("search");

  if (status) query = query.eq("status", status as Task["status"]);
  if (priority) query = query.eq("priority", priority as Task["priority"]);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (assignedTo && isAdmin(user)) query = query.eq("assigned_to", assignedTo);
  if (dueFrom) query = query.gte("due_date", dueFrom);
  if (dueTo) query = query.lte("due_date", dueTo);
  if (search) {
    const sanitized = search.replace(/[,.()*%\\]/g, "").trim();
    if (sanitized) {
      query = query.or(
        `title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`
      );
    }
  }

  const { data: tasks } = (await query) as { data: Task[] | null };

  // Subtask counts
  const taskIds = (tasks ?? []).map((t) => t.id);
  const subtaskCounts: Record<string, number> = {};
  const completedCounts: Record<string, number> = {};

  if (taskIds.length > 0) {
    const { data: subtasks } = (await supabase
      .from("tasks")
      .select("parent_task_id, status")
      .in("parent_task_id", taskIds)) as {
      data: { parent_task_id: string; status: string }[] | null;
    };

    if (subtasks) {
      for (const s of subtasks) {
        subtaskCounts[s.parent_task_id] =
          (subtaskCounts[s.parent_task_id] || 0) + 1;
        if (s.status === "completed") {
          completedCounts[s.parent_task_id] =
            (completedCounts[s.parent_task_id] || 0) + 1;
        }
      }
    }
  }

  const tasksWithCounts = (tasks ?? []).map((t) => ({
    ...t,
    subtask_count: subtaskCounts[t.id] || 0,
    subtask_completed_count: completedCounts[t.id] || 0,
  })) as (Task & { subtask_count: number; subtask_completed_count: number })[];

  // Categories + Users (small datasets for UI controls)
  const { data: categories } = (await supabase
    .from("task_categories")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })) as { data: TaskCategory[] | null };

  const { data: users } = (await supabase
    .from("users")
    .select("id, name, avatar_url, role, area, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true })) as {
    data: Pick<
      User,
      "id" | "name" | "avatar_url" | "role" | "area" | "is_active"
    >[] | null;
  };

  return (
    <Suspense fallback={<KanbanSkeleton />}>
      <KanbanBoard
        initialTasks={tasksWithCounts}
        categories={categories ?? []}
        users={(users ?? []) as User[]}
        currentUser={user}
      />
    </Suspense>
  );
}

function KanbanSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="h-10 w-full rounded-lg bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
