
-- === Roles: add pharmacy_staff, insurance_staff, platform_admin ===
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pharmacy_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'insurance_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';
