import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/database";
import { getTodayColombia } from "@/lib/tasks/dates";
import { redirect } from "next/navigation";
import { RecurrencesManager } from "@/components/recurrences/recurrences-manager";
import type { TaskRecurrence, TaskCategory, User, UserAbsence } from "@/lib/types";

export default async function RecurrencesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user || !isAdmin(user)) redirect("/dashboard");

  // Fetch all recurrence templates
  const { data: recurrences } = (await supabase
    .from("task_recurrences")
    .select("*")
    .order("created_at", { ascending: false })) as {
    data: TaskRecurrence[] | null;
  };

  // Fetch all active users
  const { data: users } = (await supabase
    .from("users")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })) as { data: User[] | null };

  // Fetch categories
  const { data: categories } = (await supabase
    .from("task_categories")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })) as { data: TaskCategory[] | null };

  // Fetch active/upcoming absences (end_date >= today in COT)
  const today = getTodayColombia();
  const { data: absences } = (await supabase
    .from("user_absences")
    .select("*")
    .gte("end_date", today)
    .order("start_date", { ascending: true })) as {
    data: UserAbsence[] | null;
  };

  return (
    <RecurrencesManager
      initialRecurrences={recurrences ?? []}
      initialAbsences={absences ?? []}
      users={users ?? []}
      categories={categories ?? []}
      currentUser={user}
      serverToday={today}
    />
  );
}
