import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminDashboard, updateUserAccess } from "@/lib/adminConsole.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const load = useServerFn(getAdminDashboard);
  const update = useServerFn(updateUserAccess);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => load({}) });
  const approve = useMutation({
    mutationFn: (userId: string) => update({ data: { userId, approved: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-dashboard"] }),
  });

  const c = q.data?.counts;
  const cards: { label: string; value: number }[] = [
    { label: "Users", value: c?.users ?? 0 },
    { label: "Employers", value: c?.employers ?? 0 },
    { label: "Clinics", value: c?.clinics ?? 0 },
    { label: "Pharmacies", value: c?.pharmacies ?? 0 },
    { label: "Insurers", value: c?.insurers ?? 0 },
    { label: "Appointments", value: c?.appointments ?? 0 },
    { label: "Documents", value: c?.documents ?? 0 },
    { label: "Medication listings", value: c?.listings ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Platform dashboard</h1>
        <p className="text-sm text-muted-foreground">Health of the whole Sihha network at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{q.isLoading ? "—" : s.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Staff awaiting approval</h2>
          <Link to="/admin/approvals" className="text-xs font-medium text-primary underline">Role requests</Link>
        </div>
        {(q.data?.awaiting ?? []).length === 0 && !q.isLoading && (
          <p className="mt-2 text-sm text-muted-foreground">Everyone is approved.</p>
        )}
        <ul className="mt-3 divide-y">
          {(q.data?.awaiting ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{u.full_name || "(no name)"}</p>
                <p className="text-xs text-muted-foreground">{u.email} · {u.role ?? "worker"} · {u.preferred_language}</p>
              </div>
              <Button size="sm" onClick={() => approve.mutate(u.id)} disabled={approve.isPending}>Approve</Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="font-medium">Recent activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(q.data?.activity ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.action}</span>
              <span className="text-muted-foreground">{a.table_name}</span>
              <span className="text-xs text-muted-foreground">by {a.actor} · {new Date(a.created_at).toLocaleString()}</span>
            </li>
          ))}
          {(q.data?.activity ?? []).length === 0 && !q.isLoading && <li className="text-muted-foreground">No activity yet.</li>}
        </ul>
        <Link to="/admin/audit" className="mt-3 inline-block text-xs font-medium text-primary underline">View all audit logs</Link>
      </section>
    </div>
  );
}