-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 017: Gamification Ledger Support
-- Adds metadata JSONB column to bonus_events for scoring engine audit trail.
-- Extends event_type CHECK to include daily_close + missed_daily_close.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add metadata JSONB column (nullable, default null)
ALTER TABLE public.bonus_events
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN public.bonus_events.metadata IS
  'JSONB scoring audit trail: cotCalculationLog, appliedModifiers, task context';

-- 2. Extend event_type CHECK constraint to include gamification events
ALTER TABLE public.bonus_events
  DROP CONSTRAINT bonus_events_event_type_check;

ALTER TABLE public.bonus_events
  ADD CONSTRAINT bonus_events_event_type_check
    CHECK (event_type IN (
      'task_completed', 'early_delivery', 'late_delivery', 'quality_bonus',
      'initiative', 'collaboration', 'streak', 'penalty', 'adjustment',
      'settlement', 'kpi_weekly',
      'daily_close', 'missed_daily_close'
    ));

-- 3. Index for ghost close idempotency: fast lookup by user + event_type + date
CREATE INDEX IF NOT EXISTS idx_bonus_events_user_type_created
  ON public.bonus_events (user_id, event_type, created_at DESC);
