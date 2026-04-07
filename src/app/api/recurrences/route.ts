import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import { calculateInitialNextDueDate } from '@/lib/tasks/dates';
import type { TaskRecurrence, User, RecurrenceFrequency, TaskPriority, TaskType, Json } from '@/lib/types';

const VALID_FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly', 'custom'];
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

// =============================================================================
// GET /api/recurrences — Lista de plantillas de recurrencia
// =============================================================================
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let query = supabase
    .from('task_recurrences')
    .select('*')
    .order('created_at', { ascending: false });

  // Members only see recurrences they created or are assigned to
  if (!isAdmin(user)) {
    query = query.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
  }

  const { data: recurrences, error } = await query as { data: TaskRecurrence[] | null; error: unknown };

  if (error) {
    console.error('Error al obtener recurrencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener recurrencias' },
      { status: 500 }
    );
  }

  // Enrich with user name for assigned_to
  const items = recurrences ?? [];
  const assignedIds = [...new Set(items.map((r) => r.assigned_to).filter(Boolean))] as string[];

  let userMap: Record<string, { name: string; avatar_url: string | null }> = {};

  if (assignedIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', assignedIds) as { data: Pick<User, 'id' | 'name' | 'avatar_url'>[] | null };

    if (users) {
      userMap = users.reduce<Record<string, { name: string; avatar_url: string | null }>>(
        (acc, u) => {
          acc[u.id] = { name: u.name, avatar_url: u.avatar_url };
          return acc;
        },
        {}
      );
    }
  }

  const enriched = items.map((r) => ({
    ...r,
    assigned_name: r.assigned_to ? (userMap[r.assigned_to]?.name ?? null) : null,
    assigned_avatar: r.assigned_to ? (userMap[r.assigned_to]?.avatar_url ?? null) : null,
  }));

  return NextResponse.json(enriched);
}

// =============================================================================
// POST /api/recurrences — Crear plantilla de recurrencia
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
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 });
  }

  const {
    title, description, priority, frequency,
    days_of_week, assigned_to, category_id, is_active,
    task_type, default_status, attachments, impact, estimated_time,
  } = body as {
    title?: string; description?: string; priority?: string; frequency?: string;
    days_of_week?: number[]; assigned_to?: string; category_id?: string; is_active?: boolean;
    task_type?: string; default_status?: string; attachments?: Json[];
    impact?: string; estimated_time?: number;
  };

  // --- Validation ---
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'El titulo es obligatorio' }, { status: 400 });
  }

  if (!frequency || !VALID_FREQUENCIES.includes(frequency as RecurrenceFrequency)) {
    return NextResponse.json(
      { error: `Frecuencia invalida. Valores permitidos: ${VALID_FREQUENCIES.join(', ')}` },
      { status: 400 }
    );
  }

  if (priority && !VALID_PRIORITIES.includes(priority as TaskPriority)) {
    return NextResponse.json(
      { error: `Prioridad invalida. Valores permitidos: ${VALID_PRIORITIES.join(', ')}` },
      { status: 400 }
    );
  }

  const VALID_TASK_TYPES: TaskType[] = ['planeada', 'incendio'];
  if (task_type && !VALID_TASK_TYPES.includes(task_type as TaskType)) {
    return NextResponse.json({ error: 'Tipo de tarea invalido' }, { status: 400 });
  }

  const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
  if (default_status && !VALID_STATUSES.includes(default_status)) {
    return NextResponse.json({ error: 'Estado por defecto invalido' }, { status: 400 });
  }

  const VALID_IMPACTS = ['high', 'medium', 'low'];
  if (impact && !VALID_IMPACTS.includes(impact)) {
    return NextResponse.json({ error: 'Impacto invalido. Valores permitidos: high, medium, low' }, { status: 400 });
  }

  if (estimated_time !== undefined && (!Number.isFinite(estimated_time) || estimated_time <= 0)) {
    return NextResponse.json({ error: 'El tiempo estimado debe ser un numero positivo (en minutos)' }, { status: 400 });
  }

  const resolvedDays = Array.isArray(days_of_week) ? days_of_week : [];

  // For weekly/biweekly/custom, require at least 1 day
  if (['weekly', 'biweekly', 'custom'].includes(frequency) && resolvedDays.length === 0) {
    return NextResponse.json(
      { error: 'Para frecuencia semanal, bisemanal o personalizada se requiere al menos un dia de la semana' },
      { status: 400 }
    );
  }

  // Validate days_of_week values (0-6)
  if (resolvedDays.some((d) => typeof d !== 'number' || d < 0 || d > 6)) {
    return NextResponse.json(
      { error: 'Dias de la semana invalidos. Deben ser numeros entre 0 (domingo) y 6 (sabado)' },
      { status: 400 }
    );
  }

  const nextDueDate = calculateInitialNextDueDate(
    frequency as RecurrenceFrequency,
    resolvedDays
  );

  // Members can only assign recurrences to themselves; admins can assign to anyone
  const finalAssignedTo = isAdmin(user) ? (assigned_to ?? user.id) : user.id;

  const insertData = {
    title: title.trim(),
    description: description?.trim() ?? null,
    priority: (priority ?? 'medium') as TaskPriority,
    frequency: frequency as RecurrenceFrequency,
    days_of_week: resolvedDays,
    assigned_to: finalAssignedTo,
    category_id: category_id ?? null,
    is_active: is_active !== undefined ? is_active : true,
    next_due_date: nextDueDate,
    created_by: user.id,
    task_type: (task_type ?? 'planeada') as TaskType,
    default_status: (default_status ?? 'pending') as 'pending' | 'in_progress' | 'completed' | 'blocked',
    attachments: attachments ?? [],
    impact: (impact ?? null) as 'high' | 'medium' | 'low' | null,
    estimated_time: estimated_time ?? null,
  };

  const { data: newRecurrence, error } = await supabase
    .from('task_recurrences')
    .insert(insertData)
    .select()
    .single() as { data: TaskRecurrence | null; error: unknown };

  if (error || !newRecurrence) {
    console.error('Error al crear la recurrencia:', error);
    return NextResponse.json(
      { error: 'Error al crear la recurrencia' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'recurrence_created',
    entityType: 'task_recurrence',
    entityId: newRecurrence.id,
    metadata: {
      title: newRecurrence.title,
      frequency: newRecurrence.frequency,
      assigned_to: newRecurrence.assigned_to,
    },
  });

  return NextResponse.json(newRecurrence, { status: 201 });
}
