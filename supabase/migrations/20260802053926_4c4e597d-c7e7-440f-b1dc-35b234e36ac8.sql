-- 1. clinic_slots: remove anonymous read
DROP POLICY IF EXISTS "slots public read" ON public.clinic_slots;
CREATE POLICY "slots authenticated read" ON public.clinic_slots FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.clinic_slots FROM anon;

-- 2. clinics: remove anonymous read of full row, expose name-only directory view
DROP POLICY IF EXISTS "clinics public read" ON public.clinics;
CREATE POLICY "clinics authenticated read" ON public.clinics FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.clinics FROM anon;

CREATE OR REPLACE VIEW public.clinic_directory
WITH (security_invoker = off) AS
  SELECT id, name FROM public.clinics;
GRANT SELECT ON public.clinic_directory TO anon, authenticated;

-- 3. user_roles: explicitly write-protected
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
REVOKE SELECT ON public.user_roles FROM anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 4. SECURITY DEFINER functions: revoke direct execute where not needed
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.autoapprove_worker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_slot_availability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_old_documents() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.can_manage_clinic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_clinic(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.has_clinic_perm(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_clinic_perm(text) TO authenticated;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.request_privileged_role(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_privileged_role(text, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.send_broadcast(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_broadcast(text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.current_clinic_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO authenticated;
REVOKE ALL ON FUNCTION public.current_employer_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_employer_id() TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;