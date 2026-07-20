import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrgs, createPharmacy, addMedication } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/pharmacies")({ component: Page });

function Page() {
  const list = useServerFn(listOrgs);
  const addPh = useServerFn(createPharmacy);
  const addMed = useServerFn(addMedication);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-orgs"], queryFn: () => list({}) });
  const [ph, setPh] = useState({ name: "", area: "", address: "", phone: "", hours: "" });
  const [med, setMed] = useState({ name: "", generic_name: "", form: "", strength: "" });
  const mPh = useMutation({ mutationFn: () => addPh({ data: ph }), onSuccess: () => { setPh({ name: "", area: "", address: "", phone: "", hours: "" }); qc.invalidateQueries({ queryKey: ["admin-orgs"] }); } });
  const mMed = useMutation({ mutationFn: () => addMed({ data: med }), onSuccess: () => { setMed({ name: "", generic_name: "", form: "", strength: "" }); qc.invalidateQueries({ queryKey: ["admin-orgs"] }); } });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Pharmacies & medications</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-medium">Add a pharmacy</h2>
          {(["name","area","address","phone","hours"] as const).map((k) => (
            <input key={k} placeholder={k} className="mb-2 w-full rounded-md border bg-background p-2 text-sm" value={ph[k]} onChange={(e) => setPh({ ...ph, [k]: e.target.value })} />
          ))}
          <Button onClick={() => mPh.mutate()} disabled={!ph.name || mPh.isPending}>Add pharmacy</Button>
          <ul className="mt-4 divide-y text-sm">
            {(q.data?.pharmacies ?? []).map((p) => <li key={p.id} className="py-2">{p.name} <span className="text-xs text-muted-foreground">{p.area}</span></li>)}
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-medium">Add a medication</h2>
          {(["name","generic_name","form","strength"] as const).map((k) => (
            <input key={k} placeholder={k} className="mb-2 w-full rounded-md border bg-background p-2 text-sm" value={med[k]} onChange={(e) => setMed({ ...med, [k]: e.target.value })} />
          ))}
          <Button onClick={() => mMed.mutate()} disabled={!med.name || mMed.isPending}>Add medication</Button>
          <ul className="mt-4 divide-y text-sm">
            {(q.data?.medications ?? []).map((m) => <li key={m.id} className="py-2">{m.name} <span className="text-xs text-muted-foreground">{m.generic_name}</span></li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}