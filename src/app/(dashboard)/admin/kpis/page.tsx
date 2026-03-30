import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/database";
import { getCurrentWeekStart } from "@/lib/kpis/week-helpers";
import { AdminKpisClient } from "@/components/kpis/admin-kpis-client";
import type { User, KpiDefinition, KpiSubmission } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminKpisPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  // Fetch all active users (for assignment dropdown and Seguimiento table)
  const { data: users } = (await supabase
    .from("users")
    .select("id, name, avatar_url, role")
    .eq("is_active", true)
    .order("name", { ascending: true })) as {
    data: Pick<User, "id" | "name" | "avatar_url" | "role">[] | null;
  };

  // Fetch all KPI definitions (admin sees all, not just active)
  const { data: definitions } = (await supabase
    .from("kpi_definitions")
    .select(
      "id, name, description, data_type, direction, target_value, max_points, assigned_to, is_active, display_order, created_by, created_at"
    )
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })) as {
    data: KpiDefinition[] | null;
  };

  // Fetch current week submissions for Seguimiento tab
  const weekStart = getCurrentWeekStart();
  const { data: weekSubmissions } = (await supabase
    .from("kpi_submissions")
    .select(
      "id, user_id, week_start, status, submitted_at, total_points, max_possible"
    )
    .eq("week_start", weekStart)) as {
    data: Pick<
      KpiSubmission,
      "id" | "user_id" | "week_start" | "status" | "submitted_at" | "total_points" | "max_possible"
    >[] | null;
  };

  return (
    <AdminKpisClient
      initialUsers={users ?? []}
      initialDefinitions={definitions ?? []}
      weekStart={weekStart}
      initialWeekSubmissions={weekSubmissions ?? []}
    />
  );
}
