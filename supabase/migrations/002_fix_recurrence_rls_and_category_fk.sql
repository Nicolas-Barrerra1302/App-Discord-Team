-- =============================================================================
-- 002 — Fix recurrence RLS (add assigned_to) + category FK cascade
-- Run in Supabase SQL Editor
-- =============================================================================

-- 0. Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.users
  WHERE discord_id = (
    SELECT raw_user_meta_data->>'provider_id'
    FROM auth.users
    WHERE id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid AS $$
  SELECT id FROM public.users
  WHERE discord_id = (
    SELECT raw_user_meta_data->>'provider_id'
    FROM auth.users
    WHERE id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1. Update RLS policies for task_recurrences
--    Add assigned_to check so members can update/delete their own recurrences

DROP POLICY IF EXISTS "Recurrences: update own or admin" ON public.task_recurrences;
CREATE POLICY "Recurrences: update own or admin"
  ON public.task_recurrences FOR UPDATE
  USING (
    assigned_to = get_user_id()
    OR created_by = get_user_id()
    OR get_user_role() IN ('super_admin', 'ceo')
  );

DROP POLICY IF EXISTS "Recurrences: delete own or admin" ON public.task_recurrences;
CREATE POLICY "Recurrences: delete own or admin"
  ON public.task_recurrences FOR DELETE
  USING (
    assigned_to = get_user_id()
    OR created_by = get_user_id()
    OR get_user_role() IN ('super_admin', 'ceo')
  );

-- 2. Fix FK constraints: category_id should SET NULL on delete
--    so deleting a category doesn't fail with a FK violation

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_category_id_fkey,
  ADD CONSTRAINT tasks_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.task_categories(id)
    ON DELETE SET NULL;

ALTER TABLE public.task_recurrences
  DROP CONSTRAINT IF EXISTS task_recurrences_category_id_fkey,
  ADD CONSTRAINT task_recurrences_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.task_categories(id)
    ON DELETE SET NULL;
