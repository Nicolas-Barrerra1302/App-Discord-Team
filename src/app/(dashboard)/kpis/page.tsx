import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/database";
import {
  getCurrentWeekStart,
  isBeforeDeadline,
  getDeadlineUtc,
} from "@/lib/kpis/week-helpers";
import { KpisClient } from "@/components/kpis/kpis-client";
import type { KpiDefinition, KpiTracking, KpiSubmission } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KpisPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const weekStart = getCurrentWeekStart();
  const deadlineUtc = getDeadlineUtc(weekStart);
  // Compute once on server — enforces COT deadline authoritatively
  const serverDeadlinePassed = !isBeforeDeadline(weekStart);

  // Fetch active KPI definitions assigned to this user
  const { data: definitions } = (await supabase
    .from("kpi_definitions")
    .select(
      "id, name, description, data_type, direction, target_value, max_points, assigned_to, is_active, display_order, created_by, created_at"
    )
    .eq("assigned_to", user.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })) as { data: KpiDefinition[] | null };

  // Fetch tracking values for current week
  const { data: tracking } = (await supabase
    .from("kpi_tracking")
    .select("id, user_id, kpi_id, week_start, value, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)) as { data: KpiTracking[] | null };

  // Fetch submission envelope for current week (null = no entry yet)
  const { data: submission } = (await supabase
    .from("kpi_submissions")
    .select(
      "id, user_id, week_start, status, submitted_at, total_points, max_possible, bonus_event_id, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle()) as { data: KpiSubmission | null };

  return (
    <KpisClient
      definitions={definitions ?? []}
      initialTracking={tracking ?? []}
      initialSubmission={submission}
      weekStart={weekStart}
      deadlineUtc={deadlineUtc}
      serverDeadlinePassed={serverDeadlinePassed}
    />
  );
}
