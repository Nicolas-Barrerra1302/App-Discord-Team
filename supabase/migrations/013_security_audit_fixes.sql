-- =============================================================================
-- Migration 013: Security Audit Fixes
-- Fecha: 2026-03-27
-- Cierra 5 vulnerabilidades detectadas en auditoría RLS
-- =============================================================================

-- =============================================================================
-- VULN-2: Tasks INSERT — member no puede asignar tareas a otros via PostgREST
-- Cambia OR por AND para forzar que members solo creen tareas asignadas a sí mismos
-- =============================================================================

DROP POLICY IF EXISTS "Tasks: insert own or admin" ON public.tasks;
CREATE POLICY "Tasks: insert own or admin"
  ON public.tasks FOR INSERT
  WITH CHECK (
    (assigned_to = get_user_id() AND created_by = get_user_id())
    OR get_user_role() IN ('super_admin', 'ceo')
  );

-- =============================================================================
-- VULN-3: Users UPDATE — CEO no puede escalar su rol a super_admin
-- Split: super_admin tiene UPDATE completo, CEO puede actualizar pero no cambiar role
-- =============================================================================

DROP POLICY IF EXISTS "Users: admin update" ON public.users;

-- super_admin: puede actualizar cualquier campo de cualquier usuario
CREATE POLICY "Users: super_admin update"
  ON public.users FOR UPDATE
  USING (get_user_role() = 'super_admin');

-- ceo: puede actualizar usuarios, pero el campo role debe permanecer igual
-- La subquery lee el role actual de la fila — si difiere, WITH CHECK falla
CREATE POLICY "Users: ceo update non-role"
  ON public.users FOR UPDATE
  USING (get_user_role() = 'ceo')
  WITH CHECK (
    role = (SELECT u.role FROM public.users u WHERE u.id = id)
  );

-- =============================================================================
-- VULN-4: Absences — permitir member self-service (crear/borrar propias ausencias)
-- =============================================================================

DROP POLICY IF EXISTS "Absences: admin insert" ON public.user_absences;
CREATE POLICY "Absences: insert own or admin"
  ON public.user_absences FOR INSERT
  WITH CHECK (
    user_id = get_user_id()
    OR get_user_role() IN ('super_admin', 'ceo')
  );

DROP POLICY IF EXISTS "Absences: admin delete" ON public.user_absences;
CREATE POLICY "Absences: delete own or admin"
  ON public.user_absences FOR DELETE
  USING (
    user_id = get_user_id()
    OR get_user_role() IN ('super_admin', 'ceo')
  );

-- =============================================================================
-- VULN-5: daily_checkins SELECT — remover rol 'admin' inexistente
-- =============================================================================

DROP POLICY IF EXISTS "Users can read own checkins" ON public.daily_checkins;
CREATE POLICY "Users can read own checkins"
  ON public.daily_checkins FOR SELECT
  USING (
    user_id = get_user_id()
    OR get_user_role() IN ('super_admin', 'ceo')
  );

-- =============================================================================
-- Recargar schema de PostgREST
-- =============================================================================
NOTIFY pgrst, 'reload schema';
