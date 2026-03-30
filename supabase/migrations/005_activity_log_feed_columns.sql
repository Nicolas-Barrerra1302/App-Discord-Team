-- Migration 005: Add target_name, impact, reason columns to activity_log
-- For ActivityLogFeed timeline component

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS target_name text;

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS impact text;

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS reason text;
