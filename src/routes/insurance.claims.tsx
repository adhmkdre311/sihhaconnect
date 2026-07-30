import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listInsurerClaims } from "@/lib/staff.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/insurance/claims")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Claims history — Sihha insurer portal" },
      { name: "description", content: "Review de-identified claim records across your employer network, filter by status and date, and export to CSV." },
      { property: "og:title", content: "Claims history — Sihha insurer portal" },
      { property: "og:description", content: "Filter network claims by status and service date, then export the results as CSV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUSES = ["all", "submitted", "in_review", "approved", "rejected", "paid"] as const;
type Status = (typeof STATUSES)[number];

const LABEL: Record<string, string> = {
  all: "All", submitted: "Submitted", in_review: "In review", approved: "Approved", rejected: "Rejected", paid: "Paid",
};

function badgeClass(s: string) {
  if (s === "approved" || s === "paid") return "bg-primary/10 text-primary";
  if (s === "rejected") return "bg-destructive/10 text-destructive";
  if (s === "in_review") return "bg-accent/20 text-accent-foreground";
  return "bg-muted text-muted-foreground";
}

function Page() {
  const fn = useServerFn(listInsurerClaims);
  const [status, setStatus] = useState<Status>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");

  const q = useQuery({
    queryKey: ["insurer-claims", status, from, to],
    queryFn: () => fn({ data: { status, from: from || undefined, to: to || undefined } }),
  });

  const all = q.data?.rows ?? [];
  const term = query.trim().toLowerCase();
  const rows = all.filter((r) => {
    if (!term) return true;
    const hay = [r.claim_ref, r.category ?? "", r.employer?.company_name ?? "", r.clinic?.name ?? ""].join(" ").toLowerCase();
    return hay.includes(term);
  });

  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Claim ref", "Employer", "Clinic", "Service date", "Submitted", "Decided", "Category", "Status", "Amount", "Currency"].join(",");
    const lines = rows.map((r) =>
      [
        r.claim_ref,
        r.employer?.company_name ?? "",
        r.clinic?.name ?? "",
        r.service_date ?? "",
        r.submitted_at ? String(r.submitted_at).slice(0, 10) : "",
        r.decided_at ? String(r.decided_at).slice(0, 10) : "",
        r.category ?? "",
        LABEL[r.status] ?? r.status,
        String(r.amount ?? 0),
        r.currency ?? "",
      ].map((v) => esc(String(v))).join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claims-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Claims history</h1>
          <p className="text-sm text-muted-foreground">
            De-identified claim records across your employer network. No patient identity is shown (PDPPL-safe).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {LABEL[s]}
            </button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground">
          From
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          Search
          <Input placeholder="Ref, employer, clinic" value={query} onChange={(e) => setQuery(e.target.value)} className="mt-1 w-56" />
        </label>
        {(status !== "all" || from || to || query) && (
          <Button size="sm" variant="ghost" onClick={() => { setStatus("all"); setFrom(""); setTo(""); setQuery(""); }}>
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Claims shown" value={rows.length.toLocaleString()} />
        <Stat label="Total value" value={money(total)} />
        <Stat label="Approved / paid" value={rows.filter((r) => r.status === "approved" || r.status === "paid").length.toLocaleString()} />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Claim ref</th>
              <th className="px-4 py-2 text-left">Employer</th>
              <th className="px-4 py-2 text-left">Clinic</th>
              <th className="px-4 py-2 text-left">Service date</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium">{r.claim_ref}</td>
                <td className="px-4 py-2">{r.employer?.company_name ?? "—"}</td>
                <td className="px-4 py-2">{r.clinic?.name ?? "—"}</td>
                <td className="px-4 py-2">{r.service_date}</td>
                <td className="px-4 py-2">{r.category ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(r.status)}`}>
                    {LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{money(Number(r.amount) || 0)} {r.currency}</td>
              </tr>
            ))}
            {rows.length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  {all.length ? "No claims match your filters." : "No claims recorded yet."}
                </td>
              </tr>
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