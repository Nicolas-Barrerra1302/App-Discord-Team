export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/supabase/database';
import { calculateAllMembersMetrics, getDateRange } from '@/lib/performance/metrics';

/** "all", "Todas", "Todos", "Todas las categorías", "Todos los tipos" → undefined */
function sanitizeFilter(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === 'all' || lower.startsWith('toda') || lower.startsWith('todo')) return undefined;
  return raw;
}

// =============================================================================
// GET /api/performance — Métricas de todos los miembros (solo admin/ceo)
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const range = searchParams.get('range') ?? 'week';
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const category = sanitizeFilter(searchParams.get('category') ?? undefined);
  const taskType = sanitizeFilter(searchParams.get('task_type') ?? undefined);

  const usersRaw = searchParams.get('users') ?? undefined;
  const userIds = usersRaw ? usersRaw.split(',').filter(Boolean) : undefined;

  const period = getDateRange(range, from, to);
  const filters = (category || taskType) ? { categoryId: category, taskType: taskType } : undefined;

  try {
    const metrics = await calculateAllMembersMetrics(supabase, period.from, period.to, filters, userIds);
    console.log('RESULTADO FINAL [team]:', metrics.map(m => ({
      user: m.user.name, crudas: m.tasks_total, pendientes: m.tasks_pending, overdue: m.tasks_overdue
    })));
    return NextResponse.json(metrics);
  } catch (err) {
    console.error('Error al calcular métricas [team]:', err, { range, from, to, category, taskType });
    return NextResponse.json(
      { error: 'Error al calcular métricas' },
      { status: 500 }
    );
  }
}
