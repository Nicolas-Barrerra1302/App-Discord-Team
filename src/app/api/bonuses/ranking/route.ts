import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/supabase/database';

export interface RankingEntry {
  userId: string;
  totalPoints: number;
}

// =============================================================================
// GET /api/bonuses/ranking?launch_id=<uuid>
// Returns aggregated { userId, totalPoints }[] for all team members.
// Uses admin client so all users' events are visible regardless of RLS.
// Any authenticated user may call this endpoint (read-only leaderboard data).
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const launchId = new URL(request.url).searchParams.get('launch_id');
  if (!launchId) {
    return NextResponse.json({ error: 'launch_id es obligatorio' }, { status: 400 });
  }

  // Use admin client to read all users' events (aggregate, not individual detail)
  const adminClient = createAdminClient();

  // Fetch bonus-eligible users (excludes CEO per VIEW definition).
  // Fallback: if migration 024 hasn't been applied yet, filter the users table in-app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eligibleFromView } = await (adminClient as any)
    .from('bonus_eligible_users')
    .select('id') as { data: { id: string }[] | null };

  let eligibleIds: Set<string>;
  if (eligibleFromView && eligibleFromView.length > 0) {
    eligibleIds = new Set(eligibleFromView.map((u) => u.id));
  } else {
    // VIEW not yet deployed — fall back to users table filtered by role
    const { data: fallbackUsers } = await adminClient
      .from('users')
      .select('id')
      .eq('is_active', true)
      .neq('role', 'ceo') as { data: { id: string }[] | null };
    eligibleIds = new Set((fallbackUsers ?? []).map((u) => u.id));
  }

  const { data: events, error } = await adminClient
    .from('bonus_events')
    .select('user_id, points')
    .eq('launch_id', launchId)
    .in('user_id', Array.from(eligibleIds)) as { data: { user_id: string; points: number }[] | null; error: unknown };

  if (error) {
    console.error('Ranking: error al obtener eventos:', error);
    return NextResponse.json({ error: 'Error al obtener ranking' }, { status: 500 });
  }

  // Aggregate per eligible user — CEO rows never reach this reducer
  const pointsMap: Record<string, number> = {};
  for (const evt of events ?? []) {
    pointsMap[evt.user_id] = (pointsMap[evt.user_id] ?? 0) + evt.points;
  }

  const ranking: RankingEntry[] = Object.entries(pointsMap)
    .map(([userId, totalPoints]) => ({ userId, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json(ranking);
}
