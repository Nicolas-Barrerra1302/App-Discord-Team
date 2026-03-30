-- Migration 006: Auto-log task activity on status/due_date changes
-- Function + Trigger for activity_log timeline

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
BEGIN
  v_user_id := COALESCE(auth.uid(), NEW.assigned_to);

  -- Log status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (
      user_id, action, entity_type, entity_id, target_name, impact
    ) VALUES (
      v_user_id,
      'Cambio el estado a ' || COALESCE(v_status_labels ->> NEW.status, NEW.status),
      'task',
      NEW.id,
      NEW.title,
      CASE
        WHEN NEW.status = 'completed' THEN '+5 pts'
        WHEN NEW.status = 'blocked'   THEN '-1 racha'
        ELSE NULL
      END
    );
  END IF;

  -- Log due_date change
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.activity_log (
      user_id, action, entity_type, entity_id, target_name, reason
    ) VALUES (
      v_user_id,
      'Cambio la fecha de entrega',
      'task',
      NEW.id,
      NEW.title,
      CASE
        WHEN OLD.due_date IS NOT NULL AND NEW.due_date IS NOT NULL THEN
          'De ' || to_char(OLD.due_date, 'DD Mon') || ' a ' || to_char(NEW.due_date, 'DD Mon')
        WHEN OLD.due_date IS NULL THEN
          'Asigno fecha: ' || to_char(NEW.due_date, 'DD Mon')
        ELSE
          'Elimino la fecha de entrega'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_activity ON public.tasks;

CREATE TRIGGER trg_task_activity
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_activity();
