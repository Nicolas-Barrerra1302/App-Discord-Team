-- =============================================================================
-- Migration 009: daily_checkins — Cierre de Día manual
-- Feature: Accountability cualitativo con métricas auto-calculadas
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  checkin_date  date        NOT NULL DEFAULT CURRENT_DATE,
  hours_worked  numeric     NOT NULL,
  fires_handled integer     NOT NULL,
  blocks_count  integer     NOT NULL,
  summary       text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_checkin_date UNIQUE (user_id, checkin_date)
);

-- Index for fast lookups by user + date
CREATE INDEX idx_daily_checkins_user_date ON public.daily_checkins (user_id, checkin_date DESC);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

-- Members can read their own check-ins
CREATE POLICY "Users can read own checkins"
  ON public.daily_checkins FOR SELECT
  USING (
    user_id = get_user_id()
    OR get_user_role() IN ('admin', 'super_admin', 'ceo')
  );

-- Members can insert their own check-ins
CREATE POLICY "Users can insert own checkins"
  ON public.daily_checkins FOR INSERT
  WITH CHECK (
    user_id = get_user_id()
  );
