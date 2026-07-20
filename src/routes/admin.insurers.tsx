import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrgs, createInsurer } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/insurers")({ component: Page });

function Page() {
  const list = useServerFn(listOrgs);
  const add = useServerFn(createInsurer);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-orgs"], queryFn: () => list({}) });
  const [name, setName] = useState("");
  const m = useMutation({ mutationFn: () => add({ data: { name } }), onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["admin-orgs"] }); } });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Insurers</h1>
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex gap-2">
          <input placeholder="Insurer name" className="flex-1 rounded-md border bg-background p-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => m.mutate()} disabled={!name || m.isPending}>Add</Button>
        </div>
        <ul className="mt-4 divide-y text-sm">
          {(q.data?.insurers ?? []).map((i) => <li key={i.id} className="py-2">{i.name}</li>)}
        </ul>
      </section>
    </div>
  );
}