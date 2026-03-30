import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, logActivity } from '@/lib/supabase/database';
import type { TaskCategory } from '@/lib/types';

// =============================================================================
// GET /api/categories — Listar todas las categorias
// =============================================================================
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: categories, error } = await supabase
    .from('task_categories')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true }) as { data: TaskCategory[] | null; error: unknown };

  if (error) {
    console.error('Error al obtener categorias:', error);
    return NextResponse.json(
      { error: 'Error al obtener categorias' },
      { status: 500 }
    );
  }

  return NextResponse.json(categories ?? []);
}

// =============================================================================
// POST /api/categories — Crear categoria (cualquier miembro autenticado)
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

  const { name, color } = body as { name?: string; color?: string };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'El nombre de la categoria es obligatorio' }, { status: 400 });
  }
  if (!color || typeof color !== 'string' || color.trim().length === 0) {
    return NextResponse.json({ error: 'El color de la categoria es obligatorio' }, { status: 400 });
  }

  const { data: category, error } = await supabase
    .from('task_categories')
    .insert({
      name: name.trim(),
      color: color.trim(),
      is_default: false,
      created_by: user.id,
    })
    .select()
    .single() as { data: TaskCategory | null; error: unknown };

  if (error || !category) {
    console.error('Error al crear la categoria:', error);
    return NextResponse.json(
      { error: 'Error al crear la categoria' },
      { status: 500 }
    );
  }

  await logActivity(supabase, {
    userId: user.id,
    action: 'category_created',
    entityType: 'task_category',
    entityId: category.id,
    metadata: { name: category.name, color: category.color },
  });

  return NextResponse.json(category, { status: 201 });
}
