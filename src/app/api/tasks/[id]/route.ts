import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import { notifyTaskCompleted, notifyTaskAssigned } from '@/lib/webhooks/dispatcher';
import { processTaskCompletion, type TaskDataForScoring } from '@/lib/gamification/ledger-service';
import type { Task, TaskComment, User, TaskUpdate, TaskType } from '@/lib/types';

// =============================================================================
// GET /api/tasks/[id] — Detalle de tarea con subtareas y comentarios
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

  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single() as { data: Task | null; error: unknown };

  if (error || !task) {
    return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
  }

  // Access check: members can only see tasks they are assigned_to or created_by
  if (!isAdmin(user) && task.assigned_to !== user.id && task.created_by !== user.id) {
    return NextResponse.json(
      { error: 'No tienes permiso para ver esta tarea' },
      { status: 403 }
    );
  }

  // Subtasks
  const { data: subtasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('parent_task_id', id)
    .order('created_at', { ascending: true }) as { data: Task[] | null };

  // Comments with user info
  const { data: commentsRaw } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: true }) as { data: TaskComment[] | null };

  let comments: (TaskComment & { user_name: string; user_avatar: string | null })[] = [];

  if (commentsRaw && commentsRaw.length > 0) {
    const userIds = [...new Set(commentsRaw.map((c) => c.user_id))];
    const { data: commentUsers } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', userIds) as { data: Pick<User, 'id' | 'name' | 'avatar_url'>[] | null };

    const userMap = (commentUsers ?? []).reduce<
      Record<string, { name: string; avatar_url: string | null }>
    >((acc, u) => {
      acc[u.id] = { name: u.name, avatar_url: u.avatar_url };
      return acc;
    }, {});

    comments = commentsRaw.map((c) => ({
      ...c,
      user_name: userMap[c.user_id]?.name ?? 'Desconocido',
      user_avatar: userMap[c.user_id]?.avatar_url ?? null,
    }));
  }

  return NextResponse.json({
    ...task,
    subtasks: subtasks ?? [],
    comments,
  });
}

