import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/supabase/database';

// =============================================================================
// GET /api/activity — Paginated activity log
// Query params: users (comma-separated IDs), limit (default 20), offset (default 0)
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);
  const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;
  const usersParam = searchParams.get('users') || undefined;

  // Parse multi-user filter
  const userIds = usersParam ? usersParam.split(',').filter(Boolean) : undefined;

  // Build query
  let query = supabase
    .from('activity_log')
    .select('id, user_id, action, target_name, impact, reason, created_at, users:user_id(name, avatar_url)');

  // Access control: non-admins can only see their own activity
  if (!isAdmin(user)) {
    query = query.eq('user_id', user.id);
  } else if (userIds && userIds.length === 1) {
    query = query.eq('user_id', userIds[0]);
  } else if (userIds && userIds.length > 1) {
    query = query.in('user_id', userIds);
  }
  // If admin and no userIds filter → return all activity

  const { data: rawLogs, error } = (await query
    .not('target_name', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)) as { data: Array<{
    id: string;
    user_id: string;
    action: string;
    target_name: string | null;
    impact: string | null;
    reason: string | null;
    created_at: string;
    users: { name: string; avatar_url: string | null } | null;
  }> | null; error: unknown };

  if (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Error al obtener actividad' }, { status: 500 });
  }

  const logs = (rawLogs ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    user: {
      name: row.users?.name ?? 'Usuario',
      avatar: row.users?.avatar_url ?? null,
    },
    action: row.action,
    target: row.target_name ?? '',
    timestamp: row.created_at,
    ...(row.impact ? { impact: row.impact } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
  }));

  return NextResponse.json({
    data: logs,
    hasMore: logs.length === limit,
  });
}
