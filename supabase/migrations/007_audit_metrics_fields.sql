-- =============================================================================
-- Migration 007: Audit Metrics — Estimation, Impact & Block Reporting
-- =============================================================================

-- 1. Estimated time (minutes)
ALTER TABLE public.tasks
  ADD COLUMN estimated_time integer;

-- 2. Impact level
ALTER TABLE public.tasks
  ADD COLUMN impact text
  CHECK (impact IN ('high', 'medium', 'low'));

-- 3. Block type (internal vs external)
ALTER TABLE public.tasks
  ADD COLUMN block_type text
  CHECK (block_type IN ('internal', 'external'));

-- 4. Block reason (free text)
ALTER TABLE public.tasks
  ADD COLUMN block_reason text;

-- Index for impact filtering/grouping
CREATE INDEX idx_tasks_impact ON public.tasks(impact);
