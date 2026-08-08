import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getComplianceRule } from "@/lib/compliance.functions";
import { UserCheck, TrendingDown, Stethoscope, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/employer/compliance")({ component: Compliance });

function Compliance() {
  const { t } = useLang();
  const { user } = useAuth();
  const loadRule = useServerFn(getComplianceRule);
  // M6: cadence comes from platform settings, not a hardcoded year.
  const [checkupMonths, setCheckupMonths] = useState(12);
  const [data, setData] = useState({ total: 0, enrolled: 0, annualCheckup: 0, noShow: 0, completed: 0 });
  const [workers, setWorkers] = useState<{ id: string; full_name: string | null; preferred_language: string; is_active: boolean; last_checkup: string | null }[]>([]);
  const [upcoming, setUpcoming] = useState(0);

  useEffect(() => {
    void loadRule().then((r) => setCheckupMonths(r.checkupMonths)).catch(() => setCheckupMonths(12));
  }, [loadRule]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: role } = await supabase.from("user_roles").select("employer_id").eq("user_id", user.id).eq("role","employer_admin").maybeSingle();
      const empId = role?.employer_id; if (!empId) return;
      const { data: emp } = await supabase.from("employers").select("worker_count").eq("id", empId).single();
      const { data: ws } = await supabase.from("profiles")
        .select("id, full_name, preferred_language, is_active")
        .eq("employer_id", empId);
      const total = emp?.worker_count ?? ws?.length ?? 0;
      const enrolled = ws?.length ?? 0;
      const windowStart = new Date();
      windowStart.setMonth(windowStart.getMonth() - checkupMonths);
      const { data: appts } = await supabase.from("appointments")
        .select("worker_id, department, status, scheduled_at")
        .gte("scheduled_at", windowStart.toISOString());
      const checkupRows = (appts ?? []).filter(a => a.department === "routine_checkup" && a.status === "completed");
      const checkups = new Set(checkupRows.map(a => a.worker_id));
      const completed = (appts ?? []).filter(a => a.status === "completed").length;
      const noShow = (appts ?? []).filter(a => a.status === "no_show").length;
      const now = new Date().toISOString();
      const upcomingCount = (appts ?? []).filter(a => a.scheduled_at > now && (a.status === "booked" || a.status === "confirmed" || a.status === "pending")).length;
      const lastByWorker = new Map<string, string>();
      for (const a of checkupRows) {
        const prev = lastByWorker.get(a.worker_id);
        if (!prev || a.scheduled_at > prev) lastByWorker.set(a.worker_id, a.scheduled_at);
      }
      setData({ total, enrolled, annualCheckup: checkups.size, noShow, completed });
      setUpcoming(upcomingCount);
      setWorkers((ws ?? []).map(w => ({
        id: w.id, full_name: w.full_name, preferred_language: w.preferred_language, is_active: w.is_active,
        last_checkup: lastByWorker.get(w.id) ?? null,
      })));
    })();
  }, [user, checkupMonths]);

  const pct = (a: number, b: number) => (b ? Math.round((a/b)*100) : 0);
  // Due date = last completed checkup + cadence; "due soon" = within 30 days.
  const dueState = (last: string | null): { label: string; tone: string; due: string | null } => {
    if (!last) return { label: "No checkup yet", tone: "bg-destructive/10 text-destructive", due: null };
    const due = new Date(last);
    due.setMonth(due.getMonth() + checkupMonths);
    const days = Math.round((due.getTime() - Date.now()) / 86_400_000);
    if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, tone: "bg-destructive/10 text-destructive", due: due.toLocaleDateString() };
    if (days <= 30) return { label: `Due in ${days}d`, tone: "bg-amber-100 text-amber-700", due: due.toLocaleDateString() };
    return { label: "Compliant", tone: "bg-primary/10 text-primary", due: due.toLocaleDateString() };
  };
  const flagged = workers.filter((w) => dueState(w.last_checkup).label !== "Compliant").length;

  return (
    <AdminShell>
      <h1 className="mb-1 font-display text-2xl font-semibold">{t("compliance")}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        The four numbers you'll be asked to defend in an audit. Rule in force: a checkup every {checkupMonths} months
        {flagged > 0 && <span className="ms-1 font-medium text-destructive">· {flagged} worker(s) flagged</span>}
      </p>

      {(() => {
        const enrollmentPct = pct(data.enrolled, data.total);
        const total = data.completed + data.noShow;
        const noShowPct = pct(data.noShow, total);
        const baselineNoShow = 32; // industry baseline pre-Sihha, per Business Strategy doc
        const delta = baselineNoShow - noShowPct;
        // QAR 500 avg fine × (checkups completed vs. workforce shortfall closed)
        const finesAvoided = data.annualCheckup * 500;
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<UserCheck className="h-5 w-5" />}
              label="Enrollment"
              value={`${enrollmentPct}%`}
              foot={`${data.enrolled} of ${data.total} workers`}
              tone="primary"
            />
            <StatCard
              icon={<TrendingDown className="h-5 w-5" />}
              label="No-show rate"
              value={`${noShowPct}%`}
              foot={delta > 0 ? `▼ ${delta} pts vs. ${baselineNoShow}% baseline` : `Baseline ${baselineNoShow}%`}
              tone={delta > 0 ? "primary" : "coral"}
            />
            <StatCard
              icon={<Stethoscope className="h-5 w-5" />}
              label="Checkups completed"
              value={`${data.annualCheckup}`}
              foot={`${pct(data.annualCheckup, data.total)}% of workforce · ${upcoming} upcoming`}
              tone="accent"
            />
            <StatCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Est. fines avoided"
              value={`QAR ${finesAvoided.toLocaleString()}`}
              foot="Based on MoPH annual-checkup rule (QAR 500/worker)"
              tone="primary"
            />
          </div>
        );
      })()}

      <h2 className="mt-8 mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label={`${t("enrolled")}`} pct={pct(data.enrolled, data.total)} note={`${data.enrolled} / ${data.total}`} />
        <Row label="Annual checkup completed" pct={pct(data.annualCheckup, data.total)} note={`${data.annualCheckup} / ${data.total}`} />
        <Row label={t("completion_rate")} pct={pct(data.completed, data.completed + data.noShow)} note={`${data.completed} / ${data.completed + data.noShow}`} />
        <Row label={t("no_show_rate")} pct={pct(data.noShow, data.completed + data.noShow)} note={`${data.noShow} / ${data.completed + data.noShow}`} />
      </div>

      <h2 className="mt-8 mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workers</h2>
      <div className="rounded-2xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-start text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Language</th>
              <th className="p-3">Last checkup</th>
              <th className="p-3">Next due</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {workers.map(w => {
              const state = dueState(w.last_checkup);
              return (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="p-3">{w.full_name ?? "—"}</td>
                  <td className="p-3 uppercase">{w.preferred_language}</td>
                  <td className="p-3">{w.last_checkup ? new Date(w.last_checkup).toLocaleDateString() : "—"}</td>
                  <td className="p-3">{state.due ?? "—"}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${state.tone}`}>{state.label}</span>
                  </td>
                </tr>
              );
            })}
            {workers.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">—</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function StatCard({ icon, label, value, foot, tone }: { icon: React.ReactNode; label: string; value: string; foot: string; tone: "primary" | "accent" | "coral" }) {
  const toneClass =
    tone === "coral" ? "bg-destructive/10 text-destructive"
      : tone === "accent" ? "bg-accent/20 text-accent-foreground"
      : "bg-primary/10 text-primary";
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${toneClass}`}>{icon}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold text-foreground">{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{foot}</div>
    </div>
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
