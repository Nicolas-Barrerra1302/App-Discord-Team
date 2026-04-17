-- ============================================================================
-- Migration 024 — Exclude CEO from bonus rankings and distribution
-- ============================================================================
-- Business rule (2026-04-17): the CEO (Discord ID 1337429420683563070,
-- role='ceo') no longer participates in the bonus pool nor appears in the
-- global ranking. The CEO continues to accumulate points normally via daily
-- tasks, KPI submissions and daily-close gamification; those bonus_events
-- rows are preserved as audit trail.
--
-- Strategy: non-destructive VIEW that materializes the "bonus eligible user"
-- concept. Application layer reads this view instead of `users` when building
-- the ranking or the distribution UI. Defense-in-depth: filter both by
-- `role != 'ceo'` AND by the known CEO discord_id, so a role-field mutation
-- alone cannot re-introduce the CEO into the pool.
--
-- Reversibility: `DROP VIEW public.bonus_eligible_users CASCADE;` restores
-- previous behavior without data loss.
-- ============================================================================

-- 1. View of users eligible for bonus ranking and distribution
CREATE OR REPLACE VIEW public.bonus_eligible_users AS
SELECT
  id,
  discord_id,
  name,
  avatar_url,
  role,
  area,
  is_active,
  created_at
FROM public.users
WHERE is_active = true
  AND role <> 'ceo'
  AND discord_id <> '1337429420683563070';

COMMENT ON VIEW public.bonus_eligible_users IS
  'Active users eligible for bonus ranking and distribution. Excludes the CEO '
  '(discord_id 1337429420683563070, role=ceo) per business rule dated 2026-04-17. '
  'The CEO keeps earning points in bonus_events for audit purposes; they are '
  'simply filtered out at aggregation time. To opt a user back in, update the '
  'users table (role / discord_id) accordingly.';

-- 2. Grant access identical to the underlying users table
GRANT SELECT ON public.bonus_eligible_users TO authenticated;
GRANT SELECT ON public.bonus_eligible_users TO anon;
GRANT SELECT ON public.bonus_eligible_users TO service_role;

-- 3. Optional helper function for SQL-level aggregations (e.g. RPC)
--    Uses SECURITY INVOKER to honor the caller's RLS context.
CREATE OR REPLACE FUNCTION public.is_bonus_eligible(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bonus_eligible_users WHERE id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_bonus_eligible(uuid) IS
  'True when the given user_id participates in bonus ranking/distribution. '
  'Mirrors the bonus_eligible_users VIEW. Safe to use in SELECT projections '
  'and future RPCs.';

-- 4. (Optional but recommended) Light-weight partial index to speed up
--    role-based filtering on the users table. Skipped if already present.
CREATE INDEX IF NOT EXISTS idx_users_role_bonus_eligible
  ON public.users (id)
  WHERE is_active = true AND role <> 'ceo';

-- ============================================================================
-- Verification (run manually, NOT part of migration):
--   SELECT COUNT(*) FROM public.bonus_eligible_users;          -- expect 5
--   SELECT COUNT(*) FROM public.users WHERE is_active = true;  -- expect 6
--   SELECT name, role FROM public.bonus_eligible_users;        -- no 'ceo' row
-- ============================================================================
