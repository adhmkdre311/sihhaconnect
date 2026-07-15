
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 12-month document retention (PDPPL data-minimization, Backend brief §3.4)
CREATE OR REPLACE FUNCTION public.purge_old_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.documents
  WHERE created_at < now() - interval '12 months';
END;
$$;

-- Schedule daily at 03:00 UTC
SELECT cron.unschedule('purge-old-documents') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-old-documents'
);
SELECT cron.schedule(
  'purge-old-documents',
  '0 3 * * *',
  $$SELECT public.purge_old_documents();$$
);
