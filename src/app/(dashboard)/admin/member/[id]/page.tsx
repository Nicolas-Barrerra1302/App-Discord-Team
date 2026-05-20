import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/database";
import { calculateMemberMetrics, getWeekRange } from "@/lib/performance/metrics";
import { MemberDetail } from "@/components/dashboard/member-detail";
import type { ActivityLogEvent } from "@/components/shared/ActivityLogFeed";
import type { User } from "@/lib/types";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const currentUser = await getCurrentUser(supabase);

  if (!currentUser) redirect("/login");
  if (!isAdmin(currentUser)) redirect("/dashboard");

  // Fetch target user (only active users are accessible)
  const { data: targetUser } = (await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single()) as { data: User | null };

  if (!targetUser) redirect("/admin");

  // Fetch metrics for current week
  const { from, to } = getWeekRange();
  const metrics = await calculateMemberMetrics(supabase, targetUser, from, to);

  // Fetch activity log timeline for this member (first page, with user join)
  const { data: rawLogs } = (await supabase
    .from("activity_log")
    .select("id, user_id, action, target_name, impact, reason, created_at, users:user_id(name, avatar_url)")
    .eq("user_id", id)
    .not("target_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(20)) as { data: Array<{
      id: string;
      user_id: string;
      action: string;
      target_name: string | null;
      impact: string | null;
      reason: string | null;
      created_at: string;
      users: { name: string; avatar_url: string | null } | null;
    }> | null };

  const activityLogs: ActivityLogEvent[] = (rawLogs ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    user: {
      name: row.users?.name ?? "Usuario",
      avatar: row.users?.avatar_url ?? null,
    },
    action: row.action,
    target: row.target_name ?? "",
    timestamp: row.created_at,
    ...(row.impact ? { impact: row.impact } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
  }));

  // Fetch all active users for member switcher
  const { data: allUsers } = (await supabase
    .from("users")
    .select("*")
    .eq("is_active", true)
    .order("name")) as { data: User[] | null };

  return (
    <MemberDetail
      metrics={metrics}
      activityLogs={activityLogs}
      allUsers={allUsers ?? []}
    />
  );
}
