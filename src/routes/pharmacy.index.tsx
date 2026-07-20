import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyPharmacyStock, setStock } from "@/lib/staff.functions";

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
      <div className="rounded-2xl border bg-card">
        <ul className="divide-y">
          {(q.data?.stock ?? []).map((row) => (
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
          {(q.data?.stock ?? []).length === 0 && !q.isLoading && (
            <li className="p-4 text-sm text-muted-foreground">No medications in the catalogue yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}