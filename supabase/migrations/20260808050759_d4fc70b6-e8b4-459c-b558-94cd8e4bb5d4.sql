-- M1: employer invite links
CREATE TABLE public.employer_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employer_id uuid NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employer_invites TO authenticated;
GRANT ALL ON public.employer_invites TO service_role;

ALTER TABLE public.employer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites employer manage own" ON public.employer_invites
  FOR ALL TO authenticated
  USING (employer_id = public.current_employer_id())
  WITH CHECK (employer_id = public.current_employer_id());

CREATE POLICY "invites admin read all" ON public.employer_invites
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE INDEX employer_invites_employer_idx ON public.employer_invites (employer_id);

CREATE TRIGGER trg_employer_invites_updated
  BEFORE UPDATE ON public.employer_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anon-safe invite validation used by the worker sign-up screen.
CREATE OR REPLACE FUNCTION public.validate_invite(_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(coalesce(_code, '')));
BEGIN
  IF v_code = '' THEN
    RAISE EXCEPTION 'invalid invite code';
  END IF;

  IF EXISTS (SELECT 1 FROM public.employers e WHERE upper(e.invite_code) = v_code) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employer_invites i
    WHERE upper(i.code) = v_code
      AND i.revoked = false
      AND i.expires_at > now()
      AND (i.max_uses IS NULL OR i.uses < i.max_uses)
  ) THEN
    RETURN true;
  END IF;

  RAISE EXCEPTION 'invalid invite code';
END $$;

REVOKE ALL ON FUNCTION public.validate_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invite(text) TO anon, authenticated, service_role;

-- M5: clinic staff may create walk-in appointments at their own clinic
CREATE POLICY "appt clinic insert walkin" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.current_clinic_id()
    AND public.has_clinic_perm('can_view_queue')
  );

-- M3: clinic staff may read patient document files in storage
CREATE POLICY "docs bucket read clinic patients" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND public.worker_has_appointment_at_clinic(((storage.foldername(name))[1])::uuid)
    AND (public.has_clinic_perm('can_view_queue') OR public.has_clinic_perm('can_add_documents'))
  );

-- M6: configurable checkup interval
INSERT INTO public.platform_settings (key, value)
VALUES ('compliance_checkup_months', '12'::jsonb)
ON CONFLICT (key) DO NOTHING;