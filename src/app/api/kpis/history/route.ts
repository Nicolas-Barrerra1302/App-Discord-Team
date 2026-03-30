import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/supabase/database';
import type { KpiDefinition, KpiSubmission, KpiTracking } from '@/lib/types';
import { calculateKpiScores } from '@/lib/kpis/scoring';
import { getWeekLabel } from '@/lib/kpis/week-helpers';
import { parseDbNumeric } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/kpis/history?user_id=xxx&limit=12
// Returns last N weekly submissions with nested per-KPI breakdown
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get('user_id');
  const limitParam = parseInt(searchParams.get('limit') ?? '12', 10);
  const limit = isNaN(limitParam) || limitParam < 1 ? 12 : Math.min(limitParam, 52);

  // Access control
  const targetUserId = isAdmin(user) && userIdParam ? userIdParam : user.id;
  if (!isAdmin(user) && userIdParam && userIdParam !== user.id) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // ── Fetch submissions ───────────────────────────────────────────────────────
  const { data: submissions, error: subError } = (await supabase
    .from('kpi_submissions')
    .select('id, user_id, week_start, status, submitted_at, total_points, max_possible, bonus_event_id, created_at, updated_at')
    .eq('user_id', targetUserId)
    .order('week_start', { ascending: false })
    .limit(limit)) as { data: KpiSubmission[] | null; error: unknown };

  if (subError) {
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
  if (!submissions || submissions.length === 0) {
    return NextResponse.json([]);
  }

  // ── Batch fetch tracking entries for all returned weeks (N+1 prevention) ───
  const weekStarts = submissions.map((s) => s.week_start.substring(0, 10));

  const [trackingResult, definitionsResult] = await Promise.all([
    supabase
      .from('kpi_tracking')
      .select('id, user_id, kpi_id, week_start, value, created_at, updated_at')
      .eq('user_id', targetUserId)
      .in('week_start', weekStarts) as unknown as Promise<{ data: KpiTracking[] | null; error: unknown }>,

    supabase
      .from('kpi_definitions')
      .select('id, name, description, data_type, target_value, max_points, assigned_to, is_active, display_order, created_by, created_at')
      .eq('assigned_to', targetUserId) as unknown as Promise<{ data: KpiDefinition[] | null; error: unknown }>,
  ]);

  const allTracking = trackingResult.data ?? [];
  const allDefinitions = definitionsResult.data ?? [];

  // ── Build response: submission + per-week scoring breakdown ────────────────
  const result = submissions.map((sub) => {
    const subWeekStart = sub.week_start.substring(0, 10);
    const weekTracking = allTracking.filter(
      (t) => t.week_start.substring(0, 10) === subWeekStart
    );

    const scoring = calculateKpiScores(allDefinitions, weekTracking);

    return {
      submission: {
        ...sub,
        total_points: parseDbNumeric(sub.total_points),
        max_possible: parseDbNumeric(sub.max_possible),
      },
      week_label: getWeekLabel(subWeekStart),
      scoring,
    };
  });

  return NextResponse.json(result);
}
