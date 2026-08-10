-- §9.2 — the 15-check database suite, reproduced for CI.
--
-- Usage (local Supabase or any branch DB, with a privileged connection):
--   psql "$INTEGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/integration/rls-suite.sql
--
-- The whole script runs inside ONE transaction that is ROLLED BACK at the end,
-- so it seeds, asserts and leaves the database exactly as it was. Each check
-- assumes a role with set_config('role', ...) + a forged request.jwt.claims so
-- RLS is evaluated exactly as it is for a real signed-in user.
--
-- Any failed assertion raises, ON_ERROR_STOP aborts, psql exits non-zero.

\set ON_ERROR_STOP on
\timing off

begin;

create function pg_temp.assert(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

create function pg_temp.assert_eq(got anyelement, want anyelement, label text) returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL: % (got %, want %)', label, got, want;
  end if;
  raise notice 'ok  %', label;
end $$;

-- Become a signed-in user for the statements that follow (RLS applies).
create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- fixture ----
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
-- ----------------------------------------------------------------- checks ----

\echo '--- 01 insurer reads raw appointments -> 0 rows'
do $$
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000006');
  perform pg_temp.assert_eq((select count(*) from public.appointments)::int, 0,
    'insurer sees no raw appointments');
  perform pg_temp.as_owner();
end $$;

\echo '--- 02 insurer_network_overview: own groups only, correct math'
do $$
declare
  v_rows int; v_foreign int; v_total int; v_checkups int; v_view_total int; v_view_checkups int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000006');
  select count(*), count(*) filter (where employer_id <> '11111111-0000-0000-0000-000000000001')
    into v_rows, v_foreign from public.insurer_network_overview;
  perform pg_temp.assert(v_rows > 0, 'insurer sees its own aggregate rows');
  perform pg_temp.assert_eq(v_foreign, 0, 'insurer sees no out-of-scope employers');
  select appointments_total, checkups_completed into v_view_total, v_view_checkups
    from public.insurer_network_overview where employer_id = '11111111-0000-0000-0000-000000000001';
  perform pg_temp.as_owner();
  select count(*), count(*) filter (where a.status = 'completed' and a.reason = 'checkup')
    into v_total, v_checkups
    from public.appointments a
    join public.profiles p on p.id = a.worker_id
   where p.employer_id = '11111111-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(v_view_total::int, v_total::int, 'aggregate appointment total matches raw data');
  perform pg_temp.assert_eq(v_view_checkups::int, v_checkups::int, 'aggregate checkup count matches raw data');
end $$;

\echo '--- 03 worker reads availability directory; write -> refused'
do $$
declare v_seen int; v_written int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000001');
  select count(*) into v_seen from public.medication_availability;
  perform pg_temp.assert(v_seen > 0, 'worker can read the medication availability directory');
  begin
    with upd as (
      update public.medication_availability set in_stock = not in_stock
       where id = '99999999-0000-0000-0000-000000000002' returning 1
    ) select count(*) into v_written from upd;
    perform pg_temp.assert_eq(v_written, 0, 'worker write to availability affects no rows');
  exception when insufficient_privilege then
    perform pg_temp.assert(true, 'worker write to availability refused by policy');
  end;
  perform pg_temp.as_owner();
end $$;

\echo '--- 04 workers see only their own appointments'
do $$
declare v_mine int; v_other int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000001');
  select count(*) filter (where worker_id = '55555555-0000-0000-0000-000000000001'),
         count(*) filter (where worker_id <> '55555555-0000-0000-0000-000000000001')
    into v_mine, v_other from public.appointments;
  perform pg_temp.assert(v_mine > 0, 'worker sees own appointments');
  perform pg_temp.assert_eq(v_other, 0, 'worker sees nobody else''s appointments');
  perform pg_temp.as_owner();
end $$;

\echo '--- 05 worker cannot read another worker''s profile'
do $$
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000001');
  perform pg_temp.assert_eq(
    (select count(*) from public.profiles where id = '55555555-0000-0000-0000-000000000002')::int, 0,
    'worker cannot read a foreign profile');
  perform pg_temp.assert_eq(
    (select count(*) from public.profiles where id = '55555555-0000-0000-0000-000000000001')::int, 1,
    'worker can read own profile');
  perform pg_temp.as_owner();
end $$;

\echo '--- 06 self role escalation refused / reverted by trigger'
do $$
declare v_role_rows int; v_employer uuid; v_approved boolean;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000001');
  begin
    insert into public.user_roles (user_id, role)
      values ('55555555-0000-0000-0000-000000000001', 'platform_admin');
  exception when insufficient_privilege then null;
  end;
  update public.profiles set approved = true, employer_id = null
    where id = '55555555-0000-0000-0000-000000000001';
  perform pg_temp.as_owner();
  select count(*) into v_role_rows from public.user_roles
   where user_id = '55555555-0000-0000-0000-000000000001' and role = 'platform_admin';
  perform pg_temp.assert_eq(v_role_rows, 0, 'self-granted platform_admin row never lands');
  select employer_id into v_employer from public.profiles where id = '55555555-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(v_employer, '11111111-0000-0000-0000-000000000001'::uuid,
    'trigger reverted self-service employer_id change');
