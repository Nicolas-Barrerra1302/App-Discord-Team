import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, User, UserRole } from '@/lib/types';

type TypedClient = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// getCurrentUser — Fetches the authenticated user's row from public.users
// ---------------------------------------------------------------------------
export async function getCurrentUser(
  supabase: TypedClient
): Promise<User | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  // The Discord provider stores the Discord user ID in user_metadata
  const discordId =
    authUser.user_metadata?.provider_id ??
    authUser.user_metadata?.sub ??
    null;

  if (!discordId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('discord_id', discordId)
    .single();

  if (error || !data) return null;

  return data as User;
}

// ---------------------------------------------------------------------------
// Role checks
// ---------------------------------------------------------------------------

const ADMIN_ROLES: UserRole[] = ['super_admin', 'ceo'];

/** Returns true if the user is super_admin or ceo. */
export function isAdmin(user: User | null): boolean {
  if (!user) return false;
  return ADMIN_ROLES.includes(user.role);
}

/** Returns true only for the super_admin role. */
export function isSuperAdmin(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin';
}

// ---------------------------------------------------------------------------
// Activity logging
// ---------------------------------------------------------------------------

interface LogActivityParams {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Inserts a row into the activity_log table.
 * Failures are silently ignored so they never break the main flow.
 */
export async function logActivity(
  supabase: TypedClient,
  params: LogActivityParams
): Promise<void> {
  const { userId, action, entityType, entityId, metadata } = params;

  await supabase.from('activity_log').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ?? {},
  } as never);
}
