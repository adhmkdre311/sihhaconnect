GRANT SELECT ON public.pharmacies TO anon;
GRANT SELECT ON public.insurers TO anon;
CREATE POLICY "pharmacies_public_directory" ON public.pharmacies FOR SELECT TO anon USING (true);
CREATE POLICY "insurers_public_directory" ON public.insurers FOR SELECT TO anon USING (true);