end $$;

\echo '--- 07 pharmacy staff: own listing updatable, other pharmacy not'
do $$
declare v_own int; v_foreign int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000005');
  with upd as (
    update public.medication_availability set in_stock = false
     where pharmacy_id = '33333333-0000-0000-0000-000000000001' returning 1
  ) select count(*) into v_own from upd;
  perform pg_temp.assert(v_own > 0, 'pharmacy staff can update their own listing');
  begin
    with upd as (
      update public.medication_availability set in_stock = true
       where id = '99999999-0000-0000-0000-000000000002' returning 1
    ) select count(*) into v_foreign from upd;
    perform pg_temp.assert_eq(v_foreign, 0, 'pharmacy staff cannot update another pharmacy''s listing');
  exception when insufficient_privilege then
    perform pg_temp.assert(true, 'foreign pharmacy write refused by policy');
  end;
  perform pg_temp.as_owner();
end $$;

\echo '--- 08 clinic: own queue only + visiting patient profile readable'
do $$
declare v_mine int; v_other int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000003');
  select count(*) filter (where clinic_id = '22222222-0000-0000-0000-000000000001'),
         count(*) filter (where clinic_id <> '22222222-0000-0000-0000-000000000001')
    into v_mine, v_other from public.appointments;
  perform pg_temp.assert(v_mine > 0, 'clinic staff see their own queue');
  perform pg_temp.assert_eq(v_other, 0, 'clinic staff see no other clinic''s appointments');
  perform pg_temp.assert_eq(
    (select count(*) from public.profiles where id = '55555555-0000-0000-0000-000000000001')::int, 1,
    'clinic staff can read a visiting patient profile');
  perform pg_temp.assert_eq(
    (select count(*) from public.profiles where id = '55555555-0000-0000-0000-000000000002')::int, 0,
    'clinic staff cannot read a non-visiting worker profile');
  perform pg_temp.as_owner();
end $$;

\echo '--- 09 employer admin: own org profiles only'
do $$
declare v_foreign int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000004');
  select count(*) into v_foreign from public.profiles
   where id <> auth.uid()
     and coalesce(employer_id, '00000000-0000-0000-0000-000000000000')
         <> '11111111-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(v_foreign, 0, 'employer admin sees only its own org profiles');
  perform pg_temp.assert(
    (select count(*) from public.profiles
      where employer_id = '11111111-0000-0000-0000-000000000001') > 0,
    'employer admin sees its own workers');
  perform pg_temp.as_owner();
end $$;

\echo '--- 10 admin: full access, audit logs populated'
do $$
declare v_appts int; v_docs int; v_profiles int; v_audit int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000007');
  select count(*) into v_appts from public.appointments;
  select count(*) into v_docs from public.documents;
  select count(*) into v_profiles from public.profiles;
  perform pg_temp.assert(v_appts >= 3, 'admin reads every appointment');
  perform pg_temp.assert(v_docs >= 2, 'admin reads every document');
  perform pg_temp.assert(v_profiles >= 8, 'admin reads every profile');
  update public.profiles set full_name = 'ITEST admin audited'
   where id = '55555555-0000-0000-0000-000000000001';
  select count(*) into v_audit from public.audit_logs
   where table_name = 'profiles' and action = 'UPDATE'
     and record_id = '55555555-0000-0000-0000-000000000001';
  perform pg_temp.assert(v_audit > 0, 'admin write produced an audit entry');
  perform pg_temp.as_owner();
