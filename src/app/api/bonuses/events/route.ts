import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, isSuperAdmin, logActivity } from '@/lib/supabase/database';
import type { BonusEvent, BonusLaunch, User } from '@/lib/types';

// Only types that are safe for human manual registration via the "Registrar" modal.
// ALL automated event types produced by server systems MUST NOT be injectable
// through this endpoint:
//   task_completed / early_delivery / late_delivery → task gamification engine
//   streak                                          → streak calculator
//   settlement                                      → launch-close workflow
//   kpi_weekly                                      → POST /api/kpis/submit
//   daily_close / missed_daily_close                → evaluateGhostClose
const MANUAL_REGISTRATION_EVENT_TYPES = [
  'quality_bonus', 'initiative', 'collaboration', 'penalty', 'adjustment',
] as const;

// =============================================================================
// GET /api/bonuses/events — Lista de eventos de bonos
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const launchId = searchParams.get('launch_id');
  const userIdParam = searchParams.get('user_id');

  // Build query
  let query = supabase.from('bonus_events').select('*');

  // Filter by launch if provided
  if (launchId) {
    query = query.eq('launch_id', launchId);
  }

  // Access control: members can only see their own events
  if (!isAdmin(user)) {
    query = query.eq('user_id', user.id);
  } else if (userIdParam) {
    // Admin can filter by specific user
    query = query.eq('user_id', userIdParam);
  }

  query = query.order('created_at', { ascending: false });

  const { data: events, error } = (await query) as {
    data: BonusEvent[] | null;
    error: unknown;
  };

  if (error) {
    console.error('Error al obtener eventos de bonos:', error);
    return NextResponse.json(
      { error: 'Error al obtener eventos de bonos' },
      { status: 500 }
    );
  }

  return NextResponse.json(events ?? []);
}

// =============================================================================
// POST /api/bonuses/events — Registrar evento de puntos (solo super_admin)
// =============================================================================
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!isSuperAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo super_admin puede registrar eventos' },
      { status: 403 }
    );
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

  // Zero-Trust: reject server-managed identity and timestamp fields
  const PROHIBITED_BONUS_FIELDS = ['registered_by', 'created_at', 'id', 'updated_at'];
  const prohibitedFound = PROHIBITED_BONUS_FIELDS.filter((f) => f in body);
  if (prohibitedFound.length > 0) {
    return NextResponse.json(
      { error: `Payload contiene campos prohibidos: ${prohibitedFound.join(', ')}` },
      { status: 400 }
    );
  }

  const { launch_id, user_id, event_type, points, description } = body as {
    launch_id?: string;
    user_id?: string;
    event_type?: string;
    points?: number;
    description?: string;
  };

  // --- Validation ---

  if (!launch_id || typeof launch_id !== 'string') {
    return NextResponse.json(
      { error: 'launch_id es obligatorio y debe ser un UUID valido' },
      { status: 400 }
    );
  }

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json(
      { error: 'user_id es obligatorio y debe ser un UUID valido' },
      { status: 400 }
    );
  }

  if (
    !event_type ||
    !MANUAL_REGISTRATION_EVENT_TYPES.includes(event_type as (typeof MANUAL_REGISTRATION_EVENT_TYPES)[number])
  ) {
    return NextResponse.json(
      { error: `event_type invalido. Valores permitidos: ${MANUAL_REGISTRATION_EVENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  if (typeof points !== 'number' || !Number.isInteger(points)) {
    return NextResponse.json(
      { error: 'points es obligatorio y debe ser un entero' },
      { status: 400 }
    );
  }
  if (points < -9999 || points > 9999) {
    return NextResponse.json(
      { error: 'points debe estar entre -9999 y 9999' },
      { status: 400 }
    );
  }

  if (description !== undefined && typeof description !== 'string') {
    return NextResponse.json(
      { error: 'description debe ser un string' },
      { status: 400 }
    );
  }
  if (description !== undefined && description.length > 500) {
    return NextResponse.json(
      { error: 'description no puede exceder 500 caracteres' },
      { status: 400 }
    );
  }

  // --- Verify launch exists and is not closed ---
  const { data: launch, error: launchError } = await supabase
    .from('bonus_launches')
    .select('id, status')
    .eq('id', launch_id)
    .single() as { data: Pick<BonusLaunch, 'id' | 'status'> | null; error: unknown };

  if (launchError || !launch) {
    return NextResponse.json(
      { error: 'Lanzamiento no encontrado' },
      { status: 404 }
    );
  }

  if (launch.status === 'closed') {
    return NextResponse.json(
      { error: 'No se pueden añadir eventos a un lanzamiento cerrado' },
      { status: 400 }
    );
  }

  // --- Verify target user exists ---
  const { data: targetUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('id', user_id)
    .single() as { data: Pick<User, 'id'> | null; error: unknown };

  if (userError || !targetUser) {
    return NextResponse.json(
      { error: 'Usuario no encontrado' },
      { status: 404 }
    );
  }

  // --- Idempotency: reject duplicate event within 10-second window ---
  // Idempotency: reject duplicate manual event within 10-second window.
  // Rule 30: NEVER include .eq('points', points) — two different legitimate events
  // can have the same point value (false-positive dedup). The unique business key
  // for manual registration is launch_id + user_id + event_type within the window.
  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  const { data: recentDup } = await supabase
    .from('bonus_events')
    .select('id')
    .eq('launch_id', launch_id)
    .eq('user_id', user_id)
    .eq('event_type', event_type as BonusEvent['event_type'])
    .gte('created_at', tenSecondsAgo)
    .maybeSingle() as { data: { id: string } | null };

  if (recentDup) {
    return NextResponse.json(
      { error: 'Evento duplicado detectado. Espera unos segundos antes de reintentar.' },
      { status: 409 }
    );
  }

  // --- Insert event ---
  const insertData = {
    launch_id,
    user_id,
    event_type,
    points,
    description: description ?? null,
    registered_by: user.id,
  };

  const { data: newEvent, error: insertError } = await supabase
    .from('bonus_events')
    .insert(insertData as never)
    .select()
    .single() as { data: BonusEvent | null; error: unknown };

  if (insertError || !newEvent) {
    console.error('Error al registrar evento de bono:', insertError);
    return NextResponse.json(
      { error: 'Error al registrar evento de bono' },
      { status: 500 }
    );
  }

  // --- Activity log (non-blocking) ---
  waitUntil(
    logActivity(supabase, {
      userId: user.id,
      action: 'bonus_event_created',
      entityType: 'bonus_event',
      entityId: newEvent.id,
      metadata: {
        launch_id,
        target_user_id: user_id,
        event_type,
        points,
      },
    })
  );

  return NextResponse.json(newEvent, { status: 201 });
}
