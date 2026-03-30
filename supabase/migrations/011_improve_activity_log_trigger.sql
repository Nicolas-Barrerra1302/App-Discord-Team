-- Migration 011: Improve activity log trigger
-- - Status change now shows "Cambió el estado de [Old] a [New]"
-- - Blocked status captures block_reason in activity_log.reason column

CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_status_labels jsonb := '{
    "pending": "Pendiente",
    "in_progress": "En progreso",
    "completed": "Completada",
    "blocked": "Bloqueada"
  }'::jsonb;
  v_old_label text;
  v_new_label text;
  v_reason text;
BEGIN
  v_user_id := COALESCE(auth.uid(), NEW.assigned_to);

  -- Log status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_old_label := COALESCE(v_status_labels ->> OLD.status, OLD.status);
    v_new_label := COALESCE(v_status_labels ->> NEW.status, NEW.status);

    -- Capture block_reason when moving to blocked
    v_reason := NULL;
    IF NEW.status = 'blocked' AND NEW.block_reason IS NOT NULL AND NEW.block_reason <> '' THEN
      v_reason := NEW.block_reason;
    END IF;

    INSERT INTO public.activity_log (
      user_id, action, entity_type, entity_id, target_name, impact, reason
    ) VALUES (
      v_user_id,
      'Cambió el estado de ' || v_old_label || ' a ' || v_new_label,
      'task',
      NEW.id,
      NEW.title,
      CASE
        WHEN NEW.status = 'completed' THEN '+5 pts'
        WHEN NEW.status = 'blocked'   THEN '-1 racha'
        ELSE NULL
      END,
      v_reason
    );
  END IF;

  -- Log due_date change
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.activity_log (
      user_id, action, entity_type, entity_id, target_name, reason
    ) VALUES (
      v_user_id,
      'Cambió la fecha de entrega',
      'task',
      NEW.id,
      NEW.title,
      CASE
        WHEN OLD.due_date IS NOT NULL AND NEW.due_date IS NOT NULL THEN
          'De ' || to_char(OLD.due_date, 'DD Mon') || ' a ' || to_char(NEW.due_date, 'DD Mon')
        WHEN OLD.due_date IS NULL THEN
          'Asignó fecha: ' || to_char(NEW.due_date, 'DD Mon')
        ELSE
          'Eliminó la fecha de entrega'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 006, this just replaces the function body
-- No need to recreate the trigger since it references the same function name

NOTIFY pgrst, 'reload schema';
