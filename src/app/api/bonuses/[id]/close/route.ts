import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isSuperAdmin, logActivity } from '@/lib/supabase/database';
import { calculateBonuses, formatCurrency } from '@/lib/bonuses/calculator';
import type { BonusLaunch, BonusEvent, User, BonusMemberInput } from '@/lib/types';

// =============================================================================
// PUT /api/bonuses/[id]/close — Cerrar lanzamiento con datos financieros reales
// Solo super_admin puede cerrar lanzamientos.
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  // --- Auth ---
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!isSuperAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo super_admin puede cerrar lanzamientos' },
      { status: 403 },
    );
  }

  // --- Route param ---
  const { id } = await params;

  // --- Parse body ---
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de la solicitud invalido' },
      { status: 400 },
    );
  }

  const { revenue_real, margen_real_pct } = body as {
    revenue_real?: number;
    margen_real_pct?: number;
  };

  // --- Validation ---
  if (typeof revenue_real !== 'number' || revenue_real < 0) {
    return NextResponse.json(
      { error: 'revenue_real es obligatorio y debe ser un numero >= 0' },
      { status: 400 },
    );
  }

  if (typeof margen_real_pct !== 'number' || margen_real_pct < 0) {
    return NextResponse.json(
      { error: 'margen_real_pct es obligatorio y debe ser un numero >= 0' },
      { status: 400 },
    );
  }

  // --- Fetch the launch ---
  const { data: launch, error: launchError } = await supabase
    .from('bonus_launches')
    .select('*')
    .eq('id', id)
    .single() as { data: BonusLaunch | null; error: unknown };

  if (launchError || !launch) {
    return NextResponse.json(
      { error: 'Lanzamiento no encontrado' },
      { status: 404 },
    );
  }

  // --- Verify not already closed ---
  if (launch.status === 'closed') {
    return NextResponse.json(
      { error: 'Este lanzamiento ya esta cerrado' },
      { status: 400 },
    );
  }

  // --- Fetch ALL bonus_events for this launch ---
  const { data: events, error: eventsError } = await supabase
    .from('bonus_events')
    .select('user_id, points')
    .eq('launch_id', id) as {
    data: Pick<BonusEvent, 'user_id' | 'points'>[] | null;
    error: unknown;
  };

  if (eventsError) {
    console.error('Error al obtener eventos de bonos:', eventsError);
    return NextResponse.json(
      { error: 'Error al obtener eventos de bonos' },
      { status: 500 },
    );
  }

  // --- Sum points per user ---
  const pointsByUser: Record<string, number> = {};
  for (const evt of events ?? []) {
    pointsByUser[evt.user_id] = (pointsByUser[evt.user_id] ?? 0) + evt.points;
  }

  // --- Fetch all active users (CEO excluded from pool distribution) ---
  const { data: activeUsers, error: usersError } = await supabase
    .from('users')
    .select('id, name, avatar_url, role')
    .eq('is_active', true)
    .neq('role', 'ceo') as {
    data: Pick<User, 'id' | 'name' | 'avatar_url' | 'role'>[] | null;
    error: unknown;
  };

  if (usersError) {
    console.error('Error al obtener usuarios activos:', usersError);
    return NextResponse.json(
      { error: 'Error al obtener usuarios activos' },
      { status: 500 },
    );
  }

  // --- Build BonusMemberInput array ---
  const membersInput: BonusMemberInput[] = (activeUsers ?? []).map((u) => ({
    userId: u.id,
    name: u.name,
    avatarUrl: u.avatar_url,
    role: u.role,
    points: pointsByUser[u.id] ?? 0,
  }));

  // --- Run calculator with real data ---
  // PostgREST returns numeric columns as strings — parse with Number()
  const simulation = calculateBonuses(
    revenue_real,
    margen_real_pct,
    Number(launch.pool_pct),
    membersInput,
  );

  // --- Update launch to closed ---
  const { data: updatedLaunch, error: updateError } = await supabase
    .from('bonus_launches')
    .update({
      revenue_real: revenue_real,
      margen_real_pct: margen_real_pct,
      status: 'closed',
      closed_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .select()
    .single() as { data: BonusLaunch | null; error: unknown };

  if (updateError || !updatedLaunch) {
    console.error('Error al cerrar el lanzamiento:', updateError);
    return NextResponse.json(
      { error: 'Error al cerrar el lanzamiento' },
      { status: 500 },
    );
  }

  // --- Insert final settlement events ---
  // points = 0 to avoid duplicating accumulated points in the historical record.
  // The real bonus is frozen in final_bonus_amount so future formula changes
  // cannot retroactively alter closed launches.
  const settlementEvents = simulation.results.map((r) => ({
    launch_id: id,
    user_id: r.userId,
    event_type: 'settlement' as const,
    points: 0,
    description: `Cierre definitivo: Bono ${formatCurrency(r.simulatedBonus)} (${r.poolPercentage}% del pool) — Puntos acumulados: ${pointsByUser[r.userId] ?? 0}`,
    registered_by: user.id,
    final_bonus_amount: r.simulatedBonus,
  }));

  if (settlementEvents.length > 0) {
    const { error: settlementError } = await supabase
      .from('bonus_events')
      .insert(settlementEvents as never) as { error: unknown };

    if (settlementError) {
      console.error('Error al registrar eventos de cierre:', settlementError);
      // Launch already closed — log the error but don't fail the entire request
    }
  }

  // --- Activity log (non-blocking) ---
  waitUntil(
    logActivity(supabase, {
      userId: user.id,
      action: 'bonus_launch_closed',
      entityType: 'bonus_launch',
      entityId: id,
      metadata: {
        name: updatedLaunch.name,
        revenue_real,
        margen_real_pct,
        members_count: simulation.results.length,
        total_pool: simulation.totalPool,
      },
    }),
  );

  return NextResponse.json({
    launch: updatedLaunch,
    simulation: simulation.results,
  });
}
