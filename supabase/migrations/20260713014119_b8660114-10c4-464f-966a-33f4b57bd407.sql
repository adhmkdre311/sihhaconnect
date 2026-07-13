
-- Consent capture
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;

-- Chat rate limiting counter
CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  worker_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.chat_rate_limits TO authenticated;
GRANT ALL ON public.chat_rate_limits TO service_role;
ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "worker sees own rate limits" ON public.chat_rate_limits
  FOR SELECT TO authenticated USING (auth.uid() = worker_id);

-- Employer compliance stats view
CREATE OR REPLACE VIEW public.employer_compliance_stats
WITH (security_invoker = true)
AS
SELECT
  e.id AS employer_id,
  COUNT(DISTINCT p.id) AS workers_enrolled,
  COUNT(a.id) FILTER (WHERE a.status = 'completed') AS checkups_completed,
  COUNT(a.id) FILTER (WHERE a.status = 'no_show') AS no_shows,
  ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.status = 'no_show')
        / NULLIF(COUNT(a.id), 0), 1) AS no_show_rate_pct
FROM public.employers e
LEFT JOIN public.profiles p ON p.employer_id = e.id
LEFT JOIN public.appointments a ON a.worker_id = p.id
GROUP BY e.id;

GRANT SELECT ON public.employer_compliance_stats TO authenticated;
