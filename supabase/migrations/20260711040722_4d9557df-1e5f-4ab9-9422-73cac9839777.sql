
-- Enums
CREATE TYPE public.app_role AS ENUM ('worker', 'employer_admin', 'clinic_staff', 'super_admin');
CREATE TYPE public.language_code AS ENUM ('ar','en','hi','ur','ne','tl','bn');
CREATE TYPE public.subscription_tier AS ENUM ('pilot','standard','enterprise');
CREATE TYPE public.appointment_status AS ENUM ('booked','completed','no_show','cancelled');
CREATE TYPE public.document_type AS ENUM ('prescription','lab_report','visit_summary','insurance_form','other');
CREATE TYPE public.chat_role AS ENUM ('user','assistant');
CREATE TYPE public.notification_type AS ENUM ('appointment_reminder','medication_reminder','health_advisory','general');
CREATE TYPE public.notification_channel AS ENUM ('push','sms','whatsapp','in_app');

CREATE TABLE public.employers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  industry text,
  contact_email text,
  subscription_tier public.subscription_tier NOT NULL DEFAULT 'pilot',
  worker_count integer NOT NULL DEFAULT 0,
  invite_code text UNIQUE NOT NULL DEFAULT substring(md5(random()::text) from 1 for 8),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employers TO authenticated;
GRANT ALL ON public.employers TO service_role;
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  lat double precision,
  lng double precision,
  departments text[] NOT NULL DEFAULT '{}',
  languages_supported_onsite text[] NOT NULL DEFAULT '{}',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone_number text UNIQUE,
  email text,
  preferred_language public.language_code NOT NULL DEFAULT 'en',
  employer_id uuid REFERENCES public.employers(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  emergency_contact text,
  notification_prefs jsonb NOT NULL DEFAULT '{"push":true,"sms":true,"whatsapp":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  employer_id uuid REFERENCES public.employers(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_employer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT employer_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'employer_admin' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'clinic_staff' LIMIT 1;
$$;

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE RESTRICT,
  department text NOT NULL,
  symptom_category text,
  worker_notes text,
  ai_context_summary text,
  scheduled_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'booked',
  visit_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.appointments(worker_id);
CREATE INDEX ON public.appointments(clinic_id);
CREATE INDEX ON public.appointments(scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.clinic_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  department text NOT NULL,
  slot_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  booked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.clinic_slots(clinic_id, slot_at);
GRANT SELECT ON public.clinic_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clinic_slots TO authenticated;
GRANT ALL ON public.clinic_slots TO service_role;
ALTER TABLE public.clinic_slots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  type public.document_type NOT NULL DEFAULT 'other',
  original_file_url text,
  original_text text,
  original_language_detected text,
  ai_summary_json jsonb,
  ai_plain_language_summary text,
  flagged_for_human_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.documents(worker_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.chat_role NOT NULL,
  content text NOT NULL,
  attached_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  flagged_for_human_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.chat_messages(worker_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  employer_id uuid REFERENCES public.employers(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  title text,
  content text NOT NULL,
  read_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications(worker_id, sent_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone_number, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.phone,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'preferred_language','')::public.language_code, 'en')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles employer read" ON public.profiles FOR SELECT TO authenticated USING (employer_id IS NOT NULL AND employer_id = public.current_employer_id());
CREATE POLICY "profiles clinic read appt patients" ON public.profiles FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'clinic_staff') AND EXISTS (
    SELECT 1 FROM public.appointments a WHERE a.worker_id = profiles.id AND a.clinic_id = public.current_clinic_id()
  )
);

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "employers admin read" ON public.employers FOR SELECT TO authenticated USING (id = public.current_employer_id());
CREATE POLICY "employers admin update" ON public.employers FOR UPDATE TO authenticated USING (id = public.current_employer_id());
CREATE POLICY "employers worker read own" ON public.employers FOR SELECT TO authenticated USING (
  id IN (SELECT employer_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "clinics public read" ON public.clinics FOR SELECT USING (true);
CREATE POLICY "clinics staff update" ON public.clinics FOR UPDATE TO authenticated USING (id = public.current_clinic_id());

CREATE POLICY "appt worker manage own" ON public.appointments FOR ALL TO authenticated
  USING (worker_id = auth.uid()) WITH CHECK (worker_id = auth.uid());
CREATE POLICY "appt clinic read own" ON public.appointments FOR SELECT TO authenticated
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "appt clinic update own" ON public.appointments FOR UPDATE TO authenticated
  USING (clinic_id = public.current_clinic_id());
CREATE POLICY "appt employer read workers" ON public.appointments FOR SELECT TO authenticated
  USING (worker_id IN (SELECT id FROM public.profiles WHERE employer_id = public.current_employer_id()));

CREATE POLICY "slots public read" ON public.clinic_slots FOR SELECT USING (true);
CREATE POLICY "slots clinic manage" ON public.clinic_slots FOR ALL TO authenticated
  USING (clinic_id = public.current_clinic_id()) WITH CHECK (clinic_id = public.current_clinic_id());

CREATE POLICY "docs worker manage own" ON public.documents FOR ALL TO authenticated
  USING (worker_id = auth.uid()) WITH CHECK (worker_id = auth.uid());
CREATE POLICY "docs clinic read appt patients" ON public.documents FOR SELECT TO authenticated
  USING (appointment_id IN (SELECT id FROM public.appointments WHERE clinic_id = public.current_clinic_id()));

CREATE POLICY "chat worker manage own" ON public.chat_messages FOR ALL TO authenticated
  USING (worker_id = auth.uid()) WITH CHECK (worker_id = auth.uid());

CREATE POLICY "notif worker read own" ON public.notifications FOR SELECT TO authenticated
  USING (worker_id = auth.uid());
CREATE POLICY "notif worker update own" ON public.notifications FOR UPDATE TO authenticated
  USING (worker_id = auth.uid());
CREATE POLICY "notif employer manage own" ON public.notifications FOR ALL TO authenticated
  USING (employer_id = public.current_employer_id()) WITH CHECK (employer_id = public.current_employer_id());
CREATE POLICY "notif employer broadcast workers read" ON public.notifications FOR SELECT TO authenticated
  USING (employer_id IN (SELECT employer_id FROM public.profiles WHERE id = auth.uid()) AND worker_id IS NULL);

INSERT INTO public.clinics (name, address, lat, lng, departments, languages_supported_onsite, phone) VALUES
  ('Al Wakra Community Clinic', 'Al Wakra, Qatar', 25.1650, 51.6034, ARRAY['general','dental','dermatology','routine_checkup','injury'], ARRAY['ar','en','hi','ur'], '+974 4000 1000'),
  ('Doha Industrial Health Center', 'Industrial Area St 15, Doha', 25.2048, 51.5326, ARRAY['general','injury','routine_checkup','dermatology'], ARRAY['ar','en','hi','ne','bn'], '+974 4000 2000'),
  ('Lusail Family Clinic', 'Lusail Boulevard, Lusail', 25.4293, 51.4917, ARRAY['general','dental','pediatrics','routine_checkup'], ARRAY['ar','en','tl','ur'], '+974 4000 3000');