// =============================================================================
// PUT /api/tasks/[id] — Actualizar tarea
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

  const { data: existingTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single() as { data: Task | null; error: unknown };

  if (fetchError || !existingTask) {
    return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
  }

  if (!isAdmin(user) && existingTask.assigned_to !== user.id && existingTask.created_by !== user.id) {
    return NextResponse.json(
      { error: 'No tienes permiso para editar esta tarea' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 });
  }

  // Zero-Trust: reject server-managed timestamp and identity fields from client
  const PROHIBITED_TASK_FIELDS = ['completed_at', 'created_at', 'updated_at', 'created_by', 'id'];
  const prohibitedFound = PROHIBITED_TASK_FIELDS.filter((f) => f in body);
  if (prohibitedFound.length > 0) {
    return NextResponse.json(
      { error: `Payload contiene campos prohibidos (timestamps o identidad del servidor): ${prohibitedFound.join(', ')}` },
      { status: 400 }
    );
  }

  const {
    title, description, status: newStatus, priority,
    assigned_to, due_date, category_id, attachments,
    task_type, time_spent, is_archived,
    impact, estimated_time, block_type, block_reason,
  } = body as {
    title?: string; description?: string; status?: string; priority?: string;
    assigned_to?: string; due_date?: string; category_id?: string; attachments?: unknown[];
    task_type?: string; time_spent?: number; is_archived?: boolean;
    impact?: string | null; estimated_time?: number | null;
    block_type?: string | null; block_reason?: string | null;
  };

  const updateData: Record<string, unknown> = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'title debe ser un string no vacío' }, { status: 400 });
    }
    if (title.trim().length > 500) {
      return NextResponse.json({ error: 'title no puede exceder 500 caracteres' }, { status: 400 });
    }
    updateData.title = title.trim();
    if (title.trim() !== existingTask.title)
      changes.title = { from: existingTask.title, to: title.trim() };
  }
  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return NextResponse.json({ error: 'description debe ser un string' }, { status: 400 });
    }
    if (typeof description === 'string' && description.length > 10000) {
      return NextResponse.json({ error: 'description no puede exceder 10000 caracteres' }, { status: 400 });
    }
    updateData.description = description;
    if (description !== existingTask.description)
      changes.description = { from: existingTask.description, to: description };
  }
  if (newStatus !== undefined) {
    const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: `Estado invalido: "${newStatus}". Valores permitidos: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    updateData.status = newStatus;
    if (newStatus !== existingTask.status)
      changes.status = { from: existingTask.status, to: newStatus };
    if (newStatus === 'completed' && existingTask.status !== 'completed')
      updateData.completed_at = new Date().toISOString();
    else if (newStatus !== 'completed' && existingTask.status === 'completed')
      updateData.completed_at = null;
  }
  if (priority !== undefined) {
    updateData.priority = priority;
    if (priority !== existingTask.priority)
      changes.priority = { from: existingTask.priority, to: priority };
  }
  if (assigned_to !== undefined && isAdmin(user)) {
    updateData.assigned_to = assigned_to;
    if (assigned_to !== existingTask.assigned_to)
      changes.assigned_to = { from: existingTask.assigned_to, to: assigned_to };
  }
  if (due_date !== undefined) {
    updateData.due_date = due_date;
    if (due_date !== existingTask.due_date)
      changes.due_date = { from: existingTask.due_date, to: due_date };
  }
  if (category_id !== undefined) {
    updateData.category_id = category_id;
    if (category_id !== existingTask.category_id)
      changes.category_id = { from: existingTask.category_id, to: category_id };
  }
  if (attachments !== undefined) {
    updateData.attachments = attachments;
  }
  if (task_type !== undefined) {
    const VALID_TASK_TYPES = ['planeada', 'incendio'];
    if (!VALID_TASK_TYPES.includes(task_type)) {
      return NextResponse.json({ error: 'Tipo de tarea invalido' }, { status: 400 });
    }
    updateData.task_type = task_type as TaskType;
    if (task_type !== existingTask.task_type)
      changes.task_type = { from: existingTask.task_type, to: task_type };
  }
  if (time_spent !== undefined) {
    if (typeof time_spent !== 'number' || time_spent < 0) {
      return NextResponse.json({ error: 'time_spent debe ser un numero positivo (minutos)' }, { status: 400 });
    }
    updateData.time_spent = time_spent;
    if (time_spent !== existingTask.time_spent)
      changes.time_spent = { from: existingTask.time_spent, to: time_spent };
  }
  if (is_archived !== undefined) {
    updateData.is_archived = is_archived;
    if (is_archived !== existingTask.is_archived)
      changes.is_archived = { from: existingTask.is_archived, to: is_archived };
  }
  if (impact !== undefined) {
    const VALID_IMPACTS = ['high', 'medium', 'low'];
    if (impact !== null && !VALID_IMPACTS.includes(impact)) {
      return NextResponse.json({ error: 'Impacto invalido' }, { status: 400 });
    }
    updateData.impact = impact;
    if (impact !== existingTask.impact)
      changes.impact = { from: existingTask.impact, to: impact };
  }
  if (estimated_time !== undefined) {
    if (estimated_time !== null && (typeof estimated_time !== 'number' || estimated_time <= 0)) {
      return NextResponse.json({ error: 'estimated_time debe ser un numero positivo (minutos)' }, { status: 400 });
    }
    updateData.estimated_time = estimated_time;
    if (estimated_time !== existingTask.estimated_time)
      changes.estimated_time = { from: existingTask.estimated_time, to: estimated_time };
  }
  if (block_type !== undefined) {
    const VALID_BLOCK_TYPES = ['internal', 'external'];
    if (block_type !== null && !VALID_BLOCK_TYPES.includes(block_type)) {
      return NextResponse.json({ error: 'block_type invalido' }, { status: 400 });
    }
    updateData.block_type = block_type;
    if (block_type !== existingTask.block_type)
      changes.block_type = { from: existingTask.block_type, to: block_type };
  }
  if (block_reason !== undefined) {
    if (block_reason !== null && typeof block_reason !== 'string') {
      return NextResponse.json({ error: 'block_reason debe ser un string' }, { status: 400 });
    }
    if (typeof block_reason === 'string' && block_reason.length > 2000) {
      return NextResponse.json({ error: 'block_reason no puede exceder 2000 caracteres' }, { status: 400 });
    }
    updateData.block_reason = block_reason;
    if (block_reason !== existingTask.block_reason)
      changes.block_reason = { from: existingTask.block_reason, to: block_reason };
  }

  // DT-1: Auto-escalate priority to urgent if due within 24h
  const effectiveDueDate = due_date !== undefined ? due_date : existingTask.due_date;
  const effectiveStatus = newStatus !== undefined ? newStatus : existingTask.status;
  if (effectiveDueDate && effectiveStatus !== 'completed' && effectiveStatus !== 'blocked') {
    const hoursUntilDue = (new Date(effectiveDueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDue <= 24) {
      const currentPriority = priority !== undefined ? priority : existingTask.priority;
      if (currentPriority !== 'urgent') {
        updateData.priority = 'urgent';
        changes.priority = { from: existingTask.priority, to: 'urgent' };
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No se proporcionaron campos para actualizar' },
      { status: 400 }
    );
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update(updateData as TaskUpdate)
    .eq('id', id)
    .select()
    .single() as { data: Task | null; error: unknown };

  if (updateError || !updatedTask) {
    console.error('Error al actualizar la tarea:', updateError);
    return NextResponse.json(
      { error: 'Error al actualizar la tarea' },
      { status: 500 }
    );
  }

  // ── DT-4: Gamification — Score task completion (runs first to get finalScore) ─
  // Synchronous + non-fatal. Must run before logActivity so the real points
  // are available to inject into the activity timeline entry.
  let gamificationPoints = 0;
  if (changes.status?.to === 'completed' && updatedTask.assigned_to) {
    try {
      const completionTime = updatedTask.completed_at!;
      const dueDateStr = updatedTask.due_date
        ? updatedTask.due_date.substring(0, 10)
        : null;
      const deadlineTime = dueDateStr
        ? `${dueDateStr}T23:59:59-05:00`
        : completionTime;

      const resolvedImpact: 'high' | 'medium' | 'low' = updatedTask.impact ?? 'low';
      const resolvedEffort: number = updatedTask.time_spent ?? updatedTask.estimated_time ?? 60;

      const taskForScoring: TaskDataForScoring = {
        taskId: id,
        impact: resolvedImpact,
        effortMinutes: resolvedEffort,
        deadlineTime,
        completionTime,
      };

      console.log('Gamification: scoring payload para tarea', id, {
        impact: resolvedImpact,
        effortMinutes: resolvedEffort,
        deadlineTime,
        completionTime,
        rawImpact: updatedTask.impact,
        rawTimeSpent: updatedTask.time_spent,
        rawEstimatedTime: updatedTask.estimated_time,
      });

      const scoringResult = await processTaskCompletion(
        updatedTask.assigned_to,
        user.id,
        taskForScoring,
      );

      if (!scoringResult.success) {
        console.warn('Gamification: scoring no exitoso para tarea', id, scoringResult.error);
      } else {
        gamificationPoints = scoringResult.scoring?.finalScore ?? 0;
        console.log('Gamification: scoring exitoso para tarea', id, {
          finalScore: gamificationPoints,
          matrixType: scoringResult.scoring?.matrixType,
          modifiers: scoringResult.scoring?.appliedModifiers.map(m => m.reason),
        });
      }
    } catch (err) {
      console.error('Gamification: error al procesar scoring para tarea', id, err);
    }
  }

  // DT-4b: Backfill real gamification score onto the trigger-inserted activity_log row.
  // The DB trigger fires during the UPDATE above and inserts impact=NULL (migration 019).
  // Now that we have the real score, we UPDATE that row. Requires admin client — no RLS
  // UPDATE policy exists on activity_log.
  if (changes.status?.to === 'completed' && gamificationPoints > 0) {
    const adminSupabase = createAdminClient();
    const recentCutoff = new Date(Date.now() - 10_000).toISOString();
    waitUntil((async () => {
      await adminSupabase
        .from('activity_log')
        .update({ impact: `+${gamificationPoints} pts` } as never)
        .eq('entity_id', id)
        .eq('entity_type', 'task')
        .gte('created_at', recentCutoff);
    })());
  }

  // DT-2: Non-blocking activity log — includes real gamification points
  waitUntil(logActivity(supabase, {
    userId: user.id,
    action: 'task_updated',
    entityType: 'task',
    entityId: id,
    metadata: { changes, points: gamificationPoints },
  }));

  // DT-3: Non-blocking n8n webhook notifications
  if (changes.status?.to === 'completed') {
    waitUntil(notifyTaskCompleted(updatedTask, user));
  }
  if (changes.assigned_to) {
    waitUntil(notifyTaskAssigned(updatedTask, changes.assigned_to.to as string, user));
  }

  return NextResponse.json(updatedTask);
}

// =============================================================================
// DELETE /api/tasks/[id] — Archivar (default) o eliminar permanente (?permanent=true)
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single() as { data: Task | null; error: unknown };

  if (fetchError || !task) {
    return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
  }

  if (!isAdmin(user) && task.assigned_to !== user.id && task.created_by !== user.id) {
    return NextResponse.json(
      { error: 'No tienes permiso para esta accion' },
      { status: 403 }
    );
  }

  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';

  // VULN-1 FIX: Hard delete restricted to admin only
  if (permanent && !isAdmin(user)) {
    return NextResponse.json(
      { error: 'Solo administradores pueden eliminar permanentemente' },
      { status: 403 }
    );
  }

  if (permanent) {
    // Hard delete — removes from DB and KPIs
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id);
    if (deleteError) {
      console.error('Error al eliminar la tarea:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar la tarea' }, { status: 500 });
    }
  } else {
    // Soft delete: archive to preserve KPIs
    const { error: archiveError } = await supabase
      .from('tasks')
      .update({ is_archived: true } as never)
      .eq('id', id);

    if (archiveError) {
      console.error('Error al archivar la tarea:', archiveError);
      return NextResponse.json({ error: 'Error al archivar la tarea' }, { status: 500 });
    }

    // Also archive subtasks
    await supabase
      .from('tasks')
      .update({ is_archived: true } as never)
      .eq('parent_task_id', id);
  }

  // DT-2: Non-blocking activity log
  waitUntil(logActivity(supabase, {
    userId: user.id,
    action: permanent ? 'task_deleted' : 'task_archived',
    entityType: 'task',
    entityId: id,
    metadata: { title: task.title, permanent },
  }));

  return new NextResponse(null, { status: 204 });
}
