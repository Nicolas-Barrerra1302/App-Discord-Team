import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { KpiDefinition } from '@/lib/types';

const VALID_DATA_TYPES = ['number', 'boolean', 'percentage'] as const;
const VALID_DIRECTIONS = ['asc', 'desc'] as const;

// =============================================================================
// GET /api/kpis/definitions
// Members: only active definitions assigned to them
// Admins: all definitions
// =============================================================================
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  let query = supabase
    .from('kpi_definitions')
    .select('id, name, description, data_type, direction, target_value, max_points, assigned_to, is_active, display_order, created_by, created_at')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (isAdmin(user)) {
    // Admin can filter by user_id or see all
    if (userId && userId !== 'all') {
      query = query.eq('assigned_to', userId);
    }
  } else {
    // Members see only their own active definitions
    query = query.eq('assigned_to', user.id).eq('is_active', true);
  }

  const { data, error } = (await query) as { data: KpiDefinition[] | null; error: unknown };

  if (error) {
    console.error('Error al obtener KPI definitions:', error);
    return NextResponse.json({ error: 'Error al obtener KPIs' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// =============================================================================
// POST /api/kpis/definitions — Create a new KPI definition (admins only)
// =============================================================================
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const body = await request.json();
  const { name, description, data_type, direction, target_value, max_points, assigned_to, display_order } = body;

  // Validation
  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }
  if (!VALID_DATA_TYPES.includes(data_type)) {
    return NextResponse.json({ error: 'Tipo de dato inválido' }, { status: 400 });
  }
  if (direction !== undefined && !VALID_DIRECTIONS.includes(direction)) {
    return NextResponse.json({ error: 'direction inválido (asc|desc)' }, { status: 400 });
  }
  if (!Number.isInteger(max_points) || max_points <= 0) {
    return NextResponse.json({ error: 'max_points debe ser un entero positivo' }, { status: 400 });
  }
  const parsedTarget = parseFloat(target_value);
  if (isNaN(parsedTarget) || parsedTarget <= 0) {
    return NextResponse.json({ error: 'target_value debe ser mayor a 0' }, { status: 400 });
  }
  if (!assigned_to) {
    return NextResponse.json({ error: 'assigned_to es requerido' }, { status: 400 });
  }

  const { data, error } = (await supabase
    .from('kpi_definitions')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      data_type,
      direction: direction ?? 'asc',
      target_value: parsedTarget,
      max_points,
      assigned_to,
      display_order: display_order ?? 0,
      created_by: user.id,
    } as never)
    .select('id, name, description, data_type, direction, target_value, max_points, assigned_to, is_active, display_order, created_by, created_at')
    .single()) as { data: KpiDefinition | null; error: unknown };

  if (error) {
    console.error('Error al crear KPI:', error);
    return NextResponse.json({ error: 'Error al crear KPI' }, { status: 500 });
  }

  waitUntil(
    logActivity(supabase, {
      userId: user.id,
      action: `Creó KPI "${name.trim()}"`,
      entityType: 'kpi_definition',
      entityId: data?.id ?? null,
    })
  );

  return NextResponse.json(data, { status: 201 });
}
