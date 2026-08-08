// M7: audit trail for platform-admin read-only impersonation.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VIEWABLE = ["clinic_staff", "employer_admin", "pharmacy_staff", "insurance_staff", "worker"] as const;

export const recordViewAs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(VIEWABLE),
    action: z.enum(["start", "stop"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "platform_admin" || r.role === "super_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.action === "start" ? "VIEW_AS_START" : "VIEW_AS_STOP",
      table_name: "user_roles",
      detail: { role: data.role, read_only: true } as never,
    });
    return { ok: true };
  });
