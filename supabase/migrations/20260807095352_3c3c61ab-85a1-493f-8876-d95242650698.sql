-- E12: BRIN indexes for cheap time-series scans on append-only event tables
CREATE INDEX IF NOT EXISTS audit_logs_created_at_brin ON public.audit_logs USING brin (created_at);
CREATE INDEX IF NOT EXISTS availability_lookup_events_created_at_brin ON public.availability_lookup_events USING brin (created_at);
CREATE INDEX IF NOT EXISTS pharmacy_lookups_created_at_brin ON public.pharmacy_lookups USING brin (created_at);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_brin ON public.chat_messages USING brin (created_at);
CREATE INDEX IF NOT EXISTS notifications_created_at_brin ON public.notifications USING brin (created_at);
CREATE INDEX IF NOT EXISTS documents_created_at_brin ON public.documents USING brin (created_at);

-- Btree helpers for the per-user hot paths that drive the realtime views
CREATE INDEX IF NOT EXISTS notifications_worker_created_idx ON public.notifications (worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS appointments_clinic_scheduled_idx ON public.appointments (clinic_id, scheduled_at);

-- E4: Realtime for clinic queue + worker notifications (RLS still scopes delivery)
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;