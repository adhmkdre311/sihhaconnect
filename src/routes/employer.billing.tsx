import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/employer/billing")({ component: Billing });

function Billing() {
  const { t } = useLang();
  const { user } = useAuth();
  const [info, setInfo] = useState<{tier:string; seats:number; company:string}>({tier:"pilot", seats:0, company:""});
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: role } = await supabase.from("user_roles").select("employer_id").eq("user_id", user.id).eq("role","employer_admin").maybeSingle();
      if (!role?.employer_id) return;
      const { data: emp } = await supabase.from("employers").select("company_name, subscription_tier, worker_count").eq("id", role.employer_id).single();
      if (emp) setInfo({ tier: emp.subscription_tier, seats: emp.worker_count, company: emp.company_name });
    })();
  }, [user]);

  const price = info.tier === "pilot" ? 0 : info.tier === "standard" ? 3 : 5;
  const monthly = price * info.seats;

  return (
    <AdminShell>
      <h1 className="mb-4 text-xl font-semibold">{t("billing")}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs text-muted-foreground">Plan</div>
          <div className="text-2xl font-semibold capitalize">{info.tier}</div>
          <div className="mt-2 text-sm text-muted-foreground">Seats: {info.seats}</div>
          <div className="mt-1 text-sm">Estimated: <span className="font-semibold">${monthly}/mo</span> at ${price}/seat</div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="text-xs text-muted-foreground">Invoices</div>
          <p className="mt-2 text-sm text-muted-foreground">No invoices yet — pilot period.</p>
        </div>
      </div>
    </AdminShell>
  );
}
