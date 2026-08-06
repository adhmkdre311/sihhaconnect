import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAdminRecords, deleteAdminRecord } from "@/lib/adminConsole.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/records")({ component: Records });

type Table = "appointments" | "documents" | "medication_availability" | "notifications";

const TABS: { key: Table; label: string; cols: [string, string, string]; statuses: { v: string; l: string }[] }[] = [
  { key: "appointments", label: "Appointments", cols: ["Worker", "Clinic", "Department"], statuses: [
    { v: "any", l: "Any status" }, { v: "booked", l: "Booked" }, { v: "completed", l: "Completed" },
    { v: "cancelled", l: "Cancelled" }, { v: "no_show", l: "No-show" }] },
  { key: "documents", label: "Documents", cols: ["Worker", "Type", ""], statuses: [
    { v: "any", l: "All documents" }, { v: "flagged", l: "Flagged for review" }] },
  { key: "medication_availability", label: "Medication availability", cols: ["Medication", "Pharmacy", ""], statuses: [
    { v: "any", l: "All listings" }, { v: "in_stock", l: "In stock" }, { v: "out_of_stock", l: "Out of stock" }] },
  { key: "notifications", label: "Notifications", cols: ["Recipient", "Title", "Preview"], statuses: [
    { v: "any", l: "All" }, { v: "unread", l: "Unread" }, { v: "read", l: "Read" }] },
];

function Records() {
  const load = useServerFn(listAdminRecords);
  const remove = useServerFn(deleteAdminRecord);
  const qc = useQueryClient();
  const [table, setTable] = useState<Table>("appointments");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("any");
  const tab = TABS.find((t) => t.key === table)!;

  const q = useQuery({ queryKey: ["admin-records", table, search, status], queryFn: () => load({ data: { table, search, status } }) });
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { table, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-records"] }),
  });

  const rows = q.data ?? [];

  function exportCsv() {
    const header = ["When", tab.cols[0], tab.cols[1], tab.cols[2] || "Detail", "Status"];
    const lines = [header, ...rows.map((r) => [new Date(r.when).toISOString(), r.a, r.b, r.c, r.status])]
      .map((cells) => cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sihha-${table}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Data records</h1>
          <p className="text-sm text-muted-foreground">Read-only oversight of platform records, with export and correction tools.</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTable(t.key); setStatus("any"); }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${table === t.key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input placeholder="Search records" className="rounded-md border bg-background p-2 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded-md border bg-background p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          {tab.statuses.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">{tab.cols[0]}</th>
              <th className="p-3">{tab.cols[1]}</th>
              {tab.cols[2] && <th className="p-3">{tab.cols[2]}</th>}
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.when).toLocaleString()}</td>
                <td className="p-3">{r.a}</td>
                <td className="p-3">{r.b}</td>
                {tab.cols[2] && <td className="p-3 text-xs text-muted-foreground">{r.c}</td>}
                <td className="p-3 text-xs">{r.status}</td>
                <td className="p-3">
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this record permanently?")) del.mutate(r.id); }} disabled={del.isPending}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No records found.</p>}
      </div>
      <p className="text-xs text-muted-foreground">Medical documents are automatically purged 12 months after upload.</p>
    </div>
  );
}