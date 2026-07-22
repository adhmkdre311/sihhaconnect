DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.my_role()',
    'public.my_employer_id()',
    'public.my_clinic_id()',
    'public.my_pharmacy_id()',
    'public.my_insurance_company_id()',
    'public.is_admin()',
    'public.profile_in_my_employer(uuid)',
    'public.worker_has_appointment_at_clinic(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;