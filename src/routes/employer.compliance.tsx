import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/employer/compliance")({ component: Compliance });

function Compliance() {
  const { t } = useLang();
  const { user } = useAuth();
  const [data, setData] = useState({ total: 0, enrolled: 0, annualCheckup: 0, noShow: 0, completed: 0 });
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: role } = await supabase.from("user_roles").select("employer_id").eq("user_id", user.id).eq("role","employer_admin").maybeSingle();
      const empId = role?.employer_id; if (!empId) return;
      const { data: emp } = await supabase.from("employers").select("worker_count").eq("id", empId).single();
      const { data: ws } = await supabase.from("profiles").select("id").eq("employer_id", empId);
      const total = emp?.worker_count ?? ws?.length ?? 0;
      const enrolled = ws?.length ?? 0;
      const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      const { data: appts } = await supabase.from("appointments")
        .select("worker_id, department, status, scheduled_at")
        .gte("scheduled_at", yearAgo.toISOString());
      const checkups = new Set((appts ?? []).filter(a => a.department === "routine_checkup").map(a => a.worker_id));
      const completed = (appts ?? []).filter(a => a.status === "completed").length;
      const noShow = (appts ?? []).filter(a => a.status === "no_show").length;
      setData({ total, enrolled, annualCheckup: checkups.size, noShow, completed });
    })();
  }, [user]);

  const pct = (a: number, b: number) => (b ? Math.round((a/b)*100) : 0);
  return (
    <AdminShell>
      <h1 className="mb-4 text-xl font-semibold">{t("compliance")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label={`${t("enrolled")}`} pct={pct(data.enrolled, data.total)} note={`${data.enrolled} / ${data.total}`} />
        <Row label="Annual checkup completed" pct={pct(data.annualCheckup, data.total)} note={`${data.annualCheckup} / ${data.total}`} />
        <Row label={t("completion_rate")} pct={pct(data.completed, data.completed + data.noShow)} note={`${data.completed} / ${data.completed + data.noShow}`} />
        <Row label={t("no_show_rate")} pct={pct(data.noShow, data.completed + data.noShow)} note={`${data.noShow} / ${data.completed + data.noShow}`} />
      </div>
    </AdminShell>
  );
}

function Row({ label, pct, note }: { label: string; pct: number; note: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mb-2 text-2xl font-semibold">{pct}%</div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
