import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAllOrgs, saveOrg, deleteOrg, saveOrgLink, deleteOrgLink } from "@/lib/adminConsole.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/orgs")({ component: Orgs });

type Kind = "employers" | "clinics" | "pharmacies" | "insurers";
type Draft = {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  area?: string;
  hours?: string;
  industry?: string;
  contactEmail?: string;
};

const TABS: { kind: Kind; label: string }[] = [
  { kind: "employers", label: "Employers" },
  { kind: "clinics", label: "Clinics" },
  { kind: "pharmacies", label: "Pharmacies" },
  { kind: "insurers", label: "Insurers" },
];

const FIELDS: Record<Kind, { key: keyof Draft; label: string }[]> = {
  employers: [
    { key: "name", label: "Company name" },
    { key: "industry", label: "Industry" },
    { key: "contactEmail", label: "Contact email" },
  ],
  clinics: [
    { key: "name", label: "Clinic name" },
    { key: "address", label: "Address" },
    { key: "phone", label: "Phone" },
  ],
  pharmacies: [
    { key: "name", label: "Pharmacy name" },
    { key: "area", label: "Area" },
    { key: "address", label: "Address" },
    { key: "phone", label: "Phone" },
    { key: "hours", label: "Opening hours" },
  ],
  insurers: [{ key: "name", label: "Insurer name" }],
};

const input = "rounded-md border bg-background p-2 text-sm";

function Orgs() {
  const load = useServerFn(listAllOrgs);
  const save = useServerFn(saveOrg);
  const remove = useServerFn(deleteOrg);
  const link = useServerFn(saveOrgLink);
  const unlink = useServerFn(deleteOrgLink);
  const qc = useQueryClient();

  const [kind, setKind] = useState<Kind>("employers");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [insurerId, setInsurerId] = useState("");
  const [employerId, setEmployerId] = useState("");

  const q = useQuery({ queryKey: ["admin-all-orgs"], queryFn: () => load({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-all-orgs"] });
  const fail = (e: Error) => setErr(e.message);

  const mSave = useMutation({
    mutationFn: (d: Draft) => save({ data: { kind, ...d, name: d.name.trim() } }),
    onSuccess: () => { setErr(null); setDraft(null); refresh(); },
    onError: fail,
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { kind, id } }),
    onSuccess: () => { setErr(null); refresh(); },
    onError: fail,
  });
  const mLink = useMutation({
    mutationFn: () => link({ data: { insurerId, employerId } }),
    onSuccess: () => { setErr(null); setInsurerId(""); setEmployerId(""); refresh(); },
    onError: fail,
  });
  const mUnlink = useMutation({
    mutationFn: (v: { insurerId: string; employerId: string }) => unlink({ data: v }),
    onSuccess: () => { setErr(null); refresh(); },
    onError: fail,
  });

  const rows: Draft[] =
    kind === "employers"
      ? (q.data?.employers ?? []).map((e) => ({ id: e.id, name: e.company_name, industry: e.industry ?? "", contactEmail: e.contact_email ?? "" }))
      : kind === "clinics"
        ? (q.data?.clinics ?? []).map((c) => ({ id: c.id, name: c.name, address: c.address ?? "", phone: c.phone ?? "" }))
        : kind === "pharmacies"
          ? (q.data?.pharmacies ?? []).map((p) => ({ id: p.id, name: p.name, area: p.area ?? "", address: p.address ?? "", phone: p.phone ?? "", hours: p.hours ?? "" }))
          : (q.data?.insurers ?? []).map((i) => ({ id: i.id, name: i.name }));

  const employerName = (id: string) => q.data?.employers.find((e) => e.id === id)?.company_name ?? "—";
  const insurerName = (id: string) => q.data?.insurers.find((i) => i.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Organisations</h1>
        <p className="text-sm text-muted-foreground">Create and maintain every organisation on the network. All changes are audited.</p>
      </div>

      {err && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.kind}
            onClick={() => { setKind(t.kind); setDraft(null); setErr(null); }}
            className={`rounded-full border px-3 py-1.5 text-sm ${kind === t.kind ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{TABS.find((t) => t.kind === kind)!.label}</h2>
          <Button size="sm" onClick={() => { setDraft({ name: "" }); setErr(null); }}>Add new</Button>
        </div>

        {draft && (
          <div className="mt-3 rounded-xl border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{draft.id ? "Editing organisation" : "New organisation"}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {FIELDS[kind].map((f) => (
                <label key={String(f.key)} className="flex flex-col gap-1 text-xs">
                  {f.label}
                  <input
                    className={input}
                    value={(draft[f.key] as string) ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={!draft.name.trim() || mSave.isPending} onClick={() => mSave.mutate(draft)}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </div>
        )}

        <ul className="mt-3 divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.industry, r.contactEmail, r.area, r.address, r.phone, r.hours].filter(Boolean).join(" · ") || "No extra details"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDraft(r); setErr(null); }}>Edit</Button>
                <Button size="sm" variant="ghost" disabled={mDelete.isPending} onClick={() => mDelete.mutate(r.id!)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
        {q.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && rows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>}
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="font-medium">Insurer ↔ employer scope</h2>
        <p className="text-xs text-muted-foreground">Insurers only see aggregated stats for the employers linked here. No individual health data.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select className={input} value={insurerId} onChange={(e) => setInsurerId(e.target.value)}>
            <option value="">Choose insurer…</option>
            {(q.data?.insurers ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select className={input} value={employerId} onChange={(e) => setEmployerId(e.target.value)}>
            <option value="">Choose employer…</option>
            {(q.data?.employers ?? []).map((e) => <option key={e.id} value={e.id}>{e.company_name}</option>)}
          </select>
          <Button onClick={() => mLink.mutate()} disabled={!insurerId || !employerId || mLink.isPending}>Link</Button>
        </div>
        <ul className="mt-3 divide-y">
          {(q.data?.links ?? []).map((l) => (
            <li key={`${l.insurer_id}-${l.employer_id}`} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{insurerName(l.insurer_id)} → {employerName(l.employer_id)}</span>
              <Button size="sm" variant="ghost" disabled={mUnlink.isPending} onClick={() => mUnlink.mutate({ insurerId: l.insurer_id, employerId: l.employer_id })}>Unlink</Button>
            </li>
          ))}
          {(q.data?.links ?? []).length === 0 && !q.isLoading && <li className="py-2 text-sm text-muted-foreground">No insurer scopes yet.</li>}
        </ul>
      </section>
    </div>
  );
}