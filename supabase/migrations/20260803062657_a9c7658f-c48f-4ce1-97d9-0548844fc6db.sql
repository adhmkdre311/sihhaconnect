
CREATE TABLE IF NOT EXISTS public.medication_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  in_stock boolean NOT NULL DEFAULT true,
  last_updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS medication_availability_pharmacy_name_key
  ON public.medication_availability (pharmacy_id, lower(medication_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_availability TO authenticated;
GRANT ALL ON public.medication_availability TO service_role;

ALTER TABLE public.medication_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read availability"
  ON public.medication_availability FOR SELECT TO authenticated USING (true);

CREATE POLICY "Pharmacy staff insert own availability"
  ON public.medication_availability FOR INSERT TO authenticated
  WITH CHECK (
    pharmacy_id IN (SELECT ur.pharmacy_id FROM public.user_roles ur
                    WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacy_staff')
    OR public.is_admin()
  );

CREATE POLICY "Pharmacy staff update own availability"
  ON public.medication_availability FOR UPDATE TO authenticated
  USING (
    pharmacy_id IN (SELECT ur.pharmacy_id FROM public.user_roles ur
                    WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacy_staff')
    OR public.is_admin()
  )
  WITH CHECK (
    pharmacy_id IN (SELECT ur.pharmacy_id FROM public.user_roles ur
                    WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacy_staff')
    OR public.is_admin()
  );

CREATE POLICY "Pharmacy staff delete own availability"
  ON public.medication_availability FOR DELETE TO authenticated
  USING (
    pharmacy_id IN (SELECT ur.pharmacy_id FROM public.user_roles ur
                    WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacy_staff')
    OR public.is_admin()
  );

CREATE TRIGGER medication_availability_updated_at
  BEFORE UPDATE ON public.medication_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.availability_lookup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  medication_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS availability_lookup_events_pharmacy_created_idx
  ON public.availability_lookup_events (pharmacy_id, created_at DESC);

GRANT SELECT, INSERT ON public.availability_lookup_events TO authenticated;
GRANT ALL ON public.availability_lookup_events TO service_role;

ALTER TABLE public.availability_lookup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can log a lookup"
  ON public.availability_lookup_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Pharmacy staff read own lookups"
  ON public.availability_lookup_events FOR SELECT TO authenticated
  USING (
    pharmacy_id IN (SELECT ur.pharmacy_id FROM public.user_roles ur
                    WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacy_staff')
    OR public.is_admin()
  );

CREATE POLICY "Pharmacy staff update own pharmacy"
  ON public.pharmacies FOR UPDATE TO authenticated
  USING (
    id IN (SELECT ur.pharmacy_id FROM public.user_roles ur
           WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacy_staff')
    OR public.is_admin()
  )
  WITH CHECK (
    id IN (SELECT ur.pharmacy_id FROM public.user_roles ur
           WHERE ur.user_id = auth.uid() AND ur.role = 'pharmacy_staff')
    OR public.is_admin()
  );
