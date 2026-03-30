-- =============================================================================
-- Migration 021: Hito 5 Security & Performance Audit Fixes
-- Date: 2026-03-28
-- Scope: kpi_definitions, kpi_tracking, kpi_submissions, daily_checkins,
--        bonus_events
-- Covers:
--   Section 1 — 4 missing B-Tree indexes
--   Section 2 — 4 RLS policy fixes (privilege escalation + frozen-state bypass)
--   Section 3 — 3 FK ON DELETE corrections (orphan prevention)
-- Zero DROP TABLE. Zero destructive data mutations. Additive changes only.
-- =============================================================================


-- =============================================================================
-- SECTION 1: MISSING B-TREE INDEXES
-- =============================================================================

-- kpi_submissions.week_start
-- Problem: idx_kpi_submissions_user_week(user_id, week_start) is a compound
-- index; when the admin week-navigation queries filter ONLY on week_start
-- (all members for a given week) without a leading user_id, PostgreSQL cannot
-- use the compound index and falls back to a sequential scan.
CREATE INDEX IF NOT EXISTS idx_kpi_submissions_week_start
  ON public.kpi_submissions(week_start);

-- kpi_tracking.week_start
-- Problem: identical compound-index gap as above; idx_kpi_tracking_user_week
-- covers (user_id, week_start) but not a standalone week_start predicate
-- (admin table: "show all members' values for week W").
CREATE INDEX IF NOT EXISTS idx_kpi_tracking_week_start
  ON public.kpi_tracking(week_start);

-- bonus_events.event_type
-- Problem: idx_bonus_events_user_type_created(user_id, event_type, created_at)
-- cannot serve queries that aggregate or filter by event_type alone — e.g., an
-- admin audit counting daily_close vs missed_daily_close across all users.
-- The existing compound index requires user_id as the leading column.
CREATE INDEX IF NOT EXISTS idx_bonus_events_event_type
  ON public.bonus_events(event_type);

-- daily_checkins.checkin_date
-- Problem: idx_daily_checkins_user_date(user_id, checkin_date DESC) requires
-- user_id as the leading column. The admin 30-day window query filters
-- .gte("checkin_date", thirtyDaysAgo) across ALL users — no user_id prefix —
-- triggering a sequential scan on the full table.
CREATE INDEX IF NOT EXISTS idx_daily_checkins_date
  ON public.daily_checkins(checkin_date);


-- =============================================================================
-- SECTION 2: RLS POLICY HARDENING
-- =============================================================================

-- ─── FIX A: kpi_submissions_update — prevent direct status escalation ─────────
--
-- Vulnerability: The old WITH CHECK only enforced user_id ownership:
--   WITH CHECK (user_id = get_user_id())
-- A member hitting PostgREST directly (e.g., Supabase JS client) could call:
--   .update({ status: 'submitted' }).eq('id', their_draft_id)
-- This would bypass: (1) the server-side COT deadline check, (2) the scoring
-- engine in /api/kpis/submit, and (3) the bonus_event creation step — creating
-- a 'submitted' record with no associated points and no bonus_event_id link.
--
-- Fix: WITH CHECK now also requires NEW.status = 'draft'. Only the admin client
-- (createAdminClient() / service role key used in /api/kpis/submit) can write
-- status = 'submitted' — it bypasses RLS entirely.
-- The admin correction policy (kpi_submissions_admin_update) is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kpi_submissions_update" ON public.kpi_submissions;

CREATE POLICY "kpi_submissions_update" ON public.kpi_submissions
  FOR UPDATE TO authenticated
  USING  (user_id = get_user_id() AND status = 'draft')
  WITH CHECK (user_id = get_user_id() AND status = 'draft');


-- ─── FIX B: kpi_tracking — freeze rows for already-submitted weeks ────────────
--
-- Vulnerability (UPDATE): The old policy allowed members to UPDATE kpi_tracking
-- values for any week they own, including weeks where kpi_submissions.status is
-- already 'submitted'. Post-submission edits do not change the locked score in
-- bonus_events, but they silently corrupt the admin weekly review table which
-- reads raw kpi_tracking values to display member performance.
--
-- Vulnerability (INSERT): A member could INSERT a new kpi_tracking row for a
-- KPI that was NULL at submission time (e.g., a KPI they skipped) for a week
-- that already has status='submitted', adding retroactive values to the audit
-- trail. The UNIQUE(user_id, kpi_id, week_start) constraint prevents true
-- duplicates, but not first-time inserts into a closed week.
--
-- Fix: Both INSERT and UPDATE policies now subquery-join kpi_submissions.
-- If a 'submitted' row exists for the same user + week_start, the operation
-- is rejected at the DB level regardless of the API layer.
--
-- Note on WITH CHECK column references: In an RLS WITH CHECK expression for
-- UPDATE, unqualified column names refer to the NEW (post-update) row.
-- In USING, the table-qualified name kpi_tracking.week_start refers to the OLD
-- (pre-update) row. Both guards are needed: USING prevents selecting a frozen
-- row for mutation; WITH CHECK prevents sneaking in a changed week_start that
-- points to a frozen week.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "kpi_tracking_update" ON public.kpi_tracking;

CREATE POLICY "kpi_tracking_update" ON public.kpi_tracking
  FOR UPDATE TO authenticated
  USING (
    user_id = get_user_id()
    AND NOT EXISTS (
      SELECT 1 FROM public.kpi_submissions s
      WHERE s.user_id    = get_user_id()
        AND s.week_start = kpi_tracking.week_start   -- OLD row week
        AND s.status     = 'submitted'
    )
  )
  WITH CHECK (
    user_id = get_user_id()
    AND NOT EXISTS (
      SELECT 1 FROM public.kpi_submissions s
      WHERE s.user_id    = get_user_id()
        AND s.week_start = week_start                -- NEW row week
        AND s.status     = 'submitted'
    )
  );

DROP POLICY IF EXISTS "kpi_tracking_insert" ON public.kpi_tracking;

CREATE POLICY "kpi_tracking_insert" ON public.kpi_tracking
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = get_user_id()
    AND NOT EXISTS (
      SELECT 1 FROM public.kpi_submissions s
      WHERE s.user_id    = get_user_id()
        AND s.week_start = week_start                -- NEW row week
        AND s.status     = 'submitted'
    )
  );


-- ─── FIX C: daily_checkins — explicit admin UPDATE policy ─────────────────────
--
-- Gap: No UPDATE policy existed on daily_checkins, meaning:
--   (a) Members cannot update their own check-ins via authenticated client —
--       this is INTENTIONAL and correct (check-ins are immutable once saved).
--   (b) Admins (super_admin/ceo) also cannot UPDATE via authenticated client
--       for manual corrections — this is an operational gap.
-- Ghost close (evaluateGhostClose) uses createAdminClient() (service role) and
-- is unaffected by RLS. This policy covers the human-admin correction case only.
-- No member UPDATE policy is added — check-in immutability for members is
-- enforced by the absence of a permissive member UPDATE policy.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Checkins: admin update"
  ON public.daily_checkins FOR UPDATE
  USING    (get_user_role() IN ('super_admin', 'ceo'))
  WITH CHECK (get_user_role() IN ('super_admin', 'ceo'));


-- =============================================================================
-- SECTION 3: FK ON DELETE CORRECTIONS
-- =============================================================================

-- ─── FIX D: kpi_tracking.user_id → ON DELETE CASCADE ─────────────────────────
--
-- Bug: Default RESTRICT prevents deleting a user row if they have any
-- kpi_tracking records. This creates an asymmetry: daily_checkins already uses
-- ON DELETE CASCADE (migration 009), but kpi_tracking silently blocks
-- user deletion. Any future admin user-removal operation would fail at the DB
-- constraint without a clear error message bubbled to the UI.
-- Fix: Mirror the daily_checkins pattern — cascade-delete tracking rows when
-- their owner is removed. Tracking values without a user are meaningless.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.kpi_tracking
  DROP CONSTRAINT IF EXISTS kpi_tracking_user_id_fkey;

ALTER TABLE public.kpi_tracking
  ADD CONSTRAINT kpi_tracking_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;


-- ─── FIX E: kpi_submissions.user_id → ON DELETE CASCADE ──────────────────────
--
-- Bug: Same RESTRICT gap as Fix D — a kpi_submission row without a user is
-- meaningless (total_points, max_possible, and bonus_event_id all derive from
-- the user's identity). Cascade-delete preserves referential integrity.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.kpi_submissions
  DROP CONSTRAINT IF EXISTS kpi_submissions_user_id_fkey;

ALTER TABLE public.kpi_submissions
  ADD CONSTRAINT kpi_submissions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;


-- ─── FIX F: kpi_submissions.bonus_event_id → ON DELETE SET NULL ──────────────
--
-- Bug: Default RESTRICT on the nullable bonus_event_id FK creates an orphan-
-- lock: if a super_admin needs to delete or hard-correct a malformed bonus_event
-- (e.g., a kpi_weekly event created with the wrong points due to a scoring bug),
-- the DELETE will fail with a FK violation because the kpi_submission holds a
-- reference. The FK is nullable precisely to allow this decoupling.
--
-- Fix: SET NULL — when a bonus_event is deleted, the corresponding
-- kpi_submission.bonus_event_id is nullified. The submission record itself
-- (including its historical total_points and max_possible snapshot) is preserved
-- for audit purposes; only the live link to the event row is cleared.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.kpi_submissions
  DROP CONSTRAINT IF EXISTS kpi_submissions_bonus_event_id_fkey;

ALTER TABLE public.kpi_submissions
  ADD CONSTRAINT kpi_submissions_bonus_event_id_fkey
    FOREIGN KEY (bonus_event_id)
    REFERENCES public.bonus_events(id)
    ON DELETE SET NULL;


-- =============================================================================
-- Reload PostgREST schema cache
-- =============================================================================
NOTIFY pgrst, 'reload schema';
