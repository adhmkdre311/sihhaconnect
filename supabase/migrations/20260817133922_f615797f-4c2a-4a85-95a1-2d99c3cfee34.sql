CREATE TABLE public.acceptance_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ok boolean NOT NULL DEFAULT false,
  passed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  total_ms integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'local',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX acceptance_runs_created_at_idx ON public.acceptance_runs (created_at DESC);

GRANT SELECT ON public.acceptance_runs TO anon;
GRANT SELECT ON public.acceptance_runs TO authenticated;
GRANT ALL ON public.acceptance_runs TO service_role;

ALTER TABLE public.acceptance_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceptance runs are readable" ON public.acceptance_runs
  FOR SELECT TO anon, authenticated USING (true);