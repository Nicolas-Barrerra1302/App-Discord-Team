import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/database";
import { calculateMemberMetrics, getWeekRange } from "@/lib/performance/metrics";
import { redirect } from "next/navigation";
import type { ActivityLogEvent } from "@/components/shared/ActivityLogFeed";
import { ActivityLogFeed } from "@/components/shared/ActivityLogFeed";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";

// ---------------------------------------------------------------------------
// Skeleton for the activity-log Suspense boundary
// ---------------------------------------------------------------------------
function ActivityLogSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando actividad reciente">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.07]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async Server Component — streams activity log independently from metrics
// ---------------------------------------------------------------------------
async function PersonalActivityLog({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: rawLogs } = (await supabase
    .from("activity_log")
    .select("id, user_id, action, target_name, impact, reason, created_at, users:user_id(name, avatar_url)")
    .eq("user_id", userId)
    .not("target_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(20)) as {
    data: Array<{
      id: string;
      user_id: string;
      action: string;
      target_name: string | null;
      impact: string | null;
      reason: string | null;
      created_at: string;
      users: { name: string; avatar_url: string | null } | null;
    }> | null;
  };

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

  return <ActivityLogFeed initialLogs={activityLogs} userId={userId} />;
}

// ---------------------------------------------------------------------------
// Page — fetches metrics first; activity log streams in via Suspense
// ---------------------------------------------------------------------------
export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) redirect("/login");

  const { from, to } = getWeekRange();
  const metrics = await calculateMemberMetrics(supabase, user, from, to);

  return (
    <PersonalDashboard
      metrics={metrics}
      activityLogSlot={
        <Suspense fallback={<ActivityLogSkeleton />}>
          <PersonalActivityLog userId={user.id} />
        </Suspense>
      }
    />
  );
}
