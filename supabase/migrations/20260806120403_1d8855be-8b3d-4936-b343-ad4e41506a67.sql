CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_detail jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
    INTO v_detail
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value;

    IF v_detail = '{}'::jsonb THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_detail := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    v_detail := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, detail)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), v_detail);

  RETURN COALESCE(NEW, OLD);
END $function$;

DROP TRIGGER IF EXISTS trg_audit_medication_availability ON public.medication_availability;
CREATE TRIGGER trg_audit_medication_availability
AFTER INSERT OR UPDATE OR DELETE ON public.medication_availability
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP VIEW IF EXISTS public.insurer_employer_aggregates;