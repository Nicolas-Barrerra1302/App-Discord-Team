import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { Task, TaskCategory, TaskCategoryUpdate } from '@/lib/types';

// =============================================================================
// PUT /api/categories/[id] — Actualizar categoria (solo admin)
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
    return NextResponse.json(
      { error: 'Solo administradores pueden editar categorias' },
      { status: 403 }
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from('task_categories')
    .select('*')
    .eq('id', id)
    .single() as { data: TaskCategory | null; error: unknown };

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Categoria no encontrada' }, { status: 404 });
  }

  if (existing.is_default) {
    return NextResponse.json(
      { error: 'No se pueden editar las categorias predeterminadas' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 });
  }

  const { name, color } = body as { name?: string; color?: string };
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre no puede estar vacio' }, { status: 400 });
    }
    updateData.name = name.trim();
  }
  if (color !== undefined) {
    if (typeof color !== 'string' || color.trim().length === 0) {
      return NextResponse.json({ error: 'El color no puede estar vacio' }, { status: 400 });
    }
    updateData.color = color.trim();
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No se proporcionaron campos para actualizar' },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from('task_categories')
    .update(updateData as TaskCategoryUpdate)
    .eq('id', id)
    .select()
    .single() as { data: TaskCategory | null; error: unknown };

  if (updateError || !updated) {
    console.error('Error al actualizar la categoria:', updateError);
    return NextResponse.json(
      { error: 'Error al actualizar la categoria' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'category_updated',
    entityType: 'task_category',
    entityId: id,
    metadata: { changes: updateData },
  });

  return NextResponse.json(updated);
}

// =============================================================================
// DELETE /api/categories/[id] — Eliminar categoria (cualquier miembro autenticado)
// Regla: no eliminar si hay tareas ACTIVAS (is_archived = false).
// Si solo hay tareas archivadas, desvincula la categoria y luego elimina.
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

  const { data: category, error: fetchError } = await supabase
    .from('task_categories')
    .select('*')
    .eq('id', id)
    .single() as { data: TaskCategory | null; error: unknown };

  if (fetchError || !category) {
    return NextResponse.json({ error: 'Categoria no encontrada' }, { status: 404 });
  }

  if (category.is_default) {
    return NextResponse.json(
      { error: 'No se pueden eliminar las categorias predeterminadas' },
      { status: 403 }
    );
  }

  // Check if any ACTIVE (non-archived) tasks use this category
  const { data: activeTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('category_id', id)
    .or('is_archived.eq.false,is_archived.is.null')
    .limit(1) as { data: Pick<Task, 'id'>[] | null };

  if (activeTasks && activeTasks.length > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar: Esta categoría está en uso por tareas activas.' },
      { status: 400 }
    );
  }

  // Unlink archived tasks that reference this category before deleting
  await supabase
    .from('tasks')
    .update({ category_id: null } as never)
    .eq('category_id', id)
    .eq('is_archived', true);

  // Also unlink any recurrence templates that reference this category
  await supabase
    .from('task_recurrences')
    .update({ category_id: null } as never)
    .eq('category_id', id);

  const { error: deleteError } = await supabase
    .from('task_categories')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Error al eliminar la categoria:', deleteError);
    return NextResponse.json(
      { error: 'Error al eliminar la categoria' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'category_deleted',
    entityType: 'task_category',
    entityId: id,
    metadata: { name: category.name },
  });

  return new NextResponse(null, { status: 204 });
}
