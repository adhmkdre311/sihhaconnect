import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAuditLogs } from "@/lib/adminConsole.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/audit")({ component: Audit });

function Audit() {
  const load = useServerFn(listAuditLogs);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("any");
  const [table, setTable] = useState("any");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin-audit", search, action, table], queryFn: () => load({ data: { search, action, table } }) });
  const logs = q.data?.logs ?? [];

  function exportCsv() {
    const lines = [["When", "Actor", "Action", "Table", "Record"], ...logs.map((l) => [
      new Date(l.created_at).toISOString(), l.actor, l.action, l.table_name ?? "", l.record_id ?? "",
    ])].map((c) => c.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sihha-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Audit logs</h1>
          <p className="text-sm text-muted-foreground">Immutable trail of privileged actions — required for PDPPL accountability.</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!logs.length}>Export CSV</Button>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <input placeholder="Search actor or detail" className="rounded-md border bg-background p-2 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded-md border bg-background p-2 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="any">All actions</option>
          {(q.data?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="rounded-md border bg-background p-2 text-sm" value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="any">All tables</option>
          {(q.data?.tables ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Table</th><th className="p-3">Detail</th></tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-3">{l.actor}</td>
                <td className="p-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{l.action}</span></td>
                <td className="p-3 text-xs">{l.table_name ?? "—"}</td>
                <td className="p-3">
                  <button className="text-xs font-medium text-primary underline" onClick={() => setOpen(open === l.id ? null : l.id)}>
                    {open === l.id ? "Hide" : "View"}
                  </button>
                  {open === l.id && (
                    <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-muted p-2 text-[11px]">{JSON.stringify(l.detail ?? {}, null, 2)}</pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && logs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No audit entries match these filters.</p>}
      </div>
    </div>
  );
}