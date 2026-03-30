import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin } from '@/lib/supabase/database';
import { isValidWeekStart } from '@/lib/kpis/week-helpers';
import type { KpiTracking, KpiSubmission } from '@/lib/types';

// =============================================================================
// GET /api/kpis/tracking?week_start=YYYY-MM-DD&user_id=xxx
// Returns tracking entries + submission envelope for the given week
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('week_start');
  const userIdParam = searchParams.get('user_id');

  if (!weekStart || !isValidWeekStart(weekStart)) {
    return NextResponse.json({ error: 'week_start inválido (debe ser un lunes YYYY-MM-DD)' }, { status: 400 });
  }

  // Access control: members can only read their own data
  const targetUserId = isAdmin(user) && userIdParam ? userIdParam : user.id;
  if (!isAdmin(user) && userIdParam && userIdParam !== user.id) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const [trackingResult, submissionResult] = await Promise.all([
    supabase
      .from('kpi_tracking')
      .select('id, user_id, kpi_id, week_start, value, created_at, updated_at')
      .eq('user_id', targetUserId)
      .eq('week_start', weekStart) as unknown as Promise<{ data: KpiTracking[] | null; error: unknown }>,

    supabase
      .from('kpi_submissions')
      .select('id, user_id, week_start, status, submitted_at, total_points, max_possible, bonus_event_id, created_at, updated_at')
      .eq('user_id', targetUserId)
      .eq('week_start', weekStart)
      .maybeSingle() as unknown as Promise<{ data: KpiSubmission | null; error: unknown }>,
  ]);

  if (trackingResult.error) {
    console.error('Error al obtener tracking:', trackingResult.error);
    return NextResponse.json({ error: 'Error al obtener tracking' }, { status: 500 });
  }

  return NextResponse.json({
    tracking: trackingResult.data ?? [],
    submission: submissionResult.data ?? null,
  });
}

// =============================================================================
// PUT /api/kpis/tracking — Save draft values (upsert)
// Zero client trust: user_id is always derived from session
// Body: { week_start, entries: [{ kpi_id, value }] }
// =============================================================================
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const { week_start, entries } = body;

  if (!week_start || !isValidWeekStart(week_start)) {
    return NextResponse.json({ error: 'week_start inválido' }, { status: 400 });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'entries requerido' }, { status: 400 });
  }

  // Check submission status — cannot edit an already-submitted week
  const { data: existingSubmission } = (await supabase
    .from('kpi_submissions')
    .select('status')
    .eq('user_id', user.id)
    .eq('week_start', week_start)
    .maybeSingle()) as { data: { status: string } | null };

  if (existingSubmission?.status === 'submitted') {
    return NextResponse.json(
      { error: 'Esta semana ya fue enviada definitivamente' },
      { status: 409 }
    );
  }

  // Validate entries
  for (const entry of entries) {
    if (!entry.kpi_id || typeof entry.kpi_id !== 'string') {
      return NextResponse.json({ error: 'kpi_id inválido en entries' }, { status: 400 });
    }
    if (entry.value !== null && isNaN(parseFloat(entry.value))) {
      return NextResponse.json({ error: `Valor inválido para KPI ${entry.kpi_id}` }, { status: 400 });
    }
  }

  // UPSERT tracking entries (N+1 prevention: single upsert call with array)
  const rows = entries.map((e: { kpi_id: string; value: number | null }) => ({
    user_id: user.id,
    kpi_id: e.kpi_id,
    week_start,
    value: e.value,
  }));

  const { data: tracking, error: trackingError } = (await supabase
    .from('kpi_tracking')
    .upsert(rows as never, { onConflict: 'user_id,kpi_id,week_start' })
    .select('id, user_id, kpi_id, week_start, value, updated_at')) as {
    data: KpiTracking[] | null;
    error: unknown;
  };

  if (trackingError) {
    console.error('Error al guardar tracking:', trackingError);
    return NextResponse.json({ error: 'Error al guardar borrador' }, { status: 500 });
  }

  // Upsert submission envelope as 'draft'
  const { data: submission, error: submissionError } = (await supabase
    .from('kpi_submissions')
    .upsert(
      { user_id: user.id, week_start, status: 'draft' } as never,
      { onConflict: 'user_id,week_start', ignoreDuplicates: false }
    )
    .select('id, user_id, week_start, status, submitted_at, total_points, max_possible, updated_at')
    .single()) as { data: KpiSubmission | null; error: unknown };

  if (submissionError) {
    console.error('Error al guardar submission envelope:', submissionError);
    return NextResponse.json({ error: 'Error al guardar borrador' }, { status: 500 });
  }

  return NextResponse.json({ tracking: tracking ?? [], submission });
}
