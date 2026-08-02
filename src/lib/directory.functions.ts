import { createServerFn } from "@tanstack/react-start";

// Public, unauthenticated clinic directory: names only (no phone/address).
export const listClinicDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("clinics").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
});
