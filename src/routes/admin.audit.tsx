import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAuditLogs } from "@/lib/adminConsole.functions";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useFormat } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({ component: Audit });

function Audit() {
  const load = useServerFn(listAuditLogs);
  const fmt = useFormat();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("any");
  const [table, setTable] = useState("any");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin-audit", search, action, table], queryFn: () => load({ data: { search, action, table } }) });
  const logs = q.data?.logs ?? [];
  type Log = (typeof logs)[number];

  const columns: DataTableColumn<Log>[] = [
    { key: "created_at", header: "When", className: "text-xs text-muted-foreground", cell: (l) => fmt.dateTime(l.created_at) },
    { key: "actor", header: "Actor", cell: (l) => l.actor },
    { key: "action", header: "Action", cell: (l) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{l.action}</span> },
    { key: "table_name", header: "Table", className: "text-xs", cell: (l) => l.table_name ?? "—" },
    {
      key: "detail",
      header: "Detail",
      cell: (l) => (
        <>
          <button className="text-xs font-medium text-primary underline" onClick={() => setOpen(open === l.id ? null : l.id)}>
            {open === l.id ? "Hide" : "View"}
          </button>
          {open === l.id && (
            <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-muted p-2 text-[11px]">{JSON.stringify(l.detail ?? {}, null, 2)}</pre>
          )}
        </>
      ),
    },
  ];

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

      <DataTable
        className="shadow-sm"
        columns={columns}
        rows={logs}
        rowKey={(l) => l.id}
        loading={q.isLoading}
        empty="No audit entries match these filters."
      />
    </div>
  );
}