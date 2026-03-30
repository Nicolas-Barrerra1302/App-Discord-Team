// =============================================================================
// Resilient Webhook Dispatcher — n8n Integration (Hito 8)
//
// Fire-and-forget webhook calls to n8n. Designed to be used inside
// `waitUntil()` from @vercel/functions so the HTTP response is never blocked.
//
// Guarantees:
//   - Never throws (all errors swallowed with console.warn)
//   - Aborts after WEBHOOK_TIMEOUT_MS (5 s) via AbortController
//   - Gracefully degrades when N8N_WEBHOOK_BASE_URL is not set (dev mode)
// =============================================================================

import type { Task, User } from '@/lib/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WEBHOOK_TIMEOUT_MS = 5_000;

const N8N_WEBHOOK_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL ?? '';
const N8N_WEBHOOK_SECRET   = process.env.N8N_WEBHOOK_SECRET   ?? '';
const WEBHOOK_ENABLED      = N8N_WEBHOOK_BASE_URL.length > 0;

// ---------------------------------------------------------------------------
// Core dispatcher
// ---------------------------------------------------------------------------

/**
 * Sends a POST request to `{N8N_WEBHOOK_BASE_URL}/{event}` with the given
 * JSON payload. Aborts after 5 s. Never throws.
 */
export async function dispatchWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!WEBHOOK_ENABLED) {
    console.warn(`[WEBHOOK] Skipped "${event}" — N8N_WEBHOOK_BASE_URL not configured`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const url = `${N8N_WEBHOOK_BASE_URL}/${event}`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_WEBHOOK_SECRET ? { 'X-Webhook-Secret': N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ ...payload, _ts: new Date().toISOString() }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const msg = err instanceof Error ? err.message : String(err);
    // Surface key payload fields for context without serialising large objects
    const payloadContext = Object.keys(payload)
      .map((k) => `${k}=${String(payload[k]).slice(0, 40)}`)
      .join(' ');
    console.warn(
      `[WEBHOOK_ERROR] event="${event}" reason=${isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'} error="${msg}" | ${payloadContext}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Typed helpers — one per notification event
// ---------------------------------------------------------------------------

/** Task was marked as completed (drag-and-drop or form). */
export async function notifyTaskCompleted(
  task: Pick<Task, 'id' | 'title' | 'assigned_to' | 'completed_at'>,
  completedBy: Pick<User, 'id' | 'name'>,
): Promise<void> {
  return dispatchWebhook('task-completed', {
    task_id: task.id,
    title: task.title,
    assigned_to: task.assigned_to,
    completed_at: task.completed_at,
    completed_by_id: completedBy.id,
    completed_by_name: completedBy.name,
  });
}

/** Task was re-assigned to a different member. */
export async function notifyTaskAssigned(
  task: Pick<Task, 'id' | 'title'>,
  newAssigneeId: string,
  assignedBy: Pick<User, 'id' | 'name'>,
): Promise<void> {
  return dispatchWebhook('task-assigned', {
    task_id: task.id,
    title: task.title,
    assigned_to: newAssigneeId,
    assigned_by_id: assignedBy.id,
    assigned_by_name: assignedBy.name,
  });
}

/** Bonus point event registered for a member. */
export async function notifyBonusEvent(
  launchId: string,
  targetUserId: string,
  eventType: string,
  points: number,
  registeredBy: Pick<User, 'id' | 'name'>,
): Promise<void> {
  return dispatchWebhook('bonus-event', {
    launch_id: launchId,
    user_id: targetUserId,
    event_type: eventType,
    points,
    registered_by_id: registeredBy.id,
    registered_by_name: registeredBy.name,
  });
}

/** Daily check-in saved. */
export async function notifyCheckinSaved(
  userId: string,
  userName: string,
  completionPct: number,
  summaryPreview: string,
): Promise<void> {
  return dispatchWebhook('checkin-saved', {
    user_id: userId,
    user_name: userName,
    completion_pct: completionPct,
    summary_preview: summaryPreview.slice(0, 200),
  });
}
