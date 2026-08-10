-- §9.2 integration fixture. Deterministic ids, all prefixed so teardown is exact.
-- Two employers, two clinics, two pharmacies, one insurer scoped to employer A.

insert into public.employers (id, company_name, invite_code) values
  ('11111111-0000-0000-0000-000000000001', 'ITEST Employer A', 'ITESTA'),
  ('11111111-0000-0000-0000-000000000002', 'ITEST Employer B', 'ITESTB');

insert into public.clinics (id, name, departments, languages_supported_onsite) values
  ('22222222-0000-0000-0000-000000000001', 'ITEST Clinic A', array['general'], array['en']),
  ('22222222-0000-0000-0000-000000000002', 'ITEST Clinic B', array['general'], array['en']);

insert into public.pharmacies (id, name, area) values
  ('33333333-0000-0000-0000-000000000001', 'ITEST Pharmacy A', 'Doha'),
  ('33333333-0000-0000-0000-000000000002', 'ITEST Pharmacy B', 'Al Wakrah');

insert into public.insurers (id, name) values
  ('44444444-0000-0000-0000-000000000001', 'ITEST Insurer');

insert into public.insurer_employer_scope (insurer_id, employer_id) values
  ('44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001');

-- Users. The auth trigger creates the profile row; we then attach the tenant.
insert into auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data, encrypted_password, created_at, updated_at)
select id, email, 'authenticated', 'authenticated', now(), jsonb_build_object('full_name', email, 'role', meta_role), 'x', now(), now()
from (values
  ('55555555-0000-0000-0000-000000000001'::uuid, 'itest-worker-a@example.test', 'platform_admin'),
  ('55555555-0000-0000-0000-000000000002'::uuid, 'itest-worker-b@example.test', 'worker'),
  ('55555555-0000-0000-0000-000000000003'::uuid, 'itest-clinic-a@example.test', 'clinic_staff'),
  ('55555555-0000-0000-0000-000000000004'::uuid, 'itest-employer-a@example.test', 'employer_admin'),
  ('55555555-0000-0000-0000-000000000005'::uuid, 'itest-pharmacy-a@example.test', 'pharmacy_staff'),
  ('55555555-0000-0000-0000-000000000006'::uuid, 'itest-insurer@example.test', 'insurance_staff'),
  ('55555555-0000-0000-0000-000000000007'::uuid, 'itest-admin@example.test', 'platform_admin'),
  ('55555555-0000-0000-0000-000000000008'::uuid, 'itest-pharmacy-b@example.test', 'pharmacy_staff')
) as u(id, email, meta_role);

update public.profiles set employer_id = '11111111-0000-0000-0000-000000000001', approved = true
  where id in ('55555555-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000004');
update public.profiles set employer_id = '11111111-0000-0000-0000-000000000002', approved = true
  where id = '55555555-0000-0000-0000-000000000002';
update public.profiles set clinic_id = '22222222-0000-0000-0000-000000000001', approved = true
  where id = '55555555-0000-0000-0000-000000000003';
update public.profiles set pharmacy_id = '33333333-0000-0000-0000-000000000001', approved = true
  where id = '55555555-0000-0000-0000-000000000005';
update public.profiles set pharmacy_id = '33333333-0000-0000-0000-000000000002', approved = true
  where id = '55555555-0000-0000-0000-000000000008';
update public.profiles set insurer_id = '44444444-0000-0000-0000-000000000001', approved = true
  where id = '55555555-0000-0000-0000-000000000006';
update public.profiles set approved = true where id = '55555555-0000-0000-0000-000000000007';

insert into public.user_roles (user_id, role, employer_id, clinic_id, pharmacy_id, insurer_id) values
  ('55555555-0000-0000-0000-000000000001', 'worker',          '11111111-0000-0000-0000-000000000001', null, null, null),
  ('55555555-0000-0000-0000-000000000002', 'worker',          '11111111-0000-0000-0000-000000000002', null, null, null),
  ('55555555-0000-0000-0000-000000000003', 'clinic_staff',    null, '22222222-0000-0000-0000-000000000001', null, null),
  ('55555555-0000-0000-0000-000000000004', 'employer_admin',  '11111111-0000-0000-0000-000000000001', null, null, null),
  ('55555555-0000-0000-0000-000000000005', 'pharmacy_staff',  null, null, '33333333-0000-0000-0000-000000000001', null),
  ('55555555-0000-0000-0000-000000000006', 'insurance_staff', null, null, null, '44444444-0000-0000-0000-000000000001'),
  ('55555555-0000-0000-0000-000000000007', 'platform_admin',  null, null, null, null),
  ('55555555-0000-0000-0000-000000000008', 'pharmacy_staff',  null, null, '33333333-0000-0000-0000-000000000002', null);

-- Clinic A slot used by the slot-sync check.
insert into public.clinic_slots (id, clinic_id, department, slot_at, capacity, booked, is_available) values
  ('66666666-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'general', now() + interval '2 days', 1, 0, true);

-- Appointments: worker A at clinic A (completed checkup), worker B at clinic B.
insert into public.appointments (id, worker_id, clinic_id, department, scheduled_at, status, reason) values
  ('77777777-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'general', now() - interval '10 days', 'completed', 'checkup'),
  ('77777777-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'general', now() + interval '1 day', 'booked', 'fever'),
  ('77777777-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'general', now() + interval '1 day', 'booked', 'dental');

insert into public.documents (id, worker_id, type, original_text) values
  ('88888888-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'lab_report', 'ITEST document body'),
  ('88888888-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002', 'prescription', 'ITEST prescription body');

insert into public.medication_availability (id, pharmacy_id, medication_name, in_stock) values
  ('99999999-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'ITEST Paracetamol', true),
  ('99999999-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'ITEST Amoxicillin', false);

insert into public.claims (id, claim_ref, insurer_id, employer_id, clinic_id, service_date, amount, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ITEST-CLAIM-1', '44444444-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', current_date - 5, 250, 'approved');