import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyPharmacyStock, setStock } from "@/lib/staff.functions";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/pharmacy/")({ component: StockPage });

function StockPage() {
  const fn = useServerFn(getMyPharmacyStock);
  const setFn = useServerFn(setStock);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pharm-stock"], queryFn: () => fn({}) });
  const m = useMutation({
    mutationFn: (v: { medicationId: string; inStock: boolean }) => setFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pharm-stock"] }),
  });
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "in" | "out">("all");
  const all = q.data?.stock ?? [];
  const term = query.trim().toLowerCase();
  const rows = all
    .filter((r) => only === "all" || (only === "in" ? r.in_stock : !r.in_stock))
    .filter((r) => !term || r.name.toLowerCase().includes(term) || (r.generic_name ?? "").toLowerCase().includes(term));
  const inCount = all.filter((r) => r.in_stock).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Stock availability</h1>
        {q.data?.pharmacy ? (
          <p className="text-sm text-muted-foreground">{q.data.pharmacy.name} · {q.data.pharmacy.area}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Not linked to a pharmacy yet.</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Toggle in-stock per medication. Workers see availability only — no prices, no ordering.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Catalogue</div>
          <div className="font-display text-2xl font-semibold">{all.length}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">In stock</div>
          <div className="font-display text-2xl font-semibold text-primary">{inCount}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Out of stock</div>
          <div className="font-display text-2xl font-semibold text-destructive">{all.length - inCount}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["all", "in", "out"] as const).map((f) => (
          <button key={f} onClick={() => setOnly(f)}
            className={`rounded-full border px-3 py-1 ${only === f ? "border-primary bg-primary text-primary-foreground" : ""}`}>
            {f === "all" ? "All" : f === "in" ? "In stock" : "Out of stock"}
          </button>
        ))}
        <div className="ml-auto w-full max-w-xs">
          <Input placeholder="Search medication" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="rounded-2xl border bg-card">
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.medication_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{row.name}</p>
                {row.generic_name && <p className="text-xs text-muted-foreground">{row.generic_name}</p>}
              </div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={row.in_stock}
                  onChange={(e) => m.mutate({ medicationId: row.medication_id, inStock: e.target.checked })} />
                <span className={row.in_stock ? "text-primary" : "text-muted-foreground"}>{row.in_stock ? "In stock" : "Out"}</span>
              </label>
            </li>
          ))}
          {rows.length === 0 && !q.isLoading && (
            <li className="p-4 text-sm text-muted-foreground">{all.length ? "No medications match your filters." : "No medications in the catalogue yet."}</li>
          )}
        </ul>
      </div>
    </div>
  );
}