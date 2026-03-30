import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, logActivity } from '@/lib/supabase/database';
import { isBeforeDeadline, isValidWeekStart, getWeekLabel } from '@/lib/kpis/week-helpers';
import { calculateKpiScores, toIntegerPoints } from '@/lib/kpis/scoring';
import { getTodayColombia } from '@/lib/tasks/dates';
import type { KpiDefinition, KpiTracking, KpiSubmission, BonusLaunch } from '@/lib/types';

// =============================================================================
// POST /api/kpis/submit
//
// Body: {
//   week_start: "YYYY-MM-DD",
//   entries?: Array<{ kpi_id: string; value: number | null }>
// }
//
// The `entries` field fixes the race condition: if a member clicks
// "Enviar Definitivo" without first clicking "Guardar Borrador", the server
// would read empty DB rows and calculate 0 points. Now the client sends its
// latest in-memory state alongside the submit request, and the server always
// upserts those values before scoring.
//
// Flow:
//   1. Auth + deadline validation
//   2. Idempotency guard
//   3. If entries provided → UPSERT kpi_tracking (latest client state)
//   4. Fetch active definitions + tracking from DB
//   5. Calculate score (pure function)
//   6. Create bonus_event if active launch exists
//   7. Upsert kpi_submissions as 'submitted' (atomic rollback on failure)
//   8. Side effects: logActivity (target_name + impact for ActivityLogFeed)
// =============================================================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 });
  }

  // Zero-Trust: reject pre-calculated metric fields — scoring is always server-side
  const PROHIBITED_KPI_FIELDS = [
    'points', 'total_points', 'max_possible', 'score', 'scoring',
    'user_id', 'submitted_at', 'status', 'bonus_event_id',
  ];
  const prohibitedFound = PROHIBITED_KPI_FIELDS.filter((f) => f in body);
  if (prohibitedFound.length > 0) {
    return NextResponse.json(
      { error: `Payload contiene campos prohibidos (métricas pre-calculadas): ${prohibitedFound.join(', ')}` },
      { status: 400 }
    );
  }

  const { week_start, entries } = body as {
    week_start: string;
    entries?: Array<{ kpi_id: string; value: number | null }>;
  };

  // ── 1. Validate week_start ──────────────────────────────────────────────────
  if (!week_start || !isValidWeekStart(week_start)) {
    return NextResponse.json(
      { error: 'week_start inválido (debe ser lunes YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // ── 2. Enforce Sunday 11:59 PM COT deadline ─────────────────────────────────
  if (!isBeforeDeadline(week_start)) {
    return NextResponse.json(
      { error: 'La fecha límite para esta semana ya pasó. Los puntos para esta semana son 0.' },
      { status: 400 }
    );
  }

  // ── 3. Idempotency — reject if already submitted ────────────────────────────
  const { data: existingSubmission } = (await supabase
    .from('kpi_submissions')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('week_start', week_start)
    .maybeSingle()) as { data: { id: string; status: string } | null };

  if (existingSubmission?.status === 'submitted') {
    return NextResponse.json(
      { error: 'Esta semana ya fue enviada definitivamente' },
      { status: 409 }
    );
  }

  // ── 4. Fetch active KPI definitions assigned to this user (moved before upsert) ─
  // Definitions are fetched first so we can validate entry kpi_ids against this
  // user's actual assignments before writing anything to kpi_tracking.
  // Without this order, a member could upsert tracking rows for kpi_ids assigned
  // to other users (their user_id would be correct, but the kpi_id would be wrong,
  // creating garbage audit data).
  const { data: definitions, error: defError } = (await supabase
    .from('kpi_definitions')
    .select(
      'id, name, description, data_type, target_value, max_points, assigned_to, is_active, display_order, direction, created_by, created_at'
    )
    .eq('assigned_to', user.id)
    .eq('is_active', true)) as { data: KpiDefinition[] | null; error: unknown };

  if (defError || !definitions) {
    return NextResponse.json({ error: 'Error al obtener KPIs' }, { status: 500 });
  }
  if (definitions.length === 0) {
    return NextResponse.json({ error: 'No hay KPIs activos asignados' }, { status: 400 });
  }

  // ── 5. Upsert tracking entries if provided (race-condition fix) ─────────────
  // The client sends its latest in-memory state so the server always has
  // the most recent values before scoring — even if "Save Draft" was never clicked.
  if (Array.isArray(entries) && entries.length > 0) {
    // Bound entries array size — the real KPI count per user is in the single digits
    if (entries.length > 50) {
      return NextResponse.json({ error: 'entries excede el máximo de 50 entradas' }, { status: 400 });
    }

    // Build ownership set from verified definitions (prevents kpi_id injection)
    const assignedKpiIds = new Set(definitions.map((d) => d.id));

    // Validate each entry before writing
    for (const e of entries) {
      if (!e.kpi_id || typeof e.kpi_id !== 'string') {
        return NextResponse.json({ error: 'kpi_id inválido en entries' }, { status: 400 });
      }
      // Ownership guard: reject kpi_ids not assigned to the authenticated user
      if (!assignedKpiIds.has(e.kpi_id)) {
        return NextResponse.json(
          { error: `KPI ${e.kpi_id} no está asignado a este usuario` },
          { status: 400 }
        );
      }
      if (e.value !== null && (!Number.isFinite(Number(e.value)) || isNaN(Number(e.value)))) {
        return NextResponse.json(
          { error: `Valor inválido para KPI ${e.kpi_id}` },
          { status: 400 }
        );
      }
    }

    const rows = entries.map((e) => ({
      user_id: user.id,
      kpi_id: e.kpi_id,
      week_start,
      value: e.value,
    }));

    const { error: upsertError } = await supabase
      .from('kpi_tracking')
      .upsert(rows as never, { onConflict: 'user_id,kpi_id,week_start' });

    if (upsertError) {
      console.error('Error al guardar tracking antes de submit:', upsertError);
      return NextResponse.json({ error: 'Error al guardar los valores' }, { status: 500 });
    }
  }

  // ── 6. Fetch tracking entries for this week (now includes any just-upserted) ─
  const { data: tracking, error: trackError } = (await supabase
    .from('kpi_tracking')
    .select('id, user_id, kpi_id, week_start, value, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('week_start', week_start)) as { data: KpiTracking[] | null; error: unknown };

  if (trackError) {
    return NextResponse.json({ error: 'Error al obtener valores' }, { status: 500 });
  }

  // ── 7. Calculate scores (pure function — respects direction field) ──────────
  const scoring = calculateKpiScores(definitions, tracking ?? []);
  const intPoints = toIntegerPoints(scoring.total);
  const weekLabel = getWeekLabel(week_start);

  // ── 8. Find active/projected bonus launch ──────────────────────────────────
  const adminSupabase = createAdminClient();
  const { data: activeLaunch } = (await adminSupabase
    .from('bonus_launches')
    .select('id, name, status')
    .in('status', ['active', 'projected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: Pick<BonusLaunch, 'id' | 'name' | 'status'> | null };

  // ── 9. Insert bonus_event if launch exists ─────────────────────────────────
  let bonusEventId: string | null = null;

  if (activeLaunch) {
    // Idempotency: one kpi_weekly bonus_event per user per week per launch.
    // A 10-second window is insufficient — two concurrent requests both pass it
    // before either writes, creating duplicate point injections.
    // Range covers the full COT week: Mon 00:00 COT → next Mon 00:00 COT
    // (COT = UTC-5, so Mon 00:00 COT = Mon 05:00:00 UTC).
    const weekStartUtc = `${week_start}T05:00:00.000Z`;
    const weekEndDate = new Date(weekStartUtc);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);
    const weekEndUtc = weekEndDate.toISOString();

    const { data: dupeCheck } = await adminSupabase
      .from('bonus_events')
      .select('id')
      .eq('launch_id', activeLaunch.id)
      .eq('user_id', user.id)
      .eq('event_type', 'kpi_weekly')
      .gte('created_at', weekStartUtc)
      .lt('created_at', weekEndUtc)
      .limit(1)
      .maybeSingle();

    if (!dupeCheck) {
      const { data: bonusEvent, error: bonusError } = (await adminSupabase
        .from('bonus_events')
        .insert({
          launch_id: activeLaunch.id,
          user_id: user.id,
          event_type: 'kpi_weekly',
          points: intPoints,
          description: `KPI semanal ${weekLabel}: ${scoring.total}/${scoring.maxPossible} pts`,
          registered_by: user.id,
        } as never)
        .select('id')
        .single()) as { data: { id: string } | null; error: unknown };

      if (bonusError) {
        console.error('Error al crear bonus_event KPI:', bonusError);
        // Non-fatal: submission still saved without bonus link
      } else {
        bonusEventId = bonusEvent?.id ?? null;
      }
    }
  }

  // ── 10. Upsert kpi_submissions as 'submitted' (atomic) ─────────────────────
  const now = new Date().toISOString();
  const submissionPayload = {
    user_id: user.id,
    week_start,
    status: 'submitted',
    submitted_at: now,
    total_points: scoring.total,
    max_possible: scoring.maxPossible,
    bonus_event_id: bonusEventId,
  };

  const { data: submission, error: submitError } = (await adminSupabase
    .from('kpi_submissions')
    .upsert(submissionPayload as never, { onConflict: 'user_id,week_start' })
    .select(
      'id, user_id, week_start, status, submitted_at, total_points, max_possible, bonus_event_id, created_at, updated_at'
    )
    .single()) as { data: KpiSubmission | null; error: unknown };

  if (submitError || !submission) {
    console.error('Error al guardar submission:', submitError);
    // Atomic rollback: remove bonus_event if it was just created
    if (bonusEventId) {
      await adminSupabase.from('bonus_events').delete().eq('id', bonusEventId);
    }
    return NextResponse.json({ error: 'Error al enviar KPIs' }, { status: 500 });
  }

  // ── 11. Side effects (non-blocking) ────────────────────────────────────────
  // target_name + impact are required for the ActivityLogFeed to display this
  // entry (it filters WHERE target_name IS NOT NULL).
  waitUntil(
    logActivity(supabase, {
      userId: user.id,
      action: `Envió KPI semanal (${weekLabel}): ${scoring.total}/${scoring.maxPossible} pts`,
      entityType: 'kpi_submission',
      entityId: submission.id,
      targetName: 'KPI Semanal',
      impact: 'positive',
      metadata: {
        week_start,
        total_points: scoring.total,
        max_possible: scoring.maxPossible,
        has_bonus_event: !!bonusEventId,
        launch_id: activeLaunch?.id ?? null,
        today_colombia: getTodayColombia(),
      },
    })
  );

  return NextResponse.json({
    submission,
    scoring,
    bonus_event_id: bonusEventId,
    launch_linked: !!activeLaunch,
  });
}
