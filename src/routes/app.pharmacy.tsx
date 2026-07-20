import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { searchMedicationAvailability, logPharmacyLookup } from "@/lib/staff.functions";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/app/pharmacy")({ component: Page });

function Page() {
  const search = useServerFn(searchMedicationAvailability);
  const log = useServerFn(logPharmacyLookup);
  const [q, setQ] = useState("");
  const m = useMutation({ mutationFn: (query: string) => search({ data: { query } }) });
  return (
    <AppShell title="Find medication">
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <label className="mb-2 block text-sm font-medium">Search by medicine name</label>
          <div className="flex gap-2">
            <input className="flex-1 rounded-md border bg-background p-2 text-sm" placeholder="e.g. Panadol, paracetamol"
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) m.mutate(q.trim()); }} />
            <Button onClick={() => q.trim() && m.mutate(q.trim())} disabled={!q.trim() || m.isPending}><Search className="h-4 w-4" /></Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Availability only — Sihha does not sell, reserve, or deliver medication. Bring your prescription to the pharmacy.</p>
        </div>
        {m.data?.map((r) => (
          <div key={r.medication.id} className="rounded-2xl border bg-card p-4">
            <p className="font-medium">{r.medication.name} <span className="text-xs text-muted-foreground">{r.medication.strength} {r.medication.form}</span></p>
            {r.medication.generic_name && <p className="text-xs text-muted-foreground">Generic: {r.medication.generic_name}</p>}
            {r.pharmacies.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No pharmacy currently reports this in stock.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {r.pharmacies.map((s) => {
                  type P = { id: string; name: string; area: string | null; address: string | null; phone: string | null; hours: string | null };
                  const row = s as unknown as { pharmacy_id: string; pharmacies: P | P[] };
                  const p = Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies;
                  if (!p) return null;
                  return (
                    <li key={row.pharmacy_id} className="rounded-lg border bg-background p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{p.area} · {p.address}</p>
                          {p.hours && <p className="text-xs text-muted-foreground">Hours: {p.hours}</p>}
                        </div>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">In stock</span>
                      </div>
                      {p.phone && (
                        <a href={`tel:${p.phone}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                          onClick={() => log({ data: { medicationId: r.medication.id, pharmacyId: p.id, area: p.area ?? undefined } })}>
                          <Phone className="h-3 w-3" /> Call {p.phone}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
        {m.isSuccess && m.data && m.data.length === 0 && <p className="text-sm text-muted-foreground">No medication matches. Try the generic name.</p>}
      </div>
    </AppShell>
  );
}