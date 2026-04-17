// src/lib/bonuses/access.ts
// Single source of truth for bonus-module access control.

import type { User } from '@/lib/types';

/**
 * Discord ID of the CEO. Informative constant used as documentation
 * and as a defense-in-depth check in the Supabase VIEW `bonus_eligible_users`.
 * Primary discriminator in code is still `user.role`.
 */
export const CEO_DISCORD_ID = '1337429420683563070';

/**
 * Returns true when the given user is allowed to see monetary projections
 * in the bonus UI (totalPool, projectedPayout, simulatedBonus).
 * Reuses the same role set as `isAdmin()` in database.ts.
 */
export function canViewBonusMoney(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin' || user.role === 'ceo';
}
