export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/database";
import { calculateAllMembersMetrics, getWeekRange } from "@/lib/performance/metrics";
import { redirect } from "next/navigation";
import { TeamOverview } from "@/components/dashboard/team-overview";
import type { ActivityLogEvent } from "@/components/shared/ActivityLogFeed";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayColombia } from "@/lib/tasks/dates";
import type { User } from "@/lib/types";
import type { RawCheckin } from "@/components/dashboard/team-overview";

interface Props {
  searchParams: Promise<{ users?: string; from?: string; to?: string }>;
}

// ---------------------------------------------------------------------------
// Skeleton for the Suspense boundary around heavy admin data
// ---------------------------------------------------------------------------
function AdminDashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando panel de administración">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="h-4 w-36 animate-pulse rounded bg-white/[0.05]" />
        </div>
        <div className="h-10 w-56 animate-pulse rounded-lg bg-white/[0.07]" />
      </div>
      {/* Team member cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card-secondary p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-white/[0.07]" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 animate-pulse rounded bg-white/[0.07]" />
                <div className="h-3 w-16 animate-pulse rounded bg-white/[0.04]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-12 animate-pulse rounded-lg bg-white/[0.06]" />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Wide widgets row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card-secondary" />
        <div className="h-48 animate-pulse rounded-xl border border-border bg-card-secondary" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async Server Component — all heavy fetching isolated here for streaming
// ---------------------------------------------------------------------------
async function AdminDashboardSection({
  userParam,
  userIds,
}: {
  userParam: User;
  userIds: string[] | undefined;
}) {
  const supabase = await createClient();
  const { from, to } = getWeekRange();
  const todayCol = getTodayColombia();
  const thirtyDaysAgoDate = new Date(todayCol + 'T12:00:00Z');
  thirtyDaysAgoDate.setUTCDate(thirtyDaysAgoDate.getUTCDate() - 30);
  const thirtyDaysAgo = thirtyDaysAgoDate.toISOString().substring(0, 10);
  const adminSupa = createAdminClient();

  // Parallel fetch: allUsers, metrics, activity log, check-ins
  const [allUsersResult, metrics, rawLogsResult, rawCheckinsResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, avatar_url, role, area, is_active')
      .eq('is_active', true)
      .order('name'),
    calculateAllMembersMetrics(supabase, from, to, undefined, userIds),
    supabase
      .from("activity_log")
      .select("id, user_id, action, target_name, impact, reason, created_at, users:user_id(name, avatar_url)")
      .not("target_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
    adminSupa
      .from("daily_checkins")
      .select("user_id, checkin_date, hours_worked, fires_handled, blocks_count, summary, completion_pct")
      .gte("checkin_date", thirtyDaysAgo)
      .order("checkin_date", { ascending: true }),
  ]);

  const { data: allUsers } = allUsersResult as { data: User[] | null };
  const { data: rawLogs } = rawLogsResult as { data: Array<{
    id: string;
    user_id: string;
    action: string;
    target_name: string | null;
    impact: string | null;
    reason: string | null;
    created_at: string;
    users: { name: string; avatar_url: string | null } | null;
  }> | null };
  const { data: rawCheckins } = rawCheckinsResult as { data: RawCheckin[] | null };

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

  return (
    <TeamOverview
      metrics={metrics}
      currentUser={userParam}
      allUsers={allUsers ?? []}
      activityLogs={activityLogs}
      rawCheckins={rawCheckins ?? []}
    />
  );
}

// ---------------------------------------------------------------------------
// Page — auth guard runs immediately; heavy data streams via Suspense
// ---------------------------------------------------------------------------
export default async function AdminDashboardPage({ searchParams }: Props) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/dashboard");

  const sp = await searchParams;
  const userIds = sp.users ? sp.users.split(",").filter(Boolean) : undefined;

  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboardSection
        userParam={user}
        userIds={userIds}
      />
    </Suspense>
  );
}
