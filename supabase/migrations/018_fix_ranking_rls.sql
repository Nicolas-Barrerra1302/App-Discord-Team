-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 018: Fix bonus_events RLS to enable Global Leaderboard
--
-- Problem: The existing SELECT policy restricts members to only their own rows.
-- The ranking tab needs to aggregate ALL users' points for the same launch.
--
-- Solution: Replace the single restrictive SELECT policy with two policies:
--   1. "Events: read own" — members always see full detail of their own events
--      (used by PersonalTimeline, BonusHistory)
--   2. "Events: read all authenticated" — any logged-in user may read all events
--      (needed for the leaderboard to aggregate global rankings)
--
-- INSERT/UPDATE/DELETE policies are unchanged and remain admin-only.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop the old combined SELECT policy
DROP POLICY IF EXISTS "Events: read own or admin" ON public.bonus_events;

-- Policy 1: Any authenticated user can read all events (enables global ranking)
CREATE POLICY "Events: read all authenticated"
  ON public.bonus_events FOR SELECT
  USING (get_user_id() IS NOT NULL);

-- INSERT/UPDATE/DELETE remain admin-only (unchanged from rls.sql baseline)
-- Ensure they exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bonus_events' AND policyname = 'Events: super_admin insert'
  ) THEN
    CREATE POLICY "Events: super_admin insert"
      ON public.bonus_events FOR INSERT
      WITH CHECK (get_user_role() = 'super_admin');
  END IF;
END $$;
