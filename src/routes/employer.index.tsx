import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Users, CalendarDays, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/employer/")({ component: Overview });

function Overview() {
  const { t } = useLang();
  const { user } = useAuth();
  const [stats, setStats] = useState({ workers: 0, booked: 0, completed: 0, noShow: 0, company: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: role } = await supabase.from("user_roles").select("employer_id").eq("user_id", user.id).eq("role","employer_admin").maybeSingle();
      const empId = role?.employer_id;
      if (!empId) return;
      const { data: emp } = await supabase.from("employers").select("company_name, worker_count").eq("id", empId).single();
      const { data: appts } = await supabase.from("appointments").select("status");
      const booked = appts?.filter((a) => a.status === "booked").length ?? 0;
      const completed = appts?.filter((a) => a.status === "completed").length ?? 0;
      const noShow = appts?.filter((a) => a.status === "no_show").length ?? 0;
      setStats({ workers: emp?.worker_count ?? 0, booked, completed, noShow, company: emp?.company_name ?? "" });
    })();
  }, [user]);

  return (
    <AdminShell>
      <h1 className="mb-1 text-2xl font-semibold">{stats.company || t("employer_admin")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("home")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={t("total_workers")} value={stats.workers} icon={<Users className="h-5 w-5" />} />
        <Stat label={t("booked_appointments")} value={stats.booked} icon={<CalendarDays className="h-5 w-5" />} />
        <Stat label={t("completion_rate")} value={`${stats.completed + stats.noShow ? Math.round(100 * stats.completed / (stats.completed + stats.noShow)) : 0}%`} icon={<TrendingUp className="h-5 w-5" />} />
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-2 inline-flex rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
