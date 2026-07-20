import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPendingStaff, approveStaffRequest, denyStaffRequest } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({ component: Approvals });

function Approvals() {
  const list = useServerFn(listPendingStaff);
  const approve = useServerFn(approveStaffRequest);
  const deny = useServerFn(denyStaffRequest);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-pending"], queryFn: () => list({}) });
  const mA = useMutation({ mutationFn: (id: string) => approve({ data: { requestId: id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pending"] }) });
  const mD = useMutation({ mutationFn: (id: string) => deny({ data: { requestId: id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pending"] }) });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Staff approvals</h1>
        <p className="text-sm text-muted-foreground">Workers activate immediately. Staff accounts start here.</p>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && q.data.length === 0 && <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No pending requests.</div>}
      <div className="space-y-3">
        {(q.data ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.profile?.full_name ?? "(no name)"}</p>
                <p className="text-xs text-muted-foreground">{r.profile?.email}</p>
                <p className="mt-1 text-xs">Requested role: <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{r.role}</span></p>
                {r.company_name && <p className="text-xs">Company: {r.company_name}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => mA.mutate(r.id)} disabled={mA.isPending}>Approve</Button>
                <Button size="sm" variant="ghost" onClick={() => mD.mutate(r.id)} disabled={mD.isPending}>Deny</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}