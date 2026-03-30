import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { UserAbsence } from '@/lib/types';

// =============================================================================
// GET /api/absences — Lista de ausencias (solo admin)
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
  const userId = searchParams.get('user_id');
  const active = searchParams.get('active');

  let query = supabase
    .from('user_absences')
    .select('*')
    .order('start_date', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (active === 'true') {
    const today = new Date().toISOString().split('T')[0];
    query = query.lte('start_date', today).gte('end_date', today);
  }

  const { data: absences, error } = await query as {
    data: UserAbsence[] | null;
    error: unknown;
  };

  if (error) {
    console.error('Error al obtener ausencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener ausencias' },
      { status: 500 }
    );
  }

  return NextResponse.json(absences ?? []);
}

// =============================================================================
// POST /api/absences — Crear ausencia (admin: cualquier miembro, member: solo sí mismo)
// =============================================================================
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
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

  const { user_id, start_date, end_date, reason } = body as {
    user_id?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  };

  // Members can only create absences for themselves — force their own ID
  const effectiveUserId = isAdmin(user)
    ? (user_id?.trim() || user.id)
    : user.id;

  // --- Validaciones ---

  if (!effectiveUserId || effectiveUserId.trim().length === 0) {
    return NextResponse.json(
      { error: 'El campo user_id es obligatorio' },
      { status: 400 }
    );
  }

  if (!start_date || typeof start_date !== 'string') {
    return NextResponse.json(
      { error: 'El campo start_date es obligatorio (formato YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  if (!end_date || typeof end_date !== 'string') {
    return NextResponse.json(
      { error: 'El campo end_date es obligatorio (formato YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(start_date)) {
    return NextResponse.json(
      { error: 'Formato de start_date invalido (usar YYYY-MM-DD)' },
      { status: 400 }
    );
  }
  if (!dateRegex.test(end_date)) {
    return NextResponse.json(
      { error: 'Formato de end_date invalido (usar YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  if (end_date < start_date) {
    return NextResponse.json(
      { error: 'Fecha de fin debe ser posterior o igual a fecha de inicio' },
      { status: 400 }
    );
  }

  // --- Insertar ---

  const insertData = {
    user_id: effectiveUserId,
    start_date,
    end_date,
    reason: reason ?? null,
    created_by: user.id,
  };

  const { data: newAbsence, error } = await supabase
    .from('user_absences')
    .insert(insertData)
    .select()
    .single() as { data: UserAbsence | null; error: unknown };

  if (error || !newAbsence) {
    console.error('Error al crear la ausencia:', error);
    return NextResponse.json(
      { error: 'Error al crear la ausencia' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'absence_created',
    entityType: 'user_absence',
    entityId: newAbsence.id,
    metadata: {
      user_id: newAbsence.user_id,
      start_date: newAbsence.start_date,
      end_date: newAbsence.end_date,
    },
  });

  return NextResponse.json(newAbsence, { status: 201 });
}
