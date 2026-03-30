-- Migration: Add task_type, default_status, attachments to task_recurrences
-- Run this on remote Supabase to match the updated schema.sql

ALTER TABLE public.task_recurrences
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'planeada'
    CHECK (task_type IN ('planeada', 'incendio'));

ALTER TABLE public.task_recurrences
  ADD COLUMN IF NOT EXISTS default_status text NOT NULL DEFAULT 'pending'
    CHECK (default_status IN ('pending', 'in_progress', 'completed', 'blocked'));

ALTER TABLE public.task_recurrences
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
