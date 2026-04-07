import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, logActivity } from '@/lib/supabase/database';
import { getTodayColombia, colombiaStartOfDay, colombiaEndOfDay } from '@/lib/tasks/dates';

export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/checkins/today — Pre-fill today's metrics for the authenticated user
// =============================================================================
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Today in YYYY-MM-DD in Colombia timezone (avoids UTC midnight shift on Vercel)
  const today = getTodayColombia();

  // Check if already closed today (admin client bypasses RLS — user already authenticated above)
  const adminSupa = createAdminClient();
  const { data: existingCheckin } = await adminSupa
    .from('daily_checkins')
    .select('*')
    .eq('user_id', user.id)
    .eq('checkin_date', today)
    .maybeSingle() as { data: DailyCheckin | null };

  if (existingCheckin) {
    return NextResponse.json({ is_closed: true, checkin: existingCheckin });
  }

  // --- Calculate today's metrics (parallelized) ---
  const dayStart = colombiaStartOfDay(today);
  const dayEnd   = colombiaEndOfDay(today);

  const [
    { data: completedTasks },
    { count: blocksCount },
    { count: totalTasks },
  ] = await Promise.all([
    // 1. Tasks completed today — completed_at is a timestamptz, so UTC bounds are correct.
    supabase
      .from('tasks')
      .select('time_spent, task_type')
      .eq('assigned_to', user.id)
      .eq('status', 'completed')
      .eq('is_archived', false)
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd) as unknown as Promise<{ data: { time_spent: number | null; task_type: string }[] | null }>,

    // 2. blocks_count: tasks currently blocked (not just today)
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('status', 'blocked'),

    // 3. Total tasks for today (strict timebox) — denominator for completion_pct.
    // due_date is a DATE column — compare with YYYY-MM-DD string, NOT a timestamptz.
    // Postgres casts DATE to midnight UTC, which falls before 05:00:00Z → comparison breaks.
    // Condition A: due_date = todayStr (YYYY-MM-DD exact match, safe for DATE columns).
    // Condition B: due_date IS NULL AND created_at within Colombia day UTC bounds.
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('is_archived', false)
      .or(`due_date.eq.${today},and(due_date.is.null,created_at.gte.${dayStart},created_at.lte.${dayEnd})`),
  ]);

  const tasks = completedTasks ?? [];

  // hours_worked: sum time_spent (stored as minutes) -> convert to hours (decimal)
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.time_spent ?? 0), 0);
  const hoursWorked = Math.round((totalMinutes / 60) * 100) / 100;

  // fires_handled: count completed tasks with task_type = 'incendio'
  const firesHandled = tasks.filter(t => t.task_type === 'incendio').length;

  // Safe division — || 0 handles totalTasks = null or 0
  const completionPct = Math.round((tasks.length / (totalTasks || 1)) * 100) || 0;

  return NextResponse.json({
    is_closed: false,
    metrics: {
      hours_worked: hoursWorked,
      fires_handled: firesHandled,
      blocks_count: blocksCount ?? 0,
      completion_pct: completionPct,
    },
  });
}

