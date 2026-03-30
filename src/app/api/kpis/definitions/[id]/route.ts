import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, isAdmin, logActivity } from '@/lib/supabase/database';
import type { KpiDefinition } from '@/lib/types';

// =============================================================================
// PUT /api/kpis/definitions/[id] — Update a KPI definition (admins only)
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const body = await request.json();
  const { name, description, target_value, max_points, is_active, display_order } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (target_value !== undefined) updates.target_value = parseFloat(target_value);
  if (max_points !== undefined) updates.max_points = max_points;
  if (is_active !== undefined) updates.is_active = is_active;
  if (display_order !== undefined) updates.display_order = display_order;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { data, error } = (await supabase
    .from('kpi_definitions')
    .update(updates as never)
    .eq('id', params.id)
    .select('id, name, description, data_type, direction, target_value, max_points, assigned_to, is_active, display_order, created_by, created_at')
    .single()) as { data: KpiDefinition | null; error: unknown };

  if (error) {
    console.error('Error al actualizar KPI:', error);
    return NextResponse.json({ error: 'Error al actualizar KPI' }, { status: 500 });
  }

  if (!data) return NextResponse.json({ error: 'KPI no encontrado' }, { status: 404 });

  waitUntil(
    logActivity(supabase, {
      userId: user.id,
      action: `Actualizó KPI "${data.name}"`,
      entityType: 'kpi_definition',
      entityId: params.id,
    })
  );

  return NextResponse.json(data);
}

// =============================================================================
// DELETE /api/kpis/definitions/[id] — Delete (admin only)
// Soft-deletes by setting is_active=false if there are submitted tracking rows;
// hard-deletes only if no tracking history exists.
// =============================================================================
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  // Check if any tracking data exists for this KPI
  const { count } = (await supabase
    .from('kpi_tracking')
    .select('id', { count: 'exact', head: true })
    .eq('kpi_id', params.id)) as { count: number | null };

  if ((count ?? 0) > 0) {
    // Soft-delete: deactivate to preserve history
    const { error } = await supabase
      .from('kpi_definitions')
      .update({ is_active: false } as never)
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: 'Error al desactivar KPI' }, { status: 500 });
    }

    return NextResponse.json({ message: 'KPI desactivado (tiene historial)', soft: true });
  }

  // Hard-delete: no tracking data
  const { error } = await supabase
    .from('kpi_definitions')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar KPI' }, { status: 500 });
  }

  waitUntil(
    logActivity(supabase, {
      userId: user.id,
      action: 'Eliminó definición de KPI',
      entityType: 'kpi_definition',
      entityId: params.id,
    })
  );

  return NextResponse.json({ message: 'KPI eliminado', soft: false });
}
