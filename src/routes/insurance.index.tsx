import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { getNetworkOverview } from "@/lib/pharmacyHub.functions";

export const Route = createFileRoute("/insurance/")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Network overview — Sihha insurer portal" },
      { name: "description", content: "Aggregated, anonymized health of your covered employer groups: workers covered, completion and no-show rates." },
      { property: "og:title", content: "Network overview — Sihha insurer portal" },
      { property: "og:description", content: "Aggregated oversight of covered employer groups — no patient-level data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Page() {
  const fn = useServerFn(getNetworkOverview);
  const q = useQuery({ queryKey: ["insurer-network"], queryFn: () => fn({}) });
  const [query, setQuery] = useState("");
  const all = q.data?.rows ?? [];
  const term = query.trim().toLowerCase();
  const rows = all.filter((r) => !term || (r.company_name ?? "").toLowerCase().includes(term));

  const workers = rows.reduce((a, r) => a + (Number(r.workers_enrolled) || 0), 0);
  const completed = rows.reduce((a, r) => a + (Number(r.checkups_completed) || 0), 0);
  const totalAppts = rows.reduce((a, r) => a + (Number(r.appointments_total) || 0), 0);
  const avgNoShow = rows.length
    ? Math.round((rows.reduce((a, r) => a + (Number(r.no_show_rate_pct) || 0), 0) / rows.length) * 10) / 10
    : 0;
  const avgCompletion = totalAppts ? Math.round((completed / totalAppts) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">{q.data?.insurer?.name ?? "Insurer"} — network overview</h1>
        <p className="text-sm text-muted-foreground">
          Aggregated, anonymized data only. Row-level patient records are never available to this role (PDPPL).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Workers covered" value={workers.toLocaleString()} />
        <Stat label="Avg no-show" value={`${avgNoShow}%`} />
        <Stat label="Avg completion" value={`${avgCompletion}%`} />
        <Stat label="Employer groups" value={String(rows.length)} />
      </div>

      <div className="max-w-xs">
        <Input placeholder="Search employer group" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-start">Employer group</th>
              <th className="px-4 py-2 text-end">Workers</th>
              <th className="px-4 py-2 text-end">Completed</th>
              <th className="px-4 py-2 text-end">No-show %</th>
              <th className="px-4 py-2 text-start">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const pct = Number(r.no_show_rate_pct) || 0;
              const review = pct > 15;
              return (
                <tr key={r.employer_id}>
                  <td className="px-4 py-2">{r.company_name}</td>
                  <td className="px-4 py-2 text-end">{r.workers_enrolled}</td>
                  <td className="px-4 py-2 text-end">{r.checkups_completed}</td>
                  <td className="px-4 py-2 text-end">{pct}%</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${review ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {review ? "Review needed" : "On track"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !q.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">{all.length ? "No groups match your search." : "No covered employer groups yet."}</td></tr>
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
