export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TARGET_DISCORD_ID = '1333969040720527363';

/**
 * POST /api/dev-seed — Insert 12 realistic test tasks for coaching metrics.
 * Dev-only: requires NODE_ENV=development + ?force=true.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Solo disponible en desarrollo' }, { status: 403 });
  }
  const force = request.nextUrl.searchParams.get('force');
  if (force !== 'true') {
    return NextResponse.json({ error: 'Usa ?force=true' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolve Discord snowflake → internal UUID
  const { data: targetUser } = await supabase
    .from('users')
    .select('id')
    .eq('discord_id', TARGET_DISCORD_ID)
    .single() as { data: { id: string } | null };

  if (!targetUser) {
    return NextResponse.json({ error: `Usuario con discord_id ${TARGET_DISCORD_ID} no encontrado` }, { status: 404 });
  }

  const TARGET_USER_ID = targetUser.id;
  const now = new Date();

  // Helper: date N days ago at a specific hour
  function daysAgo(n: number, hour = 10): string {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }

  // Helper: date string YYYY-MM-DD for N days ago
  function dueDateAgo(n: number): string {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().substring(0, 10);
  }

  // 12 tasks with realistic variation for coaching metrics
  // estimated_time & time_spent in minutes
  // Some faster (-20%), some slower (+50%), some exact
  const tasks = [
    // --- HIGH IMPACT (3) ---
    {
      title: '[Seed] Diseñar landing page v2',
      status: 'completed' as const,
      priority: 'high' as const,
      impact: 'high' as const,
      task_type: 'planeada' as const,
      estimated_time: 180, // 3h estimated
      time_spent: 270,     // 4.5h real → +50% slower
      created_at: daysAgo(7, 9),
      due_date: dueDateAgo(5),
      completed_at: daysAgo(5, 17),
    },
    {
      title: '[Seed] Integración API de pagos',
      status: 'completed' as const,
      priority: 'urgent' as const,
      impact: 'high' as const,
      task_type: 'incendio' as const,  // fire task
      estimated_time: 240, // 4h
      time_spent: 192,     // 3.2h → -20% faster
      created_at: daysAgo(6, 8),
      due_date: dueDateAgo(4),
      completed_at: daysAgo(4, 15),
    },
    {
      title: '[Seed] Refactorizar módulo de auth',
      status: 'completed' as const,
      priority: 'high' as const,
      impact: 'high' as const,
      task_type: 'planeada' as const,
      estimated_time: 120, // 2h
      time_spent: 180,     // 3h → +50% slower
      created_at: daysAgo(5, 10),
      due_date: dueDateAgo(3),
      completed_at: daysAgo(3, 14),
    },
    // --- MEDIUM IMPACT (5) ---
    {
      title: '[Seed] Actualizar documentación API',
      status: 'completed' as const,
      priority: 'medium' as const,
      impact: 'medium' as const,
      task_type: 'planeada' as const,
      estimated_time: 60,  // 1h
      time_spent: 48,      // 0.8h → -20% faster
      created_at: daysAgo(6, 11),
      due_date: dueDateAgo(5),
      completed_at: daysAgo(5, 14),
    },
    {
      title: '[Seed] Code review PR #42',
      status: 'completed' as const,
      priority: 'medium' as const,
      impact: 'medium' as const,
      task_type: 'planeada' as const,
      estimated_time: 45,
      time_spent: 45,      // exact
      created_at: daysAgo(5, 9),
      due_date: dueDateAgo(4),
      completed_at: daysAgo(4, 11),
    },
    {
      title: '[Seed] Configurar CI/CD pipeline',
      status: 'completed' as const,
      priority: 'medium' as const,
      impact: 'medium' as const,
      task_type: 'planeada' as const,
      estimated_time: 90,
      time_spent: 135,     // +50% slower
      created_at: daysAgo(4, 10),
      due_date: dueDateAgo(2),
      completed_at: daysAgo(2, 16),
    },
    {
      title: '[Seed] Hotfix notificaciones rotas',
      status: 'completed' as const,
      priority: 'urgent' as const,
      impact: 'medium' as const,
      task_type: 'incendio' as const,  // fire
      estimated_time: 30,
      time_spent: 24,      // -20% faster
      created_at: daysAgo(3, 14),
      due_date: dueDateAgo(3),
      completed_at: daysAgo(3, 16),
    },
    {
      title: '[Seed] Migrar estilos a Tailwind',
      status: 'in_progress' as const,
      priority: 'medium' as const,
      impact: 'medium' as const,
      task_type: 'planeada' as const,
      estimated_time: 150,
      time_spent: null,
      created_at: daysAgo(2, 9),
      due_date: dueDateAgo(0), // due today
      completed_at: null,
    },
    // --- LOW IMPACT (4) ---
    {
      title: '[Seed] Limpiar logs de staging',
      status: 'completed' as const,
      priority: 'low' as const,
      impact: 'low' as const,
      task_type: 'planeada' as const,
      estimated_time: 20,
      time_spent: 16,      // -20% faster
      created_at: daysAgo(7, 14),
      due_date: dueDateAgo(6),
      completed_at: daysAgo(6, 15),
    },
    {
      title: '[Seed] Actualizar dependencias npm',
      status: 'completed' as const,
      priority: 'low' as const,
      impact: 'low' as const,
      task_type: 'planeada' as const,
      estimated_time: 30,
      time_spent: 45,      // +50% slower
      created_at: daysAgo(4, 11),
      due_date: dueDateAgo(3),
      completed_at: daysAgo(3, 12),
    },
    {
      title: '[Seed] Fix typo en footer',
      status: 'completed' as const,
      priority: 'low' as const,
      impact: 'low' as const,
      task_type: 'incendio' as const,  // fire
      estimated_time: 10,
      time_spent: 8,       // -20% faster
      created_at: daysAgo(2, 15),
      due_date: dueDateAgo(2),
      completed_at: daysAgo(2, 15),
    },
    {
      title: '[Seed] Reorganizar carpeta assets',
      status: 'pending' as const,
      priority: 'low' as const,
      impact: 'low' as const,
      task_type: 'planeada' as const,
      estimated_time: 40,
      time_spent: null,
      created_at: daysAgo(1, 9),
      due_date: dueDateAgo(-1), // tomorrow
      completed_at: null,
    },
  ];

  // Delete previous seed data — use textSearch or filter by exact prefix
  const { data: existingSeeds } = await supabase
    .from('tasks')
    .select('id')
    .eq('assigned_to', TARGET_USER_ID)
    .ilike('title', '\\[Seed\\]%') as { data: { id: string }[] | null; error: unknown };

  let delError: unknown = null;
  if (existingSeeds && existingSeeds.length > 0) {
    const ids = existingSeeds.map(s => s.id);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', ids) as { error: unknown };
    delError = error;
  }

  if (delError) {
    return NextResponse.json({ error: 'Error limpiando seeds previos', detail: String(delError) }, { status: 500 });
  }

  // Insert
  const rows = tasks.map(t => ({
    ...t,
    assigned_to: TARGET_USER_ID,
    created_by: TARGET_USER_ID,
  }));

  const { data, error } = await supabase
    .from('tasks')
    .insert(rows as never)
    .select() as { data: unknown[] | null; error: { message?: string; details?: string; code?: string } | null };

  if (error) {
    console.error('[dev-seed] Insert error:', JSON.stringify(error));
    return NextResponse.json({ error: 'Error insertando seeds', detail: error.message ?? JSON.stringify(error), code: error.code }, { status: 500 });
  }

  // Summary
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const fireCount = tasks.filter(t => t.task_type === 'incendio').length;
  const impactSummary = {
    high: tasks.filter(t => t.impact === 'high').length,
    medium: tasks.filter(t => t.impact === 'medium').length,
    low: tasks.filter(t => t.impact === 'low').length,
  };

  return NextResponse.json({
    message: `Seed exitoso: ${data?.length ?? 0} tareas insertadas`,
    user_id: TARGET_USER_ID,
    summary: {
      total: tasks.length,
      completed: completedCount,
      fire_tasks: fireCount,
      impact: impactSummary,
      date_range: `${dueDateAgo(7)} → ${dueDateAgo(0)}`,
    },
  });
}
