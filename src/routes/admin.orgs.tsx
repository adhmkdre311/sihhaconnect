import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrgs, linkInsurerEmployer } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/orgs")({ component: Orgs });

function Orgs() {
  const list = useServerFn(listOrgs);
  const link = useServerFn(linkInsurerEmployer);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-orgs"], queryFn: () => list({}) });
  const [insurerId, setInsurerId] = useState("");
  const [employerId, setEmployerId] = useState("");
  const mLink = useMutation({ mutationFn: () => link({ data: { insurerId, employerId } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orgs"] }) });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Organisations</h1>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="font-medium">Link insurer to employer</h2>
        <p className="text-xs text-muted-foreground">Insurers only see aggregated stats. No PHI.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select className="rounded-md border bg-background p-2 text-sm" value={insurerId} onChange={(e) => setInsurerId(e.target.value)}>
            <option value="">Choose insurer…</option>
            {(q.data?.insurers ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select className="rounded-md border bg-background p-2 text-sm" value={employerId} onChange={(e) => setEmployerId(e.target.value)}>
            <option value="">Choose employer…</option>
            {(q.data?.employers ?? []).map((e) => <option key={e.id} value={e.id}>{e.company_name}</option>)}
          </select>
          <Button onClick={() => mLink.mutate()} disabled={!insurerId || !employerId || mLink.isPending}>Link</Button>
        </div>
      </section>
    </div>
  );
}