import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logActivity } from '@/lib/supabase/database';
import { getTodayColombia, getDayOfWeekColombia, getDayOfMonthColombia, matchesSchedule, calculateNextDueDate } from '@/lib/tasks/dates';
import type { TaskRecurrence, UserAbsence, Task, TaskRecurrenceUpdate } from '@/lib/types';

// =============================================================================
// GET /api/cron/generate-tasks — Health check
// =============================================================================
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'generate-tasks' });
}

// =============================================================================
// POST /api/cron/generate-tasks — Generate recurring task instances
// Called daily at 6:00 AM COT (11:00 UTC) by Vercel Cron
// ?force=true (dev only): skip schedule + duplicate checks
// =============================================================================
export async function POST(request: NextRequest) {
  // -------------------------------------------------------------------------
  // 1. Auth: Bearer token (prod) OR dev force bypass
  // -------------------------------------------------------------------------
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isForceParam = request.nextUrl.searchParams.get('force') === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  const hasValidToken = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasDevBypass = isDev && isForceParam;

  if (!hasValidToken && !hasDevBypass) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    );
  }

  // Force mode: skip schedule + duplicate checks
  const forceMode = isForceParam;

  const supabase = createAdminClient();

  // -------------------------------------------------------------------------
  // 2. Date setup (Colombia timezone — COT)
  // -------------------------------------------------------------------------
  const now = new Date();
  const todayStr = getTodayColombia();
  const todayDow = getDayOfWeekColombia();
  const todayDom = getDayOfMonthColombia();

  if (forceMode) {
    console.log('[CRON] === FORCE MODE ACTIVADO ===');
    console.log(`[CRON] Fecha hoy (COT): ${todayStr} | DOW: ${todayDow} | DOM: ${todayDom}`);
  }

  // -------------------------------------------------------------------------
  // 3. Fetch active recurrences + current absences in parallel
  // -------------------------------------------------------------------------
  const recurrenceQuery = supabase
    .from('task_recurrences')
    .select('*')
    .eq('is_active', true);

  const absenceQuery = supabase
    .from('user_absences')
    .select('*')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);

  const [recurrencesResult, absencesResult] = await Promise.all([
    recurrenceQuery,
    absenceQuery,
  ]) as [
    { data: TaskRecurrence[] | null; error: unknown },
    { data: UserAbsence[] | null; error: unknown },
  ];

  if (recurrencesResult.error) {
    console.error(`[CRON_ERROR] Failed to fetch task_recurrences: ${String(recurrencesResult.error)}`);
    return NextResponse.json(
      { error: 'Error al obtener recurrencias' },
      { status: 500 }
    );
  }

  if (absencesResult.error) {
    console.error(`[CRON_ERROR] Failed to fetch user_absences for date=${todayStr}: ${String(absencesResult.error)}`);
    return NextResponse.json(
      { error: 'Error al obtener ausencias — abortando generación' },
      { status: 500 }
    );
  }

  const recurrences = recurrencesResult.data ?? [];
  const absences = absencesResult.data ?? [];

  // O(1) lookup for absent users
  const absentUserIds = new Set(absences.map((a) => a.user_id));

  if (forceMode) {
    console.log(`[CRON] Recurrencias activas: ${recurrences.length}`);
    console.log(`[CRON] Usuarios ausentes hoy: ${absentUserIds.size} -> [${[...absentUserIds].join(', ')}]`);
  }

  // -------------------------------------------------------------------------
  // 4. Pre-fetch today's already-generated recurrence IDs (batch — kills N+1)
  // -------------------------------------------------------------------------
  let alreadyGenerated = new Set<string>();
  if (!forceMode) {
    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('recurrence_id')
      .eq('is_recurring_instance', true)
      .not('recurrence_id', 'is', null)
      .gte('created_at', `${todayStr}T00:00:00.000Z`)
      .lt('created_at', `${todayStr}T23:59:59.999Z`) as {
      data: { recurrence_id: string }[] | null;
    };
    alreadyGenerated = new Set(
      (todayTasks ?? []).map(t => t.recurrence_id)
    );
  }

  // -------------------------------------------------------------------------
  // 5. Process each recurrence
  // -------------------------------------------------------------------------
  let generated = 0;
  let skippedAbsent = 0;
  let skippedSchedule = 0;
  let skippedDuplicate = 0;
  const errors: string[] = [];

  for (const recurrence of recurrences) {
    const label = `"${recurrence.title}" (${recurrence.id.slice(0, 8)})`;

    try {
      // 5a. Skip if assigned user is absent (ALWAYS enforced, even in force mode)
      if (recurrence.assigned_to && absentUserIds.has(recurrence.assigned_to)) {
        skippedAbsent++;
        console.log(`[CRON] SKIP ${label} -> usuario ausente (${recurrence.assigned_to.slice(0, 8)})`);
        continue;
      }

      // 5b. Check if today matches the recurrence schedule
      if (!forceMode && !matchesSchedule(recurrence, todayDow, todayDom, todayStr)) {
        skippedSchedule++;
        console.log(`[CRON] SKIP ${label} -> no coincide con schedule hoy`);
        continue;
      }

      // 5c. Check for duplicate using pre-fetched Set (O(1) lookup, no DB query)
      if (!forceMode && alreadyGenerated.has(recurrence.id)) {
        skippedDuplicate++;
        console.log(`[CRON] SKIP ${label} -> ya generada hoy (duplicado)`);
        continue;
      }

      // 5d. Insert the new task instance
      console.log(`[CRON] GENERANDO ${label} -> asignada a ${recurrence.assigned_to?.slice(0, 8) ?? 'nadie'}`);

      const insertData = {
        title: recurrence.title,
        description: recurrence.description,
        status: 'pending' as const,
        priority: recurrence.priority,
        assigned_to: recurrence.assigned_to,
        created_by: recurrence.created_by,
        due_date: todayStr,
        completed_at: null,
        category_id: recurrence.category_id,
        parent_task_id: null,
        is_recurring_instance: true,
        recurrence_id: recurrence.id,
        attachments: [],
        impact: recurrence.impact ?? null,
        estimated_time: recurrence.estimated_time ?? null,
        task_type: recurrence.task_type,
      };

      const { data: newTask, error: insertError } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single() as { data: Task | null; error: unknown };

      if (insertError || !newTask) {
        errors.push(`Error creando tarea para recurrencia ${recurrence.id}: ${String(insertError)}`);
        console.error(`[CRON_ERROR] recurrence_id=${recurrence.id} title="${recurrence.title}" assigned_to=${recurrence.assigned_to ?? 'none'} error="${String(insertError)}"`);
        continue;
      }

      // 5e. Task created — increment BEFORE non-critical side-effects so that a
      //     logActivity or next_due_date failure never undercounts generated tasks.
      generated++;

      // 5f. Log activity (isolated: its failure must not affect the generated count)
      try {
        await logActivity(supabase, {
          userId: null,
          action: 'cron_task_generated',
          entityType: 'task',
          entityId: newTask.id,
          metadata: {
            recurrence_id: recurrence.id,
            recurrence_title: recurrence.title,
            force_mode: forceMode || undefined,
          },
        });
      } catch (logErr: unknown) {
        console.error(`[CRON_ERROR] logActivity failed for recurrence_id=${recurrence.id} task_id=${newTask.id}: ${String(logErr)}`);
      }

      // 5g. Update next_due_date on the recurrence (skip in force mode to not mess dates)
      if (!forceMode) {
        const nextDate = calculateNextDueDate(recurrence, todayStr);
        if (nextDate) {
          const { error: updateError } = await supabase
            .from('task_recurrences')
            .update({ next_due_date: nextDate } as TaskRecurrenceUpdate)
            .eq('id', recurrence.id);
          if (updateError) {
            console.error(`[CRON_ERROR] next_due_date update failed recurrence_id=${recurrence.id} next="${nextDate}": ${String(updateError)}`);
          }
        }
      }
    } catch (err: unknown) {
      errors.push(`Excepcion en recurrencia ${recurrence.id}: ${String(err)}`);
      console.error(`[CRON_ERROR] Unhandled exception recurrence_id=${recurrence.id} title="${recurrence.title}": ${String(err)}`);
    }
  }

  // -------------------------------------------------------------------------
  // 6. Return summary
  // -------------------------------------------------------------------------
  console.log(`[CRON_SUMMARY] date=${todayStr} generated=${generated} skipped_absent=${skippedAbsent} skipped_schedule=${skippedSchedule} skipped_duplicate=${skippedDuplicate} errors=${errors.length} total_recurrences=${recurrences.length} force_mode=${forceMode}`);

  return NextResponse.json({
    generated,
    skipped_absent: skippedAbsent,
    skipped_schedule: skippedSchedule,
    skipped_duplicate: skippedDuplicate,
    total_recurrences: recurrences.length,
    force_mode: forceMode || undefined,
    errors: errors.length > 0 ? errors : undefined,
    executed_at: now.toISOString(),
  });
}
