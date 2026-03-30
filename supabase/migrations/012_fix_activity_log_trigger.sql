-- Migration 012: NULL-safe activity log trigger
-- Fixes 500 error caused by NULL concatenation in previous trigger version

CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id     uuid;
  v_old_status  text;
  v_new_status  text;
  v_action      text;
  v_reason      text;
  v_impact      text;
BEGIN
  -- Use assigned_to (public.users UUID), never auth.uid() (auth.users UUID)
  v_user_id := NEW.assigned_to;

  -- === Status change ===
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Map to Spanish using CASE (NULL-safe, no jsonb ->> concatenation)
    v_old_status := CASE OLD.status
      WHEN 'pending'     THEN 'Pendiente'
      WHEN 'in_progress' THEN 'En progreso'
      WHEN 'completed'   THEN 'Completada'
      WHEN 'blocked'     THEN 'Bloqueada'
      ELSE COALESCE(OLD.status, 'Desconocido')
    END;

    v_new_status := CASE NEW.status
      WHEN 'pending'     THEN 'Pendiente'
      WHEN 'in_progress' THEN 'En progreso'
      WHEN 'completed'   THEN 'Completada'
      WHEN 'blocked'     THEN 'Bloqueada'
      ELSE COALESCE(NEW.status, 'Desconocido')
    END;

    -- Build action string (all parts guaranteed non-NULL)
    v_action := 'Cambió el estado de ' || v_old_status || ' a ' || v_new_status;

    -- Capture block_reason only when moving to blocked
    v_reason := NULL;
    IF NEW.status = 'blocked' AND NEW.block_reason IS NOT NULL AND NEW.block_reason <> '' THEN
      v_reason := NEW.block_reason;
    END IF;

    -- Impact badge
    v_impact := CASE
      WHEN NEW.status = 'completed' THEN '+5 pts'
      WHEN NEW.status = 'blocked'   THEN '-1 racha'
      ELSE NULL
    END;

    INSERT INTO public.activity_log (
      user_id, action, entity_type, entity_id, target_name, impact, reason
    ) VALUES (
      v_user_id,
      v_action,
      'task',
      NEW.id,
      NEW.title,
      v_impact,
      v_reason
    );
  END IF;

  -- === Due date change ===
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    v_reason := CASE
      WHEN OLD.due_date IS NOT NULL AND NEW.due_date IS NOT NULL THEN
        'De ' || to_char(OLD.due_date, 'DD Mon') || ' a ' || to_char(NEW.due_date, 'DD Mon')
      WHEN OLD.due_date IS NULL AND NEW.due_date IS NOT NULL THEN
        'Asignó fecha: ' || to_char(NEW.due_date, 'DD Mon')
      WHEN OLD.due_date IS NOT NULL AND NEW.due_date IS NULL THEN
        'Eliminó la fecha de entrega'
      ELSE NULL
    END;

    INSERT INTO public.activity_log (
      user_id, action, entity_type, entity_id, target_name, reason
    ) VALUES (
      v_user_id,
      'Cambió la fecha de entrega',
      'task',
      NEW.id,
      NEW.title,
      v_reason
    );
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
