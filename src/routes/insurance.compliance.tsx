import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getNetworkOverview } from "@/lib/pharmacyHub.functions";

export const Route = createFileRoute("/insurance/compliance")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Compliance status — Sihha insurer portal" },
      { name: "description", content: "Sort and search covered employer groups by no-show rate, size or check-ups completed, and export an aggregated summary CSV." },
      { property: "og:title", content: "Compliance status — Sihha insurer portal" },
      { property: "og:description", content: "Aggregated compliance progress per employer group, with CSV export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SORTS = [
  { id: "noshow", label: "No-show %" },
  { id: "size", label: "Group size" },
  { id: "checkups", label: "Check-ups" },
  { id: "name", label: "Name" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

function Page() {
  const fn = useServerFn(getNetworkOverview);
  const q = useQuery({ queryKey: ["insurer-network"], queryFn: () => fn({}) });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("noshow");

  const all = q.data?.rows ?? [];
  const term = query.trim().toLowerCase();
  const rows = all
    .filter((r) => !term || (r.company_name ?? "").toLowerCase().includes(term))
    .slice()
    .sort((a, b) => {
      if (sort === "name") return (a.company_name ?? "").localeCompare(b.company_name ?? "");
      if (sort === "size") return (Number(b.workers_enrolled) || 0) - (Number(a.workers_enrolled) || 0);
      if (sort === "checkups") return (Number(b.checkups_completed) || 0) - (Number(a.checkups_completed) || 0);
      return (Number(b.no_show_rate_pct) || 0) - (Number(a.no_show_rate_pct) || 0);
    });

  const completion = (r: (typeof all)[number]) => {
    const total = Number(r.appointments_total) || 0;
    return total ? Math.round(((Number(r.checkups_completed) || 0) / total) * 100) : 0;
  };

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Employer group", "Workers", "Check-ups completed", "Appointments total", "Completion %", "No-show %", "Status"].join(",");
    const lines = rows.map((r) =>
      [
        r.company_name ?? "",
        r.workers_enrolled,
        r.checkups_completed,
        r.appointments_total,
        completion(r),
        r.no_show_rate_pct,
        (Number(r.no_show_rate_pct) || 0) > 15 ? "Review needed" : "On track",
      ].map((v) => esc(String(v))).join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Compliance status</h1>
          <p className="text-sm text-muted-foreground">Aggregated, anonymized data only — no worker identity is ever shown (PDPPL).</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="me-1 h-4 w-4" /> Export summary CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <label className="text-xs text-muted-foreground">
          Search
          <Input className="mt-1 w-56" placeholder="Employer group" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                sort === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const pct = Number(r.no_show_rate_pct) || 0;
          const review = pct > 15;
          const comp = completion(r);
          return (
            <div key={r.employer_id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{r.company_name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${review ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  {review ? "Review needed" : "On track"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.workers_enrolled} workers · {r.checkups_completed} check-ups · {pct}% no-show
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Completion</span><span>{comp}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${comp}%` }} />
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && !q.isLoading && (
          <p className="text-sm text-muted-foreground">{all.length ? "No groups match your search." : "No covered employer groups yet."}</p>
        )}
      </div>
    </div>
  );
}
