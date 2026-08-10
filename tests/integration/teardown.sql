-- Exact inverse of seed.sql. Safe to run repeatedly.
delete from public.claims where claim_ref like 'ITEST-%';
delete from public.medication_availability where medication_name like 'ITEST %';
delete from public.documents where worker_id in (select id from auth.users where email like 'itest-%@example.test');
delete from public.appointments where worker_id in (select id from auth.users where email like 'itest-%@example.test');
delete from public.clinic_slots where clinic_id in ('22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002');
delete from public.notifications where worker_id in (select id from auth.users where email like 'itest-%@example.test');
delete from public.audit_logs where actor_id in (select id from auth.users where email like 'itest-%@example.test');
delete from public.user_roles where user_id in (select id from auth.users where email like 'itest-%@example.test');
delete from public.role_requests where user_id in (select id from auth.users where email like 'itest-%@example.test');
delete from public.profiles where id in (select id from auth.users where email like 'itest-%@example.test');
delete from auth.users where email like 'itest-%@example.test';
delete from public.insurer_employer_scope where insurer_id = '44444444-0000-0000-0000-000000000001';
delete from public.insurers where id = '44444444-0000-0000-0000-000000000001';
delete from public.pharmacies where name like 'ITEST %';
delete from public.clinics where name like 'ITEST %';
delete from public.employers where company_name like 'ITEST %';