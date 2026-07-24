
-- 1. Extend enums
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'booked';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'confirmed' AFTER 'booked';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'awaiting_checkin' AFTER 'confirmed';

-- 2. reason_category enum
DO $$ BEGIN
  CREATE TYPE public.reason_category AS ENUM ('fever','injury','dental','checkup','medication_review','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Appointment columns per spec
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.clinic_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason public.reason_category,
  ADD COLUMN IF NOT EXISTS context_note text,
  ADD COLUMN IF NOT EXISTS context_note_translated text;

-- 4. clinic_slots: add is_available and unique(clinic_id, slot_at)
ALTER TABLE public.clinic_slots
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  ALTER TABLE public.clinic_slots ADD CONSTRAINT clinic_slots_clinic_slot_at_key UNIQUE (clinic_id, slot_at);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- 5. sync_slot_availability trigger
CREATE OR REPLACE FUNCTION public.sync_slot_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (TG_OP='INSERT') AND NEW.slot_id IS NOT NULL THEN
    UPDATE public.clinic_slots SET is_available=false, booked=booked+1 WHERE id=NEW.slot_id;
  ELSIF (TG_OP='UPDATE') THEN
    IF NEW.status IN ('cancelled','no_show') AND OLD.status NOT IN ('cancelled','no_show') AND OLD.slot_id IS NOT NULL THEN
      UPDATE public.clinic_slots SET is_available=true, booked=GREATEST(booked-1,0) WHERE id=OLD.slot_id;
    END IF;
    IF NEW.slot_id IS DISTINCT FROM OLD.slot_id THEN
      IF OLD.slot_id IS NOT NULL THEN
        UPDATE public.clinic_slots SET is_available=true, booked=GREATEST(booked-1,0) WHERE id=OLD.slot_id;
      END IF;
      IF NEW.slot_id IS NOT NULL THEN
        UPDATE public.clinic_slots SET is_available=false, booked=booked+1 WHERE id=NEW.slot_id;
      END IF;
    END IF;
  ELSIF (TG_OP='DELETE') AND OLD.slot_id IS NOT NULL THEN
    UPDATE public.clinic_slots SET is_available=true, booked=GREATEST(booked-1,0) WHERE id=OLD.slot_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_sync_slot_availability ON public.appointments;
CREATE TRIGGER trg_sync_slot_availability
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_slot_availability();

-- 6. protect_profile_privileges trigger
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_is_emp_admin boolean := public.has_role(v_uid,'employer_admin');
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;  -- server-side unrestricted
  IF v_is_admin THEN RETURN NEW; END IF;

  -- lock privileged fields for non-admins
  NEW.approved := OLD.approved;
  NEW.employer_id := OLD.employer_id;
  NEW.clinic_id := OLD.clinic_id;
  NEW.pharmacy_id := OLD.pharmacy_id;
  NEW.insurer_id := OLD.insurer_id;

  -- is_active: only employer_admin toggling own worker
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NOT (v_is_emp_admin AND OLD.employer_id IS NOT NULL AND OLD.employer_id = public.current_employer_id()) THEN
      NEW.is_active := OLD.is_active;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- 7. announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) <= 120),
  body text NOT NULL CHECK (length(body) <= 2000),
  audience text NOT NULL CHECK (audience IN ('workers','all','employers','clinics','pharmacies')),
  employer_id uuid REFERENCES public.employers(id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann admin all" ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "ann employer manage own" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'employer_admin') AND employer_id = public.current_employer_id())
  WITH CHECK (public.has_role(auth.uid(),'employer_admin') AND employer_id = public.current_employer_id());
CREATE POLICY "ann read published" ON public.announcements FOR SELECT TO authenticated
  USING (published AND (
    audience = 'all'
    OR (audience='workers' AND public.has_role(auth.uid(),'worker') AND (employer_id IS NULL OR employer_id = public.my_employer_id()))
    OR (audience='employers' AND public.has_role(auth.uid(),'employer_admin'))
    OR (audience='clinics' AND public.has_role(auth.uid(),'clinic_staff'))
    OR (audience='pharmacies' AND public.has_role(auth.uid(),'pharmacy_staff'))
  ));
CREATE TRIGGER trg_ann_updated BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. platform_settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read auth" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.platform_settings(key,value) VALUES
  ('chat_enabled','true'::jsonb),
  ('default_language','"en"'::jsonb),
  ('supported_languages','["en","ar","hi","ur","ne","tl","bn"]'::jsonb),
  ('guardrail_version','"v1"'::jsonb),
  ('feature_medication_availability','true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 9. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit insert auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- 10. Generic audit trigger for privileged tables
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, detail)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP='UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      WHEN TG_OP='INSERT' THEN jsonb_build_object('new', to_jsonb(NEW))
      ELSE jsonb_build_object('old', to_jsonb(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_ies ON public.insurer_employer_scope;
CREATE TRIGGER trg_audit_ies AFTER INSERT OR UPDATE OR DELETE ON public.insurer_employer_scope
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 11. insurer_network_overview view
CREATE OR REPLACE VIEW public.insurer_network_overview
WITH (security_invoker=false) AS
SELECT
  ies.insurer_id AS insurance_company_id,
  e.id AS employer_id,
  e.company_name,
  (SELECT count(*) FROM public.profiles p WHERE p.employer_id = e.id AND p.is_active) AS workers_enrolled,
  (SELECT count(*) FROM public.appointments a JOIN public.profiles p ON p.id=a.worker_id
     WHERE p.employer_id=e.id AND a.status='completed') AS checkups_completed,
  (SELECT count(*) FROM public.appointments a JOIN public.profiles p ON p.id=a.worker_id
     WHERE p.employer_id=e.id) AS appointments_total,
  COALESCE((
    SELECT round(100.0 * sum(CASE WHEN a.status='no_show' THEN 1 ELSE 0 END)::numeric / NULLIF(count(*),0), 1)
    FROM public.appointments a JOIN public.profiles p ON p.id=a.worker_id
    WHERE p.employer_id=e.id
  ), 0) AS no_show_rate_pct
FROM public.insurer_employer_scope ies
JOIN public.employers e ON e.id = ies.employer_id
WHERE ies.insurer_id = public.my_insurance_company_id() OR public.is_admin();

GRANT SELECT ON public.insurer_network_overview TO authenticated;
