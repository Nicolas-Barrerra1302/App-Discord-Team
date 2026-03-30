import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { UserAbsence, UserAbsenceUpdate } from '@/lib/types';

// =============================================================================
// PUT /api/absences/[id] — Actualizar ausencia (solo admin)
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Verify the absence exists
  const { data: existing, error: fetchError } = await supabase
    .from('user_absences')
    .select('*')
    .eq('id', id)
    .single() as { data: UserAbsence | null; error: unknown };

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Ausencia no encontrada' },
      { status: 404 }
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

  const { start_date, end_date, reason } = body as {
    start_date?: string;
    end_date?: string;
    reason?: string;
  };

  const updateData: Record<string, unknown> = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (start_date !== undefined) {
    if (typeof start_date !== 'string' || !dateRegex.test(start_date)) {
      return NextResponse.json(
        { error: 'Formato de start_date invalido (usar YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    updateData.start_date = start_date;
    if (start_date !== existing.start_date) {
      changes.start_date = { from: existing.start_date, to: start_date };
    }
  }

  if (end_date !== undefined) {
    if (typeof end_date !== 'string' || !dateRegex.test(end_date)) {
      return NextResponse.json(
        { error: 'Formato de end_date invalido (usar YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    updateData.end_date = end_date;
    if (end_date !== existing.end_date) {
      changes.end_date = { from: existing.end_date, to: end_date };
    }
  }

  if (reason !== undefined) {
    updateData.reason = reason;
    if (reason !== existing.reason) {
      changes.reason = { from: existing.reason, to: reason };
    }
  }

  // Cross-validate dates: use the new value if provided, otherwise fall back to existing
  const finalStartDate = (updateData.start_date as string) ?? existing.start_date;
  const finalEndDate = (updateData.end_date as string) ?? existing.end_date;

  if (finalEndDate < finalStartDate) {
    return NextResponse.json(
      { error: 'Fecha de fin debe ser posterior o igual a fecha de inicio' },
      { status: 400 }
    );
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No se proporcionaron campos para actualizar' },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('user_absences')
    .update(updateData as UserAbsenceUpdate)
    .eq('id', id)
    .select()
    .single() as { data: UserAbsence | null; error: unknown };

  if (updateError || !updated) {
    console.error('Error al actualizar la ausencia:', updateError);
    return NextResponse.json(
      { error: 'Error al actualizar la ausencia' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'absence_updated',
    entityType: 'user_absence',
    entityId: id,
    metadata: { changes },
  });

  return NextResponse.json(updated);
}

// =============================================================================
// DELETE /api/absences/[id] — Eliminar ausencia
// Admin: puede borrar cualquiera. Member: solo sus propias ausencias.
// =============================================================================
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Fetch the absence first to check ownership
  const { data: existing, error: fetchError } = await supabase
    .from('user_absences')
    .select('*')
    .eq('id', id)
    .single() as { data: UserAbsence | null; error: unknown };

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Ausencia no encontrada' },
      { status: 404 }
    );
  }

  // Permission: admin can delete any, member only their own
  if (!isAdmin(user) && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from('user_absences')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Error al eliminar la ausencia:', deleteError);
    return NextResponse.json(
      { error: 'Error al eliminar la ausencia' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'absence_deleted',
    entityType: 'user_absence',
    entityId: id,
    metadata: {
      user_id: existing.user_id,
      start_date: existing.start_date,
      end_date: existing.end_date,
    },
  });

  return new NextResponse(null, { status: 204 });
}
