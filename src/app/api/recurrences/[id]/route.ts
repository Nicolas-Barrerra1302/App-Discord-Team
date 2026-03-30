import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { TaskRecurrence, RecurrenceFrequency, TaskPriority, TaskRecurrenceUpdate, TaskType, Json } from '@/lib/types';

const VALID_FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'custom'];
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const VALID_TASK_TYPES: TaskType[] = ['planeada', 'incendio'];
const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];

// Helper: admin OR owner (assigned_to / created_by)
function canAccess(user: { id: string; role: string }, recurrence: TaskRecurrence): boolean {
  if (user.role === 'super_admin' || user.role === 'ceo') return true;
  return recurrence.assigned_to === user.id || recurrence.created_by === user.id;
}

// =============================================================================
// GET /api/recurrences/[id] — Detalle de recurrencia
// =============================================================================
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: recurrence, error } = await supabase
    .from('task_recurrences')
    .select('*')
    .eq('id', id)
    .single() as { data: TaskRecurrence | null; error: unknown };

  if (error || !recurrence) {
    return NextResponse.json({ error: 'Recurrencia no encontrada' }, { status: 404 });
  }

  if (!canAccess(user, recurrence)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return NextResponse.json(recurrence);
}

// =============================================================================
// PUT /api/recurrences/[id] — Actualizar recurrencia
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

  // Fetch existing recurrence
  const { data: existing, error: fetchError } = await supabase
    .from('task_recurrences')
    .select('*')
    .eq('id', id)
    .single() as { data: TaskRecurrence | null; error: unknown };

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Recurrencia no encontrada' }, { status: 404 });
  }

  if (!canAccess(user, existing)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 });
  }

  const {
    title, description, priority, frequency,
    days_of_week, assigned_to, category_id, is_active, next_due_date,
    task_type, default_status, attachments,
  } = body as {
    title?: string; description?: string; priority?: string; frequency?: string;
    days_of_week?: number[]; assigned_to?: string | null; category_id?: string | null;
    is_active?: boolean; next_due_date?: string | null;
    task_type?: string; default_status?: string; attachments?: Json[];
  };

  // --- Validation ---
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
    return NextResponse.json({ error: 'El titulo no puede estar vacio' }, { status: 400 });
  }

  if (frequency !== undefined && !VALID_FREQUENCIES.includes(frequency as RecurrenceFrequency)) {
    return NextResponse.json(
      { error: `Frecuencia invalida. Valores permitidos: ${VALID_FREQUENCIES.join(', ')}` },
      { status: 400 }
    );
  }

  if (priority !== undefined && !VALID_PRIORITIES.includes(priority as TaskPriority)) {
    return NextResponse.json(
      { error: `Prioridad invalida. Valores permitidos: ${VALID_PRIORITIES.join(', ')}` },
      { status: 400 }
    );
  }

  if (task_type !== undefined && !VALID_TASK_TYPES.includes(task_type as TaskType)) {
    return NextResponse.json({ error: 'Tipo de tarea invalido' }, { status: 400 });
  }

  if (default_status !== undefined && !VALID_STATUSES.includes(default_status)) {
    return NextResponse.json({ error: 'Estado por defecto invalido' }, { status: 400 });
  }

  // Resolve the effective frequency and days for cross-field validation
  const effectiveFrequency = (frequency ?? existing.frequency) as RecurrenceFrequency;
  const effectiveDays = days_of_week !== undefined ? days_of_week : existing.days_of_week;

  if (['weekly', 'biweekly', 'custom'].includes(effectiveFrequency) && effectiveDays.length === 0) {
    return NextResponse.json(
      { error: 'Para frecuencia semanal, bisemanal o personalizada se requiere al menos un dia de la semana' },
      { status: 400 }
    );
  }

  if (days_of_week !== undefined) {
    if (!Array.isArray(days_of_week)) {
      return NextResponse.json({ error: 'days_of_week debe ser un arreglo' }, { status: 400 });
    }
    if (days_of_week.some((d) => typeof d !== 'number' || d < 0 || d > 6)) {
      return NextResponse.json(
        { error: 'Dias de la semana invalidos. Deben ser numeros entre 0 (domingo) y 6 (sabado)' },
        { status: 400 }
      );
    }
  }

  // Build update object and track changes
  const updateData: Record<string, unknown> = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (title !== undefined) {
    const trimmed = title.trim();
    updateData.title = trimmed;
    if (trimmed !== existing.title) changes.title = { from: existing.title, to: trimmed };
  }
  if (description !== undefined) {
    const trimmed = description?.trim() ?? null;
    updateData.description = trimmed;
    if (trimmed !== existing.description) changes.description = { from: existing.description, to: trimmed };
  }
  if (priority !== undefined) {
    updateData.priority = priority;
    if (priority !== existing.priority) changes.priority = { from: existing.priority, to: priority };
  }
  if (frequency !== undefined) {
    updateData.frequency = frequency;
    if (frequency !== existing.frequency) changes.frequency = { from: existing.frequency, to: frequency };
  }
  if (days_of_week !== undefined) {
    updateData.days_of_week = days_of_week;
    const fromStr = JSON.stringify(existing.days_of_week);
    const toStr = JSON.stringify(days_of_week);
    if (fromStr !== toStr) changes.days_of_week = { from: existing.days_of_week, to: days_of_week };
  }
  if (assigned_to !== undefined && isAdmin(user)) {
    updateData.assigned_to = assigned_to;
    if (assigned_to !== existing.assigned_to) changes.assigned_to = { from: existing.assigned_to, to: assigned_to };
  }
  if (category_id !== undefined) {
    updateData.category_id = category_id;
    if (category_id !== existing.category_id) changes.category_id = { from: existing.category_id, to: category_id };
  }
  if (is_active !== undefined) {
    updateData.is_active = is_active;
    if (is_active !== existing.is_active) changes.is_active = { from: existing.is_active, to: is_active };
  }
  if (next_due_date !== undefined) {
    updateData.next_due_date = next_due_date;
    if (next_due_date !== existing.next_due_date) changes.next_due_date = { from: existing.next_due_date, to: next_due_date };
  }
  if (task_type !== undefined) {
    updateData.task_type = task_type;
    if (task_type !== existing.task_type) changes.task_type = { from: existing.task_type, to: task_type };
  }
  if (default_status !== undefined) {
    updateData.default_status = default_status;
    if (default_status !== existing.default_status) changes.default_status = { from: existing.default_status, to: default_status };
  }
  if (attachments !== undefined) {
    updateData.attachments = attachments;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No se proporcionaron campos para actualizar' },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('task_recurrences')
    .update(updateData as TaskRecurrenceUpdate)
    .eq('id', id)
    .select()
    .single() as { data: TaskRecurrence | null; error: unknown };

  if (updateError || !updated) {
    console.error('Error al actualizar la recurrencia:', updateError);
    return NextResponse.json(
      { error: 'Error al actualizar la recurrencia' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'recurrence_updated',
    entityType: 'task_recurrence',
    entityId: id,
    metadata: { changes },
  });

  return NextResponse.json(updated);
}

// =============================================================================
// DELETE /api/recurrences/[id] — Eliminar recurrencia
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

  // Verify it exists
  const { data: recurrence, error: fetchError } = await supabase
    .from('task_recurrences')
    .select('*')
    .eq('id', id)
    .single() as { data: TaskRecurrence | null; error: unknown };

  if (fetchError || !recurrence) {
    return NextResponse.json({ error: 'Recurrencia no encontrada' }, { status: 404 });
  }

  if (!canAccess(user, recurrence)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from('task_recurrences')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Error al eliminar la recurrencia:', deleteError);
    return NextResponse.json(
      { error: 'Error al eliminar la recurrencia' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'recurrence_deleted',
    entityType: 'task_recurrence',
    entityId: id,
    metadata: { title: recurrence.title },
  });

  return new NextResponse(null, { status: 204 });
}
