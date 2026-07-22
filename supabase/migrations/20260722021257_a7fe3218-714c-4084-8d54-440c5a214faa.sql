-- 1. profiles: is_active + push_token
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_token text;

-- 2. RLS helper functions (SECURITY DEFINER, stable, search_path=public)
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.my_employer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT employer_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_clinic_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_pharmacy_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_insurance_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT insurer_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'platform_admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.profile_in_my_employer(_profile uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.id = _profile
      AND p.employer_id IS NOT NULL
      AND p.employer_id = public.my_employer_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.worker_has_appointment_at_clinic(_worker uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.appointments a
    WHERE a.worker_id = _worker
      AND a.clinic_id = public.my_clinic_id()
  )
$$;

-- 3. Broadcast RPC: employer admins fan out to their workers; platform admin can target any audience.
CREATE OR REPLACE FUNCTION public.send_broadcast(
  _title text,
  _body text,
  _category text DEFAULT 'advisory',
  _audience text DEFAULT 'employer_workers'  -- 'employer_workers' | 'all_workers' | 'all_staff'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role public.app_role := public.my_role();
  v_emp uuid := public.my_employer_id();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _title IS NULL OR length(trim(_title)) = 0 THEN RAISE EXCEPTION 'title required'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'body required'; END IF;

  IF v_role = 'employer_admin' THEN
    IF v_emp IS NULL THEN RAISE EXCEPTION 'no employer linked'; END IF;
    INSERT INTO public.notifications (user_id, title, body, category)
    SELECT p.id, _title, _body, _category
    FROM public.profiles p
    WHERE p.employer_id = v_emp AND p.is_active = true;
    GET DIAGNOSTICS v_count = ROW_COUNT;

  ELSIF v_role = 'platform_admin' THEN
    IF _audience = 'all_workers' THEN
      INSERT INTO public.notifications (user_id, title, body, category)
      SELECT ur.user_id, _title, _body, _category
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'worker' AND p.is_active = true;
    ELSIF _audience = 'all_staff' THEN
      INSERT INTO public.notifications (user_id, title, body, category)
      SELECT ur.user_id, _title, _body, _category
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role <> 'worker' AND p.is_active = true;
    ELSE
      RAISE EXCEPTION 'invalid audience: %', _audience;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'not authorized to broadcast';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_broadcast(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_broadcast(text, text, text, text) TO authenticated;