import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listMyAvailability, updateMyPharmacy } from "@/lib/pharmacyHub.functions";

export const Route = createFileRoute("/pharmacy/settings")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Pharmacy settings — Sihha pharmacy hub" },
      { name: "description", content: "Update your pharmacy name, address, phone number and opening hours shown to workers." },
      { property: "og:title", content: "Pharmacy settings — Sihha pharmacy hub" },
      { property: "og:description", content: "Keep your pharmacy details current for workers searching availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Page() {
  const listFn = useServerFn(listMyAvailability);
  const saveFn = useServerFn(updateMyPharmacy);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pharm-availability"], queryFn: () => listFn({}) });
  const p = q.data?.pharmacy;

  const [form, setForm] = useState({ name: "", area: "", address: "", phone: "", hours: "" });
  useEffect(() => {
    if (p) setForm({ name: p.name ?? "", area: p.area ?? "", address: p.address ?? "", phone: p.phone ?? "", hours: p.hours ?? "" });
  }, [p]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      name: form.name.trim(),
      area: form.area.trim() || undefined,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
      hours: form.hours.trim() || undefined,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pharm-availability"] }); toast.success("Pharmacy details saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!p && !q.isLoading) {
    return <p className="text-sm text-muted-foreground">Not linked to a pharmacy yet.</p>;
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pharmacy settings</h1>
        <p className="text-sm text-muted-foreground">These details appear to workers checking medication availability.</p>
      </div>
      <form
        className="space-y-3 rounded-2xl border bg-card p-4"
        onSubmit={(e) => { e.preventDefault(); if (form.name.trim().length >= 2) save.mutate(); }}
      >
        <Field label="Pharmacy name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Area" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
        <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field label="Opening hours" value={form.hours} onChange={(v) => setForm({ ...form, hours: v })} placeholder="e.g. Sat–Thu 8:00–23:00" />
        <Button type="submit" disabled={form.name.trim().length < 2 || save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input className="mt-1" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
