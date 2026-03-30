-- =============================================================================
-- Migration 016 — KPI Direction Column
--
-- Adds the `direction` column to kpi_definitions so admins can configure
-- "Lower is better" KPIs (e.g., error count, response time, incidents).
--
-- direction = 'asc'  (default) → higher value is better
-- direction = 'desc'           → lower value is better
-- =============================================================================

ALTER TABLE public.kpi_definitions
  ADD COLUMN direction text NOT NULL DEFAULT 'asc'
  CHECK (direction IN ('asc', 'desc'));

-- Update schema comment
COMMENT ON COLUMN public.kpi_definitions.direction IS
  'Scoring direction: asc = higher is better, desc = lower is better';
