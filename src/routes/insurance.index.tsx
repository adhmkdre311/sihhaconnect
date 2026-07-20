import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getInsurerAggregates } from "@/lib/staff.functions";

export const Route = createFileRoute("/insurance/")({ component: Page });

function Page() {
  const fn = useServerFn(getInsurerAggregates);
  const q = useQuery({ queryKey: ["insurer-agg"], queryFn: () => fn({}) });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">{q.data?.insurer?.name ?? "Insurer"} — network overview</h1>
        <p className="text-sm text-muted-foreground">Per-employer aggregates only. No row-level patient data (PDPPL-safe).</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Employer</th>
              <th className="px-4 py-2 text-right">Workers enrolled</th>
              <th className="px-4 py-2 text-right">Check-ups completed</th>
              <th className="px-4 py-2 text-right">No-shows</th>
              <th className="px-4 py-2 text-right">Appointments total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data?.rows ?? []).map((r) => (
              <tr key={r.employer_id}>
                <td className="px-4 py-2">{r.company_name}</td>
                <td className="px-4 py-2 text-right">{r.workers_enrolled}</td>
                <td className="px-4 py-2 text-right">{r.checkups_completed}</td>
                <td className="px-4 py-2 text-right">{r.no_shows}</td>
                <td className="px-4 py-2 text-right">{r.appointments_total}</td>
              </tr>
            ))}
            {(q.data?.rows ?? []).length === 0 && !q.isLoading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No linked employers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}