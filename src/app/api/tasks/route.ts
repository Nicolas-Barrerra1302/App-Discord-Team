import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { Task, Json, TaskType } from '@/lib/types';

// =============================================================================
// GET /api/tasks — Lista de tareas con filtros
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const categoryId = searchParams.get('category_id');
  const search = searchParams.get('search');
  const assignedTo = searchParams.get('assigned_to');
  const dueFrom = searchParams.get('due_from');
  const dueTo = searchParams.get('due_to');
  const showArchived = searchParams.get('archived') === 'true';
  const taskType = searchParams.get('task_type');
  const limitParam = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10) || 0;

  let query = supabase
    .from('tasks')
    .select('*')
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })
    .range(offsetParam, offsetParam + limitParam - 1);

  // By default hide archived tasks unless explicitly requested
  if (!showArchived) {
    query = query.eq('is_archived', false);
  }

  // Members: only tasks where they are assigned_to OR created_by
  if (!isAdmin(user)) {
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
  }
  if (status) query = query.eq('status', status as Task['status']);
  if (priority) query = query.eq('priority', priority as Task['priority']);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (assignedTo && isAdmin(user)) query = query.eq('assigned_to', assignedTo);
  if (dueFrom) query = query.gte('due_date', dueFrom);
  if (dueTo) query = query.lte('due_date', dueTo);
  if (taskType && ['planeada', 'incendio'].includes(taskType)) {
    query = query.eq('task_type', taskType as TaskType);
  }
  if (search) {
    // Sanitize: strip PostgREST special chars to prevent filter injection
    const sanitized = search.replace(/[,.()*%\\]/g, '').trim();
    if (sanitized) {
      query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }
  }

  const { data: tasks, error } = await query as { data: Task[] | null; error: unknown };

  if (error) {
    console.error('Error al obtener tareas:', error);
    return NextResponse.json(
      { error: 'Error al obtener tareas' },
      { status: 500 }
    );
  }

  // Get subtask counts (total + completed)
  const taskIds = (tasks ?? []).map((t) => t.id);
  const subtaskCounts: Record<string, number> = {};
  const completedCounts: Record<string, number> = {};

  if (taskIds.length > 0) {
    const { data: subtasks } = await supabase
      .from('tasks')
      .select('parent_task_id, status')
      .in('parent_task_id', taskIds) as { data: { parent_task_id: string; status: string }[] | null };

    if (subtasks) {
      for (const s of subtasks) {
        subtaskCounts[s.parent_task_id] = (subtaskCounts[s.parent_task_id] || 0) + 1;
        if (s.status === 'completed') {
          completedCounts[s.parent_task_id] = (completedCounts[s.parent_task_id] || 0) + 1;
        }
      }
    }
  }

  const tasksWithCounts = (tasks ?? []).map((task) => ({
    ...task,
    subtask_count: subtaskCounts[task.id] || 0,
    subtask_completed_count: completedCounts[task.id] || 0,
  }));

  return NextResponse.json(tasksWithCounts);
}

// =============================================================================
// POST /api/tasks — Crear tarea
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
    title, description, status: taskStatus, priority,
    assigned_to, due_date, category_id, parent_task_id, attachments,
    task_type, time_spent, impact, estimated_time, block_type, block_reason,
  } = body as {
    title?: string; description?: string; status?: string; priority?: string;
    assigned_to?: string; due_date?: string; category_id?: string;
    parent_task_id?: string; attachments?: Json[];
    task_type?: string; time_spent?: number;
    impact?: string; estimated_time?: number;
    block_type?: string; block_reason?: string;
  };

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'El titulo es obligatorio' }, { status: 400 });
  }

  const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
  const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

  if (taskStatus && !VALID_STATUSES.includes(taskStatus)) {
    return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'Prioridad invalida' }, { status: 400 });
  }

  const VALID_TASK_TYPES = ['planeada', 'incendio'];
  if (task_type && !VALID_TASK_TYPES.includes(task_type)) {
    return NextResponse.json({ error: 'Tipo de tarea invalido' }, { status: 400 });
  }

  if (time_spent !== undefined && (typeof time_spent !== 'number' || time_spent < 0)) {
    return NextResponse.json({ error: 'time_spent debe ser un numero positivo (minutos)' }, { status: 400 });
  }

  const VALID_IMPACTS = ['high', 'medium', 'low'];
  if (impact && !VALID_IMPACTS.includes(impact)) {
    return NextResponse.json({ error: 'Impacto invalido' }, { status: 400 });
  }
  if (estimated_time !== undefined && (typeof estimated_time !== 'number' || estimated_time <= 0)) {
    return NextResponse.json({ error: 'estimated_time debe ser un numero positivo (minutos)' }, { status: 400 });
  }
  const VALID_BLOCK_TYPES = ['internal', 'external'];
  if (block_type && !VALID_BLOCK_TYPES.includes(block_type)) {
    return NextResponse.json({ error: 'block_type invalido' }, { status: 400 });
  }

  const finalAssignedTo = isAdmin(user) ? (assigned_to ?? user.id) : user.id;

  // DT-1: Auto-escalate priority to urgent if due within 24h
  let finalPriority = (priority ?? 'medium') as Task['priority'];
  const finalStatus = (taskStatus ?? 'pending') as Task['status'];
  if (due_date && finalStatus !== 'completed' && finalStatus !== 'blocked') {
    const hoursUntilDue = (new Date(due_date).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDue <= 24) {
      finalPriority = 'urgent';
    }
  }

  const { data: newTask, error } = await supabase
    .from('tasks')
    .insert({
      title: title.trim(),
      description: description ?? null,
      status: finalStatus,
      priority: finalPriority,
      assigned_to: finalAssignedTo,
      created_by: user.id,
      due_date: due_date ?? null,
      completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
      category_id: category_id ?? null,
      parent_task_id: parent_task_id ?? null,
      is_recurring_instance: false,
      recurrence_id: null,
      attachments: attachments ?? [],
      is_archived: false,
      task_type: (task_type ?? 'planeada') as TaskType,
      time_spent: time_spent ?? null,
      estimated_time: estimated_time ?? null,
      impact: (impact ?? null) as Task['impact'],
      block_type: (block_type ?? null) as Task['block_type'],
      block_reason: block_reason ?? null,
    })
    .select()
    .single() as { data: Task | null; error: unknown };

  if (error || !newTask) {
    console.error('Error al crear la tarea:', error);
    return NextResponse.json(
      { error: 'Error al crear la tarea' },
      { status: 500 }
    );
  }

  // DT-2: Non-blocking activity log
  waitUntil(logActivity(supabase, {
    userId: user.id,
    action: 'task_created',
    entityType: 'task',
    entityId: newTask.id,
    metadata: { title: newTask.title, assigned_to: newTask.assigned_to },
  }));

  return NextResponse.json(newTask, { status: 201 });
}