end $$;

\echo '--- 11 employer admin cannot escalate a worker role'
do $$
declare v_rows int;
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000004');
  begin
    insert into public.user_roles (user_id, role, employer_id)
      values ('55555555-0000-0000-0000-000000000001', 'employer_admin',
              '11111111-0000-0000-0000-000000000001');
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.as_owner();
  select count(*) into v_rows from public.user_roles
   where user_id = '55555555-0000-0000-0000-000000000001' and role = 'employer_admin';
  perform pg_temp.assert_eq(v_rows, 0, 'employer admin cannot grant employer_admin to a worker');
end $$;

\echo '--- 12 insurer reads raw documents -> 0 rows'
do $$
begin
  perform pg_temp.as_user('55555555-0000-0000-0000-000000000006');
  perform pg_temp.assert_eq((select count(*) from public.documents)::int, 0,
    'insurer sees no raw documents');
  perform pg_temp.as_owner();
end $$;

\echo '--- 13 signup with privileged metadata -> role forced to worker'
do $$
declare v_meta text; v_privileged int; v_worker int;
begin
  -- itest-worker-a signed up claiming raw_user_meta_data.role = platform_admin.
  select raw_user_meta_data->>'role' into v_meta from auth.users
   where id = '55555555-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(v_meta, 'platform_admin', 'fixture user claimed a privileged role at signup');
  select count(*) filter (where role <> 'worker'), count(*) filter (where role = 'worker')
    into v_privileged, v_worker
    from public.user_roles where user_id = '55555555-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(v_privileged, 0, 'signup metadata granted no privileged role');
  perform pg_temp.assert_eq(v_worker, 1, 'signup landed on the worker role');
end $$;

\echo '--- 14 audit UPDATE entries contain old->new diffs'
do $$
declare v_detail jsonb; v_keys text[];
begin
  update public.profiles set full_name = 'ITEST diff check'
   where id = '55555555-0000-0000-0000-000000000002';
  select detail into v_detail from public.audit_logs
   where table_name = 'profiles' and action = 'UPDATE'
     and record_id = '55555555-0000-0000-0000-000000000002'
   order by created_at desc limit 1;
  perform pg_temp.assert(v_detail is not null, 'update produced an audit row');
  perform pg_temp.assert_eq(v_detail #>> '{full_name,new}', 'ITEST diff check',
    'audit detail records the new value');
  perform pg_temp.assert(v_detail #>> '{full_name,old}' is distinct from 'ITEST diff check',
    'audit detail records the old value');
  select array_agg(k order by k) into v_keys
    from jsonb_object_keys(v_detail) k where k <> 'updated_at';
  perform pg_temp.assert_eq(v_keys, array['full_name'],
    'audit detail contains only changed fields (BUG-1)');
end $$;

\echo '--- 15 slot sync: book -> unavailable; cancel -> available'
do $$
declare v_avail boolean; v_booked int;
begin
  insert into public.appointments (worker_id, clinic_id, department, scheduled_at, status, slot_id)
    values ('55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
            'general', now() + interval '2 days', 'booked', '66666666-0000-0000-0000-000000000001');
  select is_available, booked into v_avail, v_booked from public.clinic_slots
   where id = '66666666-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(v_avail, false, 'booking marks the slot unavailable');
  perform pg_temp.assert_eq(v_booked, 1, 'booking increments the booked counter');

  update public.appointments set status = 'cancelled'
   where slot_id = '66666666-0000-0000-0000-000000000001';
  select is_available, booked into v_avail, v_booked from public.clinic_slots
   where id = '66666666-0000-0000-0000-000000000001';
  perform pg_temp.assert_eq(v_avail, true, 'cancelling frees the slot');
  perform pg_temp.assert_eq(v_booked, 0, 'cancelling decrements the booked counter');
end $$;

\echo '--- bonus: anonymous callers see nothing'
do $$
begin
  perform pg_temp.as_anon();
  perform pg_temp.assert_eq((select count(*) from public.appointments)::int, 0,
    'anonymous caller sees no appointments');
  perform pg_temp.as_owner();
exception when insufficient_privilege then
  perform pg_temp.as_owner();
  perform pg_temp.assert(true, 'anonymous caller has no grant on appointments');
end $$;

\echo '=== all 15 checks passed ==='

rollback;
