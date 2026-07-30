import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getInsurerAggregates } from "@/lib/staff.functions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/insurance/")({ component: Page });

function Page() {
  const fn = useServerFn(getInsurerAggregates);
  const q = useQuery({ queryKey: ["insurer-agg"], queryFn: () => fn({}) });
  const [query, setQuery] = useState("");
  const all = q.data?.rows ?? [];
  const term = query.trim().toLowerCase();
  const rows = all.filter((r) => !term || (r.company_name ?? "").toLowerCase().includes(term));
  const sum = (k: "workers_enrolled" | "checkups_completed" | "no_shows" | "appointments_total") =>
    rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const noShowPct = sum("appointments_total") ? Math.round((sum("no_shows") / sum("appointments_total")) * 100) : 0;

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Employer", "Workers enrolled", "Check-ups completed", "No-shows", "Appointments total"].join(",");
    const lines = rows.map((r) => [r.company_name ?? "", r.workers_enrolled, r.checkups_completed, r.no_shows, r.appointments_total]
      .map((v) => esc(String(v))).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `network-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{q.data?.insurer?.name ?? "Insurer"} — network overview</h1>
          <p className="text-sm text-muted-foreground">Per-employer aggregates only. No row-level patient data (PDPPL-safe).</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Employers" value={String(rows.length)} />
        <Stat label="Workers enrolled" value={sum("workers_enrolled").toLocaleString()} />
        <Stat label="Check-ups completed" value={sum("checkups_completed").toLocaleString()} />
        <Stat label="No-show rate" value={`${noShowPct}%`} />
      </div>
      <div className="max-w-xs">
        <Input placeholder="Search employer" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Employer</th>
              <th className="px-4 py-2 text-right">Workers enrolled</th>
              <th className="px-4 py-2 text-right">Check-ups completed</th>
              <th className="px-4 py-2 text-right">No-shows</th>
              <th className="px-4 py-2 text-right">Appointments total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.employer_id}>
                <td className="px-4 py-2">{r.company_name}</td>
                <td className="px-4 py-2 text-right">{r.workers_enrolled}</td>
                <td className="px-4 py-2 text-right">{r.checkups_completed}</td>
                <td className="px-4 py-2 text-right">{r.no_shows}</td>
                <td className="px-4 py-2 text-right">{r.appointments_total}</td>
              </tr>
            ))}
            {rows.length === 0 && !q.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">{all.length ? "No employers match your search." : "No linked employers yet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}