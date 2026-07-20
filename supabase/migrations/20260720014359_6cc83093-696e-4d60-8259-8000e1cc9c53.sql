
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pharmacy_id uuid,
  ADD COLUMN IF NOT EXISTS insurer_id uuid;

UPDATE public.profiles p SET approved = true
WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'worker');

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS pharmacy_id uuid,
  ADD COLUMN IF NOT EXISTS insurer_id uuid;

CREATE OR REPLACE FUNCTION public.is_approved(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE id = _uid), false);
$$;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.autoapprove_worker()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.role = 'worker' THEN
    UPDATE public.profiles SET approved = true WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_autoapprove_worker ON public.user_roles;
CREATE TRIGGER trg_autoapprove_worker
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.autoapprove_worker();

CREATE TABLE IF NOT EXISTS public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, area text, address text, phone text,
  lat double precision, lng double precision, hours text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pharmacies TO authenticated;
GRANT ALL ON public.pharmacies TO service_role;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pharmacies_read_auth" ON public.pharmacies FOR SELECT TO authenticated USING (true);
CREATE POLICY "pharmacies_admin_write" ON public.pharmacies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_pharm_updated BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, generic_name text, form text, strength text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meds_read_auth" ON public.medications FOR SELECT TO authenticated USING (true);
CREATE POLICY "meds_admin_write" ON public.medications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.pharmacy_stock (
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  in_stock boolean NOT NULL DEFAULT false,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pharmacy_id, medication_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_stock TO authenticated;
GRANT ALL ON public.pharmacy_stock TO service_role;
ALTER TABLE public.pharmacy_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_read_auth" ON public.pharmacy_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_pharm_staff_write" ON public.pharmacy_stock FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='pharmacy_staff'
      AND r.pharmacy_id=pharmacy_stock.pharmacy_id AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(),'platform_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='pharmacy_staff'
      AND r.pharmacy_id=pharmacy_stock.pharmacy_id AND public.is_approved(auth.uid()))
    OR public.has_role(auth.uid(),'platform_admin')
  );

CREATE TABLE IF NOT EXISTS public.pharmacy_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid REFERENCES public.medications(id) ON DELETE SET NULL,
  pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  area text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT, SELECT ON public.pharmacy_lookups TO authenticated;
GRANT ALL ON public.pharmacy_lookups TO service_role;
ALTER TABLE public.pharmacy_lookups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lookups_insert_auth" ON public.pharmacy_lookups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lookups_read_pharm_or_admin" ON public.pharmacy_lookups FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'platform_admin')
  OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='pharmacy_staff'
    AND r.pharmacy_id=pharmacy_lookups.pharmacy_id)
);

CREATE TABLE IF NOT EXISTS public.insurers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insurers TO authenticated;
GRANT ALL ON public.insurers TO service_role;
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurers_read_auth" ON public.insurers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insurers_admin_write" ON public.insurers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

CREATE TABLE IF NOT EXISTS public.insurer_employer_scope (
  insurer_id uuid NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  PRIMARY KEY (insurer_id, employer_id)
);
GRANT SELECT ON public.insurer_employer_scope TO authenticated;
GRANT ALL ON public.insurer_employer_scope TO service_role;
ALTER TABLE public.insurer_employer_scope ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ies_read_insurer_or_admin" ON public.insurer_employer_scope FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'platform_admin')
  OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role='insurance_staff'
    AND r.insurer_id=insurer_employer_scope.insurer_id)
);
CREATE POLICY "ies_admin_write" ON public.insurer_employer_scope FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- Aggregated view (join appointments through profiles.employer_id).
CREATE OR REPLACE VIEW public.insurer_employer_aggregates
WITH (security_invoker = true) AS
SELECT
  ies.insurer_id,
  e.id AS employer_id,
  e.company_name,
  COALESCE(e.worker_count, 0) AS workers_enrolled,
  (SELECT count(*) FROM public.appointments a
     JOIN public.profiles p ON p.id=a.worker_id
     WHERE p.employer_id=e.id AND a.status='completed') AS checkups_completed,
  (SELECT count(*) FROM public.appointments a
     JOIN public.profiles p ON p.id=a.worker_id
     WHERE p.employer_id=e.id AND a.status='no_show') AS no_shows,
  (SELECT count(*) FROM public.appointments a
     JOIN public.profiles p ON p.id=a.worker_id
     WHERE p.employer_id=e.id) AS appointments_total
FROM public.insurer_employer_scope ies
JOIN public.employers e ON e.id=ies.employer_id;
GRANT SELECT ON public.insurer_employer_aggregates TO authenticated;
