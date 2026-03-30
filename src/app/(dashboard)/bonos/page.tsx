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

  // ── 1. Team member list (all roles need this) ──────────────────────────────
  const { data: users } = await supabase
    .from('users')
    .select('id, name, avatar_url, role, area, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true }) as {
    data: Pick<User, 'id' | 'name' | 'avatar_url' | 'role' | 'area' | 'is_active'>[] | null;
  };

  // ── 2. Active/projected launch ─────────────────────────────────────────────
  const { data: activeLaunch } = (await adminClient
    .from('bonus_launches')
    .select('id, name, status, revenue_bruto, margen_neto_pct, pool_pct')
    .in('status', ['active', 'projected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: ActiveLaunchSummary | null };

  // ── 3. Team ranking for the active launch ─────────────────────────────────
  let teamRanking: TeamRankingEntry[] = [];
  let myEstimatedBonus: number | null = null;

  if (activeLaunch) {
    const { data: events } = (await adminClient
      .from('bonus_events')
      .select('user_id, points')
      .eq('launch_id', activeLaunch.id)) as {
      data: { user_id: string; points: number }[] | null;
    };

    // Aggregate points per user
    const pointsMap: Record<string, number> = {};
    for (const evt of events ?? []) {
      pointsMap[evt.user_id] = (pointsMap[evt.user_id] ?? 0) + evt.points;
    }

    // Build ranking sorted by points desc
    teamRanking = (users ?? [])
      .map((u) => ({ userId: u.id, totalPoints: pointsMap[u.id] ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // ── 4. Estimated bonus for current user (server-side calculation) ─────────
    const revenue = parseFloat(activeLaunch.revenue_bruto ?? '0');
    const marginPct = parseFloat(activeLaunch.margen_neto_pct ?? '0');
    const poolPct = parseFloat(activeLaunch.pool_pct ?? '0');

    if (revenue > 0 && marginPct > 0 && poolPct > 0) {
      const membersInput = (users ?? []).map((u) => ({
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
        users={users ?? []}
        currentUser={user}
        activeLaunch={activeLaunch}
        teamRanking={teamRanking}
        myEstimatedBonus={myEstimatedBonus}
      />
    </div>
  );
}
