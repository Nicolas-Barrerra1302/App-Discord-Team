-- Migration 022: Add impact and estimated_time to task_recurrences
-- These fields are mandatory on normal tasks but were missing from the recurrence template.
-- Both columns are nullable for backward compatibility with existing recurrences.

ALTER TABLE task_recurrences
  ADD COLUMN IF NOT EXISTS impact VARCHAR(10)
    CHECK (impact IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS estimated_time INTEGER CHECK (estimated_time > 0);

COMMENT ON COLUMN task_recurrences.impact IS 'Expected impact of generated task instances: high, medium, or low';
COMMENT ON COLUMN task_recurrences.estimated_time IS 'Estimated time in minutes, copied to each generated task instance';
