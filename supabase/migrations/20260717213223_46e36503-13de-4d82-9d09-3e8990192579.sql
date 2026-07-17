
CREATE TABLE IF NOT EXISTS public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  company_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.role_requests TO authenticated;
GRANT ALL ON public.role_requests TO service_role;

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role requests"
  ON public.role_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all role requests"
  ON public.role_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update role requests"
  ON public.role_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_role_requests_updated_at
  BEFORE UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.request_privileged_role(
  _role text,
  _clinic_id uuid,
  _company_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _role NOT IN ('clinic_staff','employer_admin') THEN
    RAISE EXCEPTION 'invalid role for request: %', _role;
  END IF;
  IF _role = 'clinic_staff' AND _clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id required for clinic_staff';
  END IF;
  IF _role = 'employer_admin' AND (_company_name IS NULL OR length(trim(_company_name)) = 0) THEN
    RAISE EXCEPTION 'company_name required for employer_admin';
  END IF;

  INSERT INTO public.role_requests (user_id, role, clinic_id, company_name)
  VALUES (v_uid, _role::public.app_role, _clinic_id, nullif(trim(_company_name), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_privileged_role(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_privileged_role(text, uuid, text) TO authenticated;
