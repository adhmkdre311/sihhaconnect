import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listMyAvailability, addAvailability, setAvailability, removeAvailability } from "@/lib/pharmacyHub.functions";

export const Route = createFileRoute("/pharmacy/")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Medication availability — Sihha pharmacy hub" },
      { name: "description", content: "Keep a simple in-stock list so workers know whether your pharmacy has a medication. Availability only — no prices, orders or delivery." },
      { property: "og:title", content: "Medication availability — Sihha pharmacy hub" },
      { property: "og:description", content: "A lightweight in-stock toggle list for your pharmacy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Page() {
  const listFn = useServerFn(listMyAvailability);
  const addFn = useServerFn(addAvailability);
  const setFn = useServerFn(setAvailability);
  const delFn = useServerFn(removeAvailability);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pharm-availability"], queryFn: () => listFn({}) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pharm-availability"] });

  const add = useMutation({
    mutationFn: (name: string) => addFn({ data: { name } }),
    onSuccess: () => { setName(""); invalidate(); toast.success("Added to your list"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; inStock: boolean }) => setFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const all = q.data?.rows ?? [];
  const term = query.trim().toLowerCase();
  const rows = all.filter((r) => !term || r.medication_name.toLowerCase().includes(term));
  const inCount = all.filter((r) => r.in_stock).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Medication availability</h1>
        {q.data?.pharmacy ? (
          <p className="text-sm text-muted-foreground">{q.data.pharmacy.name}{q.data.pharmacy.area ? ` · ${q.data.pharmacy.area}` : ""}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Not linked to a pharmacy yet.</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Answers one question: “do they have it”. Workers see availability only — no prices, no quantities, no ordering, reservation or delivery.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4"
        onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) add.mutate(name.trim()); }}
      >
        <Input
          className="min-w-48 flex-1"
          placeholder="Add a medication name (e.g. Paracetamol 500mg)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={name.trim().length < 2 || add.isPending}>
          <Plus className="me-1 h-4 w-4" /> Add
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="On your list" value={String(all.length)} />
        <Stat label="In stock" value={String(inCount)} tone="text-primary" />
        <Stat label="Out of stock" value={String(all.length - inCount)} tone="text-destructive" />
      </div>

      <div className="max-w-xs">
        <Input placeholder="Search your list" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-start">Medication</th>
              <th className="px-4 py-2 text-start">In stock</th>
              <th className="px-4 py-2 text-start">Last updated</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium">{r.medication_name}</td>
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={r.in_stock}
                      onChange={(e) => toggle.mutate({ id: r.id, inStock: e.target.checked })}
                    />
                    <span className={r.in_stock ? "text-primary" : "text-muted-foreground"}>{r.in_stock ? "In stock" : "Out"}</span>
                  </label>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-end">
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} aria-label={`Remove ${r.medication_name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !q.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  {all.length ? "Nothing matches your search." : "Add your first medication above."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
