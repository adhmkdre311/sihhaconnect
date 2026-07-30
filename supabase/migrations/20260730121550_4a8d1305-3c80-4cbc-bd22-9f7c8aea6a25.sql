CREATE TYPE public.claim_status AS ENUM ('submitted','in_review','approved','rejected','paid');

CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_ref text NOT NULL UNIQUE,
  insurer_id uuid NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  employer_id uuid REFERENCES public.employers(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  service_date date NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'QAR',
  category text,
  status public.claim_status NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX claims_insurer_idx ON public.claims (insurer_id, service_date DESC);
CREATE INDEX claims_status_idx ON public.claims (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insurance staff view own network claims"
ON public.claims FOR SELECT TO authenticated
USING (insurer_id = public.my_insurance_company_id());

CREATE POLICY "Clinics view own submitted claims"
ON public.claims FOR SELECT TO authenticated
USING (clinic_id IS NOT NULL AND clinic_id = public.my_clinic_id());

CREATE POLICY "Admins manage all claims"
ON public.claims FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER update_claims_updated_at
BEFORE UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();