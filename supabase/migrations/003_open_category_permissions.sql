-- =============================================================================
-- Migration 003: Open category INSERT/DELETE to all authenticated users
-- =============================================================================

-- Drop the admin-only policies
DROP POLICY IF EXISTS "Categories: admin insert" ON public.task_categories;
DROP POLICY IF EXISTS "Categories: admin delete" ON public.task_categories;

-- Create new policies allowing any authenticated user
CREATE POLICY "Categories: insert authenticated"
  ON public.task_categories FOR INSERT
  WITH CHECK (get_user_id() IS NOT NULL);

CREATE POLICY "Categories: delete authenticated"
  ON public.task_categories FOR DELETE
  USING (get_user_id() IS NOT NULL);
