import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { TaskComment, User } from '@/lib/types';

// =============================================================================
// GET /api/tasks/[id]/comments — Listar comentarios de una tarea
// =============================================================================
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Verify user has access to this task
  const { data: parentTask } = await supabase
    .from('tasks')
    .select('assigned_to')
    .eq('id', taskId)
    .single() as { data: { assigned_to: string } | null };

  if (!parentTask) {
    return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
  }
  if (!isAdmin(user) && parentTask.assigned_to !== user.id) {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  const { data: comments, error } = await supabase
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true }) as { data: TaskComment[] | null; error: unknown };

  if (error) {
    console.error('Error al obtener comentarios:', error);
    return NextResponse.json(
      { error: 'Error al obtener comentarios' },
      { status: 500 }
    );
  }

  const userIds = [...new Set((comments ?? []).map((c) => c.user_id))];
  let enriched = (comments ?? []) as (TaskComment & { user_name?: string; user_avatar?: string | null })[];

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', userIds) as { data: Pick<User, 'id' | 'name' | 'avatar_url'>[] | null };

    const userMap = (users ?? []).reduce<
      Record<string, { name: string; avatar_url: string | null }>
    >((acc, u) => {
      acc[u.id] = { name: u.name, avatar_url: u.avatar_url };
      return acc;
    }, {});

    enriched = (comments ?? []).map((c) => ({
      ...c,
      user_name: userMap[c.user_id]?.name ?? 'Desconocido',
      user_avatar: userMap[c.user_id]?.avatar_url ?? null,
    }));
  }

  return NextResponse.json(enriched);
}

// =============================================================================
// POST /api/tasks/[id]/comments — Crear comentario
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Verify user has access to this task
  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to')
    .eq('id', taskId)
    .single() as { data: { assigned_to: string } | null };

  if (!task) {
    return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
  }
  if (!isAdmin(user) && task.assigned_to !== user.id) {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 });
  }

  const { content } = body as { content?: string };

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json(
      { error: 'El contenido del comentario es obligatorio' },
      { status: 400 }
    );
  }

  const { data: comment, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      user_id: user.id,
      content: content.trim(),
    })
    .select()
    .single() as { data: TaskComment | null; error: unknown };

  if (error || !comment) {
    console.error('Error al crear el comentario:', error);
    return NextResponse.json(
      { error: 'Error al crear el comentario' },
      { status: 500 }
    );
  }

  // DT-2: Non-blocking activity log
  waitUntil(logActivity(supabase, {
    userId: user.id,
    action: 'comment_added',
    entityType: 'task_comment',
    entityId: comment.id,
    metadata: { task_id: taskId },
  }));

  return NextResponse.json(
    { ...comment, user_name: user.name, user_avatar: user.avatar_url },
    { status: 201 }
  );
}
