import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/database";
import { getTodayColombia } from "@/lib/tasks/dates";
import { redirect } from "next/navigation";
import { RecurrencesManager } from "@/components/recurrences/recurrences-manager";
import type { TaskRecurrence, TaskCategory, User, UserAbsence } from "@/lib/types";

export default async function RecurrentesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) redirect("/login");

  const admin = isAdmin(user);

  // Fetch recurrence templates — members see only their own
  let recurrenceQuery = supabase
    .from("task_recurrences")
    .select("*")
    .order("created_at", { ascending: false });

  if (!admin) {
    recurrenceQuery = recurrenceQuery.eq("assigned_to", user.id);
  }

  const { data: recurrences } = (await recurrenceQuery) as {
    data: TaskRecurrence[] | null;
  };

  // Fetch users
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

  // Fetch active/upcoming absences
  const today = getTodayColombia();
  let absenceQuery = supabase
    .from("user_absences")
    .select("*")
    .gte("end_date", today)
    .order("start_date", { ascending: true });

  if (!admin) {
    absenceQuery = absenceQuery.eq("user_id", user.id);
  }

  const { data: absences } = (await absenceQuery) as {
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
