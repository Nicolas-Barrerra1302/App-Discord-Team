import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/supabase/database';
import { calculateBonuses } from '@/lib/bonuses/calculator';
import type { User, BonusLaunch, UserRole } from '@/lib/types';
import BonusesClient from '@/components/bonuses/bonuses-client';

export type ActiveLaunchSummary = Pick<
  BonusLaunch,
  'id' | 'name' | 'status' | 'revenue_bruto' | 'margen_neto_pct' | 'pool_pct'
>;

export interface TeamRankingEntry {
  userId: string;
  totalPoints: number;
}

export default async function BonusesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) return null;

  const adminClient = createAdminClient();

  // ── 1. Full user list for UI rendering (names, avatars, registrar tab) ─────
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, avatar_url, role, area, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true }) as {
    data: Pick<User, 'id' | 'name' | 'avatar_url' | 'role' | 'area' | 'is_active'>[] | null;
  };

  // ── 2. Bonus-eligible users — reads VIEW that excludes CEO ─────────────────
  // Fallback: if migration 024 hasn't been applied yet (VIEW doesn't exist),
  // filter allUsers in-app by role. Once the VIEW exists the DB layer takes over.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eligibleFromView } = await (adminClient as any)
    .from('bonus_eligible_users')
    .select('id, name, avatar_url, role, area, is_active')
    .order('name', { ascending: true }) as {
    data: Pick<User, 'id' | 'name' | 'avatar_url' | 'role' | 'area' | 'is_active'>[] | null;
  };

  const eligibleUsers: Pick<User, 'id' | 'name' | 'avatar_url' | 'role' | 'area' | 'is_active'>[] =
    (eligibleFromView && eligibleFromView.length > 0)
      ? eligibleFromView
      : (allUsers ?? []).filter((u) => u.role !== 'ceo');

  const eligibleIds = new Set(eligibleUsers.map((u) => u.id));

  // ── 3. Active/projected launch ─────────────────────────────────────────────
  const { data: activeLaunch } = (await adminClient
    .from('bonus_launches')
    .select('id, name, status, revenue_bruto, margen_neto_pct, pool_pct')
    .in('status', ['active', 'projected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: ActiveLaunchSummary | null };

  // ── 4. Team ranking for the active launch (CEO-free) ──────────────────────
  let teamRanking: TeamRankingEntry[] = [];
  let myEstimatedBonus: number | null = null;

  if (activeLaunch) {
    // Fetch only events from bonus-eligible users — CEO rows never reach the reducer
    const { data: events } = (await adminClient
      .from('bonus_events')
      .select('user_id, points')
      .eq('launch_id', activeLaunch.id)
      .in('user_id', Array.from(eligibleIds))) as {
      data: { user_id: string; points: number }[] | null;
    };

    // Aggregate points per eligible user
    const pointsMap: Record<string, number> = {};
    for (const evt of events ?? []) {
      pointsMap[evt.user_id] = (pointsMap[evt.user_id] ?? 0) + evt.points;
    }

    // Build ranking sorted by points desc — CEO excluded via eligibleUsers source
    teamRanking = (eligibleUsers ?? [])
      .map((u) => ({ userId: u.id, totalPoints: pointsMap[u.id] ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // ── 5. Estimated bonus for current user (server-side calculation) ─────────
    const revenue = parseFloat(activeLaunch.revenue_bruto ?? '0');
    const marginPct = parseFloat(activeLaunch.margen_neto_pct ?? '0');
    const poolPct = parseFloat(activeLaunch.pool_pct ?? '0');

    if (revenue > 0 && marginPct > 0 && poolPct > 0) {
      // eligibleUsers already excludes CEO — no extra .filter() needed
      const membersInput = (eligibleUsers ?? []).map((u) => ({
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatar_url,
        role: u.role as UserRole,
        points: pointsMap[u.id] ?? 0,
      }));

      const simulation = calculateBonuses(revenue, marginPct, poolPct, membersInput);
      const myResult = simulation.results.find((r) => r.userId === user.id);
      myEstimatedBonus = myResult?.simulatedBonus ?? null;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-6">Bonos</h1>
      <BonusesClient
        users={allUsers ?? []}
        currentUser={user}
        activeLaunch={activeLaunch}
        teamRanking={teamRanking}
        myEstimatedBonus={myEstimatedBonus}
      />
    </div>
  );
}
