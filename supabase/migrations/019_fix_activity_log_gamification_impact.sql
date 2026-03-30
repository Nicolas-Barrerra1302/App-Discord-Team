-- Migration 019: Remove hardcoded '+5 pts' from activity_log trigger for completed tasks.
-- The gamification engine now calculates the real score AFTER the DB mutation.
-- Trigger sets impact = NULL; the API backfills the actual score post-scoring.

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

    v_action := 'Cambió el estado de ' || v_old_status || ' a ' || v_new_status;

    v_reason := NULL;
    IF NEW.status = 'blocked' AND NEW.block_reason IS NOT NULL AND NEW.block_reason <> '' THEN
      v_reason := NEW.block_reason;
    END IF;

    -- Impact badge: completed tasks get NULL here — the gamification engine
    -- backfills the real score (e.g. '+575 pts') via API after scoring runs.
    v_impact := CASE
      WHEN NEW.status = 'completed' THEN NULL
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
