// M6: configurable compliance rule (checkup cadence) read for employer portals.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_MONTHS = 12;

export const getComplianceRule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_settings").select("value").eq("key", "compliance_checkup_months").maybeSingle();
    const raw = data?.value;
    const months = typeof raw === "number" ? raw : Number(raw);
    return { checkupMonths: Number.isFinite(months) && months >= 1 && months <= 60 ? Math.round(months) : DEFAULT_MONTHS };
  });
