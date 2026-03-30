export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/supabase/database';
import { calculateMemberMetrics, getDateRange } from '@/lib/performance/metrics';
import type { User } from '@/lib/types';

/** "all", "Todas", "Todos", "Todas las categorías", "Todos los tipos" → undefined */
function sanitizeFilter(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === 'all' || lower.startsWith('toda') || lower.startsWith('todo')) return undefined;
  return raw;
}

// =============================================================================
// GET /api/performance/[userId] — Métricas de un miembro específico
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser(supabase);

  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { userId: rawUserId } = await params;

  // "me" resolves to the authenticated user — used by personal dashboard
  const userId = rawUserId === 'me' ? currentUser.id : rawUserId;

  // Members can only see their own metrics; admins can see anyone's
  if (!isAdmin(currentUser) && currentUser.id !== userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Fetch target user
  const { data: targetUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single() as { data: User | null };

  if (!targetUser) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const range = searchParams.get('range') ?? 'week';
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const category = sanitizeFilter(searchParams.get('category') ?? undefined);
  const taskType = sanitizeFilter(searchParams.get('task_type') ?? undefined);

  const period = getDateRange(range, from, to);
  const filters = (category || taskType) ? { categoryId: category, taskType: taskType } : undefined;

  try {
    const metrics = await calculateMemberMetrics(supabase, targetUser, period.from, period.to, filters);
    console.log('RESULTADO FINAL [user]:', {
      user: metrics.user.name, crudas: metrics.tasks_total, pendientes: metrics.tasks_pending, overdue: metrics.tasks_overdue
    });
    return NextResponse.json(metrics);
  } catch (err) {
    console.error('Error al calcular métricas [userId]:', err, { userId, range, from, to, category, taskType });
    return NextResponse.json(
      { error: 'Error al calcular métricas' },
      { status: 500 }
    );
  }
}
