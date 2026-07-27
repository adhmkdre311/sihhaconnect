CREATE POLICY "docs clinic insert appt patients"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.worker_has_appointment_at_clinic(worker_id));

CREATE POLICY "notif clinic insert appt patients"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (worker_id IS NOT NULL AND public.worker_has_appointment_at_clinic(worker_id));
