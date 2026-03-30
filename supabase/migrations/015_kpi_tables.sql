-- =============================================================================
-- Migration 015: KPI Tracking & Gamification Tables
-- Creates kpi_definitions, kpi_tracking, kpi_submissions + RLS + indexes
-- Extends bonus_events event_type CHECK to include 'kpi_weekly'
-- Attaches handle_updated_at() triggers for auto-updating updated_at
-- =============================================================================

-- ─── KPI_DEFINITIONS ────────────────────────────────────────────────────────
CREATE TABLE public.kpi_definitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  data_type     text NOT NULL CHECK (data_type IN ('number', 'boolean', 'percentage')),
  target_value  numeric NOT NULL DEFAULT 1,
  max_points    integer NOT NULL CHECK (max_points > 0),
  assigned_to   uuid NOT NULL REFERENCES public.users(id),
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by    uuid NOT NULL REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read KPI definitions
CREATE POLICY "kpi_definitions_select" ON public.kpi_definitions
  FOR SELECT TO authenticated USING (true);

-- Only admins can create/update/delete
CREATE POLICY "kpi_definitions_insert" ON public.kpi_definitions
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('super_admin', 'ceo'));

CREATE POLICY "kpi_definitions_update" ON public.kpi_definitions
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('super_admin', 'ceo'))
  WITH CHECK (get_user_role() IN ('super_admin', 'ceo'));

CREATE POLICY "kpi_definitions_delete" ON public.kpi_definitions
  FOR DELETE TO authenticated
  USING (get_user_role() IN ('super_admin', 'ceo'));

-- ─── KPI_TRACKING ───────────────────────────────────────────────────────────
CREATE TABLE public.kpi_tracking (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id),
  kpi_id      uuid NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  value       numeric,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, kpi_id, week_start)
);

ALTER TABLE public.kpi_tracking ENABLE ROW LEVEL SECURITY;

-- Members see own rows, admins see all
CREATE POLICY "kpi_tracking_select" ON public.kpi_tracking
  FOR SELECT TO authenticated
  USING (user_id = get_user_id() OR get_user_role() IN ('super_admin', 'ceo'));

-- Members can only insert their own rows
CREATE POLICY "kpi_tracking_insert" ON public.kpi_tracking
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id());

-- Members can only update their own rows
CREATE POLICY "kpi_tracking_update" ON public.kpi_tracking
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

-- ─── KPI_SUBMISSIONS ────────────────────────────────────────────────────────
CREATE TABLE public.kpi_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id),
  week_start      date NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at    timestamptz,
  total_points    numeric,
  max_possible    numeric,
  bonus_event_id  uuid REFERENCES public.bonus_events(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.kpi_submissions ENABLE ROW LEVEL SECURITY;

-- Members see own rows, admins see all
CREATE POLICY "kpi_submissions_select" ON public.kpi_submissions
  FOR SELECT TO authenticated
  USING (user_id = get_user_id() OR get_user_role() IN ('super_admin', 'ceo'));

-- Members can only insert their own rows
CREATE POLICY "kpi_submissions_insert" ON public.kpi_submissions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = get_user_id());

-- Members can only update their own draft rows
CREATE POLICY "kpi_submissions_update" ON public.kpi_submissions
  FOR UPDATE TO authenticated
  USING (user_id = get_user_id() AND status = 'draft')
  WITH CHECK (user_id = get_user_id());

-- Admin override: admins can update any row (for corrections)
CREATE POLICY "kpi_submissions_admin_update" ON public.kpi_submissions
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('super_admin', 'ceo'))
  WITH CHECK (get_user_role() IN ('super_admin', 'ceo'));

-- ─── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX idx_kpi_definitions_assigned_to ON public.kpi_definitions(assigned_to);
CREATE INDEX idx_kpi_tracking_user_week ON public.kpi_tracking(user_id, week_start);
CREATE INDEX idx_kpi_tracking_kpi ON public.kpi_tracking(kpi_id);
CREATE INDEX idx_kpi_submissions_user_week ON public.kpi_submissions(user_id, week_start);
CREATE INDEX idx_kpi_submissions_status ON public.kpi_submissions(status);

-- ─── TRIGGERS — auto-update updated_at ──────────────────────────────────────
-- Reuses the existing handle_updated_at() function from schema.sql

CREATE TRIGGER kpi_tracking_updated_at
  BEFORE UPDATE ON public.kpi_tracking
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER kpi_submissions_updated_at
  BEFORE UPDATE ON public.kpi_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── EXTEND bonus_events event_type CHECK ───────────────────────────────────
ALTER TABLE public.bonus_events
  DROP CONSTRAINT bonus_events_event_type_check;

ALTER TABLE public.bonus_events
  ADD CONSTRAINT bonus_events_event_type_check
    CHECK (event_type IN (
      'task_completed', 'early_delivery', 'late_delivery', 'quality_bonus',
      'initiative', 'collaboration', 'streak', 'penalty', 'adjustment',
      'settlement', 'kpi_weekly'
    ));
