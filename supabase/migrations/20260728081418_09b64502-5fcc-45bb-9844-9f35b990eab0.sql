
-- 1) Permissions table
CREATE TABLE public.clinic_staff_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  can_view_queue boolean NOT NULL DEFAULT true,
  can_edit_slots boolean NOT NULL DEFAULT false,
  can_add_documents boolean NOT NULL DEFAULT false,
  can_manage_staff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, clinic_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_staff_permissions TO authenticated;
GRANT ALL ON public.clinic_staff_permissions TO service_role;
ALTER TABLE public.clinic_staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_csp_updated
BEFORE UPDATE ON public.clinic_staff_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: does the current user hold a clinic permission at their clinic?
CREATE OR REPLACE FUNCTION public.has_clinic_perm(_perm text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE v boolean;
BEGIN
  EXECUTE format(
    'SELECT COALESCE((SELECT %I FROM public.clinic_staff_permissions WHERE user_id = auth.uid() AND clinic_id = public.current_clinic_id()), false)',
    _perm
  ) INTO v;
  RETURN v;
END $$;

-- Does the current user manage staff at a specific clinic?
CREATE OR REPLACE FUNCTION public.can_manage_clinic(_clinic uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_staff_permissions
    WHERE user_id = auth.uid() AND clinic_id = _clinic AND can_manage_staff = true
  )
$$;

-- RLS: staff can read own permission row + manager can read/write rows in their clinic
CREATE POLICY "csp read own" ON public.clinic_staff_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "csp manager read clinic" ON public.clinic_staff_permissions
  FOR SELECT TO authenticated USING (public.can_manage_clinic(clinic_id));
CREATE POLICY "csp manager write clinic" ON public.clinic_staff_permissions
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- 2) Invites table
CREATE TABLE public.clinic_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  can_view_queue boolean NOT NULL DEFAULT true,
  can_edit_slots boolean NOT NULL DEFAULT false,
  can_add_documents boolean NOT NULL DEFAULT false,
  can_manage_staff boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.clinic_invites (clinic_id, status);
CREATE INDEX ON public.clinic_invites (lower(email), status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_invites TO authenticated;
GRANT ALL ON public.clinic_invites TO service_role;
ALTER TABLE public.clinic_invites ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_clinic_invites_updated
BEFORE UPDATE ON public.clinic_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "invite manager read" ON public.clinic_invites
  FOR SELECT TO authenticated USING (public.can_manage_clinic(clinic_id));
CREATE POLICY "invite manager write" ON public.clinic_invites
  FOR ALL TO authenticated
  USING (public.can_manage_clinic(clinic_id))
  WITH CHECK (public.can_manage_clinic(clinic_id));

-- 3) Backfill: existing clinic_staff get full permissions on their assigned clinic
INSERT INTO public.clinic_staff_permissions (user_id, clinic_id, can_view_queue, can_edit_slots, can_add_documents, can_manage_staff)
SELECT ur.user_id, ur.clinic_id, true, true, true, true
FROM public.user_roles ur
WHERE ur.role = 'clinic_staff' AND ur.clinic_id IS NOT NULL
ON CONFLICT (user_id, clinic_id) DO NOTHING;

-- 4) Tighten existing clinic-side policies to require the matching permission
DROP POLICY IF EXISTS "appt clinic read own" ON public.appointments;
CREATE POLICY "appt clinic read own" ON public.appointments
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.has_clinic_perm('can_view_queue'));

DROP POLICY IF EXISTS "appt clinic update own" ON public.appointments;
CREATE POLICY "appt clinic update own" ON public.appointments
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.has_clinic_perm('can_view_queue'))
  WITH CHECK (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS "slots clinic manage" ON public.clinic_slots;
CREATE POLICY "slots clinic read own" ON public.clinic_slots
  FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "slots clinic write own" ON public.clinic_slots
  FOR INSERT TO authenticated
  WITH CHECK (clinic_id = public.current_clinic_id() AND public.has_clinic_perm('can_edit_slots'));
CREATE POLICY "slots clinic update own" ON public.clinic_slots
  FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.has_clinic_perm('can_edit_slots'))
  WITH CHECK (clinic_id = public.current_clinic_id());
CREATE POLICY "slots clinic delete own" ON public.clinic_slots
  FOR DELETE TO authenticated
  USING (clinic_id = public.current_clinic_id() AND public.has_clinic_perm('can_edit_slots'));

DROP POLICY IF EXISTS "docs clinic insert appt patients" ON public.documents;
CREATE POLICY "docs clinic insert appt patients" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.worker_has_appointment_at_clinic(worker_id) AND public.has_clinic_perm('can_add_documents'));

DROP POLICY IF EXISTS "notif clinic insert appt patients" ON public.notifications;
CREATE POLICY "notif clinic insert appt patients" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (worker_id IS NOT NULL AND public.worker_has_appointment_at_clinic(worker_id)
              AND (public.has_clinic_perm('can_add_documents') OR public.has_clinic_perm('can_view_queue')));
