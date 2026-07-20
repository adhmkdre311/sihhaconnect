
ALTER TABLE public.role_requests
  ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurer_id uuid REFERENCES public.insurers(id) ON DELETE SET NULL;
