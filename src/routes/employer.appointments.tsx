import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/employer/appointments")({ component: EmpAppts });

type Row = { id: string; scheduled_at: string; status: string; department: string; clinic: { name: string } | null; worker: { full_name: string | null } | null };

function EmpAppts() {
  const { t } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => {
    if (!user) return;
    void supabase.from("appointments")
      .select("id, scheduled_at, status, department, clinic:clinics(name), worker:profiles!appointments_worker_id_fkey(full_name)")
      .order("scheduled_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as never));
  }, [user]);

  const filtered = filter === "all" ? rows : rows.filter(r => r.status === filter);
  return (
    <AdminShell>
      <h1 className="mb-4 text-xl font-semibold">{t("book_appointment")}</h1>
      <div className="mb-3 flex gap-2 text-xs">
        {(["all","booked","completed","no_show","cancelled"] as const).map((f)=>(
          <button key={f} onClick={()=>setFilter(f)} className={`rounded-full border px-3 py-1 ${filter===f?"bg-primary text-primary-foreground border-primary":""}`}>{f}</button>
        ))}
      </div>
      <div className="rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-3">{t("date")}</th><th className="p-3">{t("patient")}</th><th className="p-3">Clinic</th><th className="p-3">{t("department")}</th><th className="p-3">{t("status")}</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-3">{new Date(r.scheduled_at).toLocaleString()}</td>
                <td className="p-3">{r.worker?.full_name ?? "—"}</td>
                <td className="p-3">{r.clinic?.name}</td>
                <td className="p-3">{r.department}</td>
                <td className="p-3">{r.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">—</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
