-- Migration 020: Add auto_closed flag to daily_checkins
-- Ghost close (evaluateGhostClose) inserts a zero-metric row with auto_closed=true
-- so admin audit sees the day as officially closed (not a zombie open day).

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS auto_closed boolean NOT NULL DEFAULT false;
