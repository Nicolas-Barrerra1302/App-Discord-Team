-- Migration 023: Add 'other' event type to bonus_events CHECK constraint
-- Allows manual registration of "Opción Abierta" events via the Registrar tab.

ALTER TABLE public.bonus_events
  DROP CONSTRAINT IF EXISTS bonus_events_event_type_check;

ALTER TABLE public.bonus_events
  ADD CONSTRAINT bonus_events_event_type_check
    CHECK (event_type IN (
      'task_completed', 'early_delivery', 'late_delivery', 'quality_bonus',
      'initiative', 'collaboration', 'streak', 'penalty', 'adjustment',
      'settlement', 'kpi_weekly',
      'daily_close', 'missed_daily_close',
      'other'
    ));
