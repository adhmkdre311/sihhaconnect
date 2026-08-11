-- Fix: audit trigger assumed every audited table has an "id" column.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_detail jsonb;
  v_record_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
    INTO v_detail
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
    WHERE n.value IS DISTINCT FROM o.value;

    IF v_detail = '{}'::jsonb THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_detail := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    v_detail := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  BEGIN
    v_record_id := COALESCE(
      (to_jsonb(NEW) ->> 'id')::uuid,
      (to_jsonb(OLD) ->> 'id')::uuid
    );
  EXCEPTION WHEN others THEN
    v_record_id := NULL;
  END;

  INSERT INTO public.audit_logs(actor_id, action, table_name, record_id, detail)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id, v_detail);

  RETURN COALESCE(NEW, OLD);
END $function$;

-- §10 demo organisations (fixed ids so demo accounts link idempotently)
INSERT INTO public.employers (id, company_name, industry, contact_email, invite_code)
VALUES ('d0000000-0000-4000-8000-000000000001', 'Al Wathba Trading & Contracting', 'Construction', 'fatima@alwathba.qa', 'WATHBA26')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clinics (id, name, address, phone, departments, languages_supported_onsite, lat, lng)
VALUES ('d0000000-0000-4000-8000-000000000002', 'Al Rayyan Clinic', 'Al Rayyan, Doha', '+97444001122',
        ARRAY['general','dental','orthopaedics'], ARRAY['en','ar','hi','ur'], 25.2919, 51.4244)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pharmacies (id, name, area, address, phone, hours, lat, lng)
VALUES ('d0000000-0000-4000-8000-000000000003', 'Al Nasr Pharmacy', 'Al Nasr', 'Al Nasr St, Doha', '+97444003344', '08:00-23:00', 25.2760, 51.5300)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.insurers (id, name)
VALUES ('d0000000-0000-4000-8000-000000000004', 'QLM Life & Medical Insurance')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.insurer_employer_scope (insurer_id, employer_id)
VALUES ('d0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;