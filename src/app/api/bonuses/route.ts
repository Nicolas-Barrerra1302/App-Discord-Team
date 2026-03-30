import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { BonusLaunch, BonusEvent } from '@/lib/types';

const VALID_TYPES = ['principal', 'low_ticket'] as const;

// =============================================================================
// GET /api/bonuses — Lista de lanzamientos con eventos
// =============================================================================
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Fetch all launches ordered by most recent first
  const { data: launches, error: launchError } = await supabase
    .from('bonus_launches')
    .select('*')
    .order('created_at', { ascending: false }) as {
    data: BonusLaunch[] | null;
    error: unknown;
  };

  if (launchError) {
    console.error('Error al obtener lanzamientos:', launchError);
    return NextResponse.json(
      { error: 'Error al obtener lanzamientos' },
      { status: 500 }
    );
  }

  const items = launches ?? [];

  if (items.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch all events in one query (avoid N+1)
  const launchIds = items.map((l) => l.id);

  let eventsQuery = supabase
    .from('bonus_events')
    .select('*')
    .in('launch_id', launchIds);

  // Members only see their own events
  if (!isAdmin(user)) {
    eventsQuery = eventsQuery.eq('user_id', user.id);
  }

  const { data: allEvents, error: eventsError } = (await eventsQuery) as {
    data: BonusEvent[] | null;
    error: unknown;
  };

  if (eventsError) {
    console.error('Error al obtener eventos de bonos:', eventsError);
    return NextResponse.json(
      { error: 'Error al obtener eventos de bonos' },
      { status: 500 }
    );
  }

  // Group events by launch_id
  const eventsMap: Record<string, BonusEvent[]> = {};
  for (const event of allEvents ?? []) {
    if (!eventsMap[event.launch_id]) {
      eventsMap[event.launch_id] = [];
    }
    eventsMap[event.launch_id].push(event);
  }

  const result = items.map((launch) => ({
    ...launch,
    events: eventsMap[launch.id] ?? [],
  }));

  return NextResponse.json(result);
}

// =============================================================================
// POST /api/bonuses — Crear lanzamiento + eventos
// =============================================================================
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de la solicitud invalido' },
      { status: 400 }
    );
  }

  const { name, type, revenue, marginPct, poolPct, payments } = body as {
    name?: string;
    type?: string;
    revenue?: number;
    marginPct?: number;
    poolPct?: number;
    payments?: Array<{
      userId: string;
      points: number;
      simulatedBonus: number;
      poolPercentage: number;
    }>;
  };

  // --- Validation ---
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { error: 'El nombre es obligatorio' },
      { status: 400 }
    );
  }
  if (name.trim().length > 200) {
    return NextResponse.json(
      { error: 'El nombre no puede exceder 200 caracteres' },
      { status: 400 }
    );
  }

  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json(
      { error: `Tipo invalido. Valores permitidos: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  if (typeof revenue !== 'number' || revenue < 0) {
    return NextResponse.json(
      { error: 'Revenue debe ser un numero >= 0' },
      { status: 400 }
    );
  }

  if (typeof marginPct !== 'number' || marginPct < 0) {
    return NextResponse.json(
      { error: 'Margen neto % debe ser un numero >= 0' },
      { status: 400 }
    );
  }

  if (typeof poolPct !== 'number' || poolPct < 0) {
    return NextResponse.json(
      { error: 'Pool % debe ser un numero >= 0' },
      { status: 400 }
    );
  }

  if (!Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json(
      { error: 'Se requiere al menos un pago en el array payments' },
      { status: 400 }
    );
  }
  // The team has 6 members; bound the array to prevent oversized payloads
  if (payments.length > 20) {
    return NextResponse.json(
      { error: 'payments no puede exceder 20 entradas' },
      { status: 400 }
    );
  }

  // Validate each payment entry
  for (const p of payments) {
    if (!p.userId || typeof p.userId !== 'string') {
      return NextResponse.json(
        { error: 'Cada pago debe tener un userId valido' },
        { status: 400 }
      );
    }
    // Rule 30 / defensive: require finite integer, never Infinity / NaN / floats
    if (typeof p.points !== 'number' || !Number.isFinite(p.points) || !Number.isInteger(p.points)) {
      return NextResponse.json(
        { error: 'Cada pago debe tener puntos numéricos enteros finitos' },
        { status: 400 }
      );
    }
  }

  // --- Insert launch ---
  const launchInsert = {
    name: name.trim(),
    type: type as BonusLaunch['type'],
    status: 'projected' as BonusLaunch['status'],
    revenue_bruto: revenue,
    margen_neto_pct: marginPct,
    pool_pct: poolPct,
  };

  const { data: newLaunch, error: launchError } = await supabase
    .from('bonus_launches')
    .insert(launchInsert as never)
    .select()
    .single() as { data: BonusLaunch | null; error: unknown };

  if (launchError || !newLaunch) {
    console.error('Error al crear el lanzamiento:', launchError);
    return NextResponse.json(
      { error: 'Error al crear el lanzamiento' },
      { status: 500 }
    );
  }

  // --- Insert events for each payment ---
  const eventInserts = payments.map((p) => ({
    launch_id: newLaunch.id,
    user_id: p.userId,
    event_type: 'adjustment' as BonusEvent['event_type'],
    points: p.points,
    description: `Bono simulado: $${p.simulatedBonus} (${p.poolPercentage}% del pool)`,
    registered_by: user.id,
  }));

  const { error: eventsError } = await supabase
    .from('bonus_events')
    .insert(eventInserts as never) as { error: unknown };

  if (eventsError) {
    console.error('Error al crear eventos de bonos:', eventsError);
    // Rollback: eliminar el launch huérfano para mantener consistencia
    await supabase.from('bonus_launches').delete().eq('id', newLaunch.id);
    return NextResponse.json(
      { error: 'Error al registrar los eventos. El lanzamiento fue revertido.' },
      { status: 500 }
    );
  }

  // --- Activity log (non-blocking) ---
  waitUntil(
    logActivity(supabase, {
      userId: user.id,
      action: 'bonus_launch_created',
      entityType: 'bonus_launch',
      entityId: newLaunch.id,
      metadata: {
        name: name.trim(),
        type,
        revenue,
        payments_count: payments.length,
      },
    })
  );

  return NextResponse.json(newLaunch, { status: 201 });
}
