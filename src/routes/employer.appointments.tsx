import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/employer/appointments")({ component: EmpAppts });

type Row = { id: string; scheduled_at: string; status: string; department: string; clinic: { name: string } | null; worker: { full_name: string | null } | null };

function EmpAppts() {
  const { t } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!user) return;
    void supabase.from("appointments")
      .select("id, scheduled_at, status, department, clinic:clinics(name), worker:profiles!appointments_worker_id_fkey(full_name)")
      .order("scheduled_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as never));
  }, [user]);

  const q = query.trim().toLowerCase();
  const filtered = rows
    .filter(r => filter === "all" || r.status === filter)
    .filter(r => !q
      || (r.worker?.full_name ?? "").toLowerCase().includes(q)
      || (r.clinic?.name ?? "").toLowerCase().includes(q));

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Date","Worker","Clinic","Department","Status"].join(",");
    const lines = filtered.map(r => [
      new Date(r.scheduled_at).toISOString(),
      r.worker?.full_name ?? "",
      r.clinic?.name ?? "",
      r.department,
      r.status,
    ].map(esc).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `appointments-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("book_appointment")}</h1>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="me-1 h-4 w-4" /> Export CSV
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {(["all","booked","completed","no_show","cancelled"] as const).map((f)=>(
          <button key={f} onClick={()=>setFilter(f)} className={`rounded-full border px-3 py-1 ${filter===f?"bg-primary text-primary-foreground border-primary":""}`}>{f}</button>
        ))}
        <div className="ml-auto w-full max-w-xs">
          <Input placeholder="Search worker or clinic" value={query} onChange={(e)=>setQuery(e.target.value)} />
        </div>
      </div>
      <div className="rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-start text-xs text-muted-foreground">
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
