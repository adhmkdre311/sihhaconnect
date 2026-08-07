// Server-only helpers for staff.functions.ts. Kept out of the *.functions.ts
// module so server-fn splitting cannot strip them (tss-serverfn-split).
export async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).in("role", ["platform_admin", "super_admin"]).maybeSingle();
  if (!data) throw new Error("Not authorised");
}
