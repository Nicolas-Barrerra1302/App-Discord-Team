-- Migration 010: Add completion_pct to daily_checkins
ALTER TABLE public.daily_checkins ADD COLUMN completion_pct numeric NOT NULL DEFAULT 0;