// =============================================================================
// POST /api/checkins/today — Save daily check-in
// Metrics are recalculated server-side — only `summary` is accepted from client.
// =============================================================================
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Safe JSON parsing
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de la solicitud invalido' },
      { status: 400 }
    );
  }

  // Zero-Trust: reject any client-calculated metric fields — all metrics are server-side
  const PROHIBITED_CHECKIN_FIELDS = [
    'hours_worked', 'fires_handled', 'blocks_count', 'completion_pct',
    'user_id', 'checkin_date', 'id', 'created_at',
  ];
  const prohibitedFound = PROHIBITED_CHECKIN_FIELDS.filter((f) => f in body);
  if (prohibitedFound.length > 0) {
    return NextResponse.json(
      { error: `Payload contiene campos prohibidos (métricas pre-calculadas): ${prohibitedFound.join(', ')}` },
      { status: 400 }
    );
  }

  const { summary } = body as { summary?: string };

  // Validate summary (único input humano requerido)
  if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
    return NextResponse.json(
      { error: 'El resumen del día es obligatorio' },
      { status: 400 }
    );
  }

  if (summary.trim().length > 2000) {
    return NextResponse.json(
      { error: 'El resumen no puede exceder 2000 caracteres' },
      { status: 400 }
    );
  }

  // --- Idempotency pre-check: short-circuit before expensive metric queries ---
  // Without this, a double-click fires 3 DB queries before hitting the unique
  // constraint at INSERT time. This guard aborts early and gives a clean 409.

  const today = getTodayColombia();
  const adminSupa = createAdminClient();

  const { data: alreadyClosed } = await adminSupa
    .from('daily_checkins')
    .select('id')
    .eq('user_id', user.id)
    .eq('checkin_date', today)
    .maybeSingle() as { data: { id: string } | null };

  if (alreadyClosed) {
    return NextResponse.json(
      { error: 'Ya cerraste el día de hoy' },
      { status: 409 }
    );
  }

  // --- Recalculate ALL metrics server-side (never trust client) ---
  const dayStart = colombiaStartOfDay(today);
  const dayEnd   = colombiaEndOfDay(today);

  const [
    { data: completedTasks },
    { count: blocksCount },
    { count: totalTasks },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('time_spent, task_type')
      .eq('assigned_to', user.id)
      .eq('status', 'completed')
      .eq('is_archived', false)
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd) as unknown as Promise<{ data: { time_spent: number | null; task_type: string }[] | null }>,

    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('status', 'blocked'),

    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('is_archived', false)
      .or(`due_date.eq.${today},and(due_date.is.null,created_at.gte.${dayStart},created_at.lte.${dayEnd})`),
  ]);

  const tasks = completedTasks ?? [];

  const totalMinutes = tasks.reduce((sum, t) => sum + (t.time_spent ?? 0), 0);
  const hoursWorked = Math.round((totalMinutes / 60) * 100) / 100;
  const firesHandled = tasks.filter(t => t.task_type === 'incendio').length;

  const completionPct = Math.round((tasks.length / (totalTasks || 1)) * 100) || 0;

  // --- Insert with explicit Colombia date (fixes UTC mismatch) ---

  const { data, error } = await adminSupa
    .from('daily_checkins')
    .insert({
      user_id: user.id,
      checkin_date: today,
      hours_worked: hoursWorked,
      fires_handled: firesHandled,
      blocks_count: blocksCount ?? 0,
      summary: summary.trim(),
      completion_pct: completionPct,
    } as never)
    .select()
    .single() as { data: DailyCheckin | null; error: unknown };

  if (error) {
    const errObj = error as { code?: string; message?: string; details?: string; hint?: string };
    console.error("SUPABASE INSERT ERROR:", errObj);

    // Unique constraint violation = already closed today
    if (errObj.code === '23505') {
      return NextResponse.json(
        { error: 'Ya cerraste el día de hoy' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: errObj.message ?? 'Error desconocido', details: errObj.details, hint: errObj.hint, code: errObj.code },
      { status: 500 }
    );
  }

  // --- Award 100 pts if closed before 23:59 COT ---
  // Non-blocking: does NOT delay the API response.
  const cotTimeStr = new Date().toLocaleTimeString('en-CA', {
    timeZone: 'America/Bogota',
    hour12: false,
  }); // "HH:MM:SS"
  const [cotHour, cotMinute] = cotTimeStr.split(':').map(Number);
  const closedOnTime = cotHour < 23 || (cotHour === 23 && cotMinute < 59);

  // Only process & log if closed on time
  if (closedOnTime) {
    waitUntil((async () => {
      // Resolve active bonus launch
      const { data: launch } = await adminSupa
        .from('bonus_launches')
        .select('id')
        .in('status', ['active', 'projected'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { id: string } | null };

      if (launch) {
        const { error: bonusError } = await adminSupa
          .from('bonus_events')
          .insert({
            launch_id: launch.id,
            user_id: user.id,
            event_type: 'daily_close',
            points: 100,
            description: `Cierre de día a tiempo (${today})`,
            registered_by: user.id,
            metadata: {
              source: 'daily_checkin',
              checkin_date: today,
              cot_time: cotTimeStr,
            },
          } as never);

        if (bonusError) {
          console.error(
            `[LEDGER_ERROR] bonus_event daily_close insert failed user_id=${user.id} date=${today}: ${String(bonusError)}`,
          );
        }
      }

      // Log activity with +100 pts badge — only if on time
      await logActivity(adminSupa, {
        userId: user.id,
        action: `Cerró el día a tiempo — ${summary.trim().slice(0, 80)}${summary.trim().length > 80 ? '…' : ''}`,
        entityType: 'checkin',
        entityId: data!.id,
        targetName: 'Cierre de Día',
        impact: '+100 pts',
        metadata: {
          checkin_date: today,
          awarded_points: 100,
          cot_time: cotTimeStr,
        },
      });
    })());
  }

  return NextResponse.json({ checkin: data }, { status: 201 });
}

// =============================================================================
// Local type (matches database.types.ts DailyCheckin Row)
// =============================================================================
interface DailyCheckin {
  id: string;
  user_id: string;
  checkin_date: string;
  hours_worked: string; // numeric comes as string from PostgREST
  fires_handled: number;
  blocks_count: number;
  summary: string;
  completion_pct: string; // numeric comes as string from PostgREST
  auto_closed: boolean;   // migration 020: ghost-close flag (evaluateGhostClose)
  created_at: string;
}
