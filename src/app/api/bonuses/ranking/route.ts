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

  const { data: events, error } = await adminClient
    .from('bonus_events')
    .select('user_id, points')
    .eq('launch_id', launchId) as { data: { user_id: string; points: number }[] | null; error: unknown };

  if (error) {
    console.error('Ranking: error al obtener eventos:', error);
    return NextResponse.json({ error: 'Error al obtener ranking' }, { status: 500 });
  }

  // Aggregate per user
  const pointsMap: Record<string, number> = {};
  for (const evt of events ?? []) {
    pointsMap[evt.user_id] = (pointsMap[evt.user_id] ?? 0) + evt.points;
  }

  const ranking: RankingEntry[] = Object.entries(pointsMap)
    .map(([userId, totalPoints]) => ({ userId, totalPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json(ranking);
}
