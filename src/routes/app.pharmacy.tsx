import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { searchAvailability, logAvailabilityLookup } from "@/lib/pharmacyHub.functions";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/app/pharmacy")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Find medication availability — Sihha" },
      { name: "description", content: "Check which nearby pharmacies report a medication in stock. Availability only — Sihha does not sell, reserve or deliver medication." },
      { property: "og:title", content: "Find medication availability — Sihha" },
      { property: "og:description", content: "Search pharmacies reporting your medication in stock, then call ahead." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Pharmacy = { id: string; name: string; area: string | null; address: string | null; phone: string | null; hours: string | null };

function Page() {
  const search = useServerFn(searchAvailability);
  const log = useServerFn(logAvailabilityLookup);
  const [q, setQ] = useState("");
  const m = useMutation({
    mutationFn: (query: string) => search({ data: { query } }),
    onSuccess: (res) => {
      const seen = new Set<string>();
      for (const row of res.rows) {
        const p = (Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies) as Pharmacy | undefined;
        if (!p || seen.has(p.id)) continue;
        seen.add(p.id);
        void log({ data: { pharmacyId: p.id, medicationName: row.medication_name } });
      }
    },
  });

  const rows = m.data?.rows ?? [];

  return (
    <AppShell title="Find medication">
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <label className="mb-2 block text-sm font-medium" htmlFor="med-search">Search by medicine name</label>
          <div className="flex gap-2">
            <input
              id="med-search"
              className="flex-1 rounded-md border bg-background p-2 text-sm"
              placeholder="e.g. Panadol, paracetamol"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) m.mutate(q.trim()); }}
            />
            <Button onClick={() => q.trim() && m.mutate(q.trim())} disabled={!q.trim() || m.isPending} aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Availability only — Sihha does not sell, reserve, or deliver medication. Bring your prescription to the pharmacy.
          </p>
        </div>

        <ul className="space-y-2">
          {rows.map((row) => {
            const p = (Array.isArray(row.pharmacies) ? row.pharmacies[0] : row.pharmacies) as Pharmacy | undefined;
            if (!p) return null;
            return (
              <li key={row.id} className="rounded-2xl border bg-card p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.medication_name}</p>
                    <p className="mt-0.5">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline h-3 w-3" />{[p.area, p.address].filter(Boolean).join(" · ") || "Address not listed"}
                    </p>
                    {p.hours && <p className="text-xs text-muted-foreground">Hours: {p.hours}</p>}
                    <p className="text-xs text-muted-foreground">
                      Updated {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">In stock</span>
                </div>
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Phone className="h-3 w-3" /> Call {p.phone}
                  </a>
                )}
              </li>
            );
          })}
        </ul>

        {m.isSuccess && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No pharmacy currently reports this in stock. Try the generic name.</p>
        )}
      </div>
    </AppShell>
  );
}
