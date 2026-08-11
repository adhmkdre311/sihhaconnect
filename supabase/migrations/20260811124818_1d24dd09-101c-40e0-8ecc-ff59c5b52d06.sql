DROP POLICY IF EXISTS insurers_public_directory ON public.insurers;
REVOKE SELECT ON public.insurers FROM anon;