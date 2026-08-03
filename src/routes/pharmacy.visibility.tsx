import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getPharmacyVisibility } from "@/lib/pharmacyHub.functions";

export const Route = createFileRoute("/pharmacy/visibility")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Visibility — Sihha pharmacy hub" },
      { name: "description", content: "See how often workers looked up your pharmacy's medication availability over the last 30 days." },
      { property: "og:title", content: "Visibility — Sihha pharmacy hub" },
      { property: "og:description", content: "A 30-day foot-traffic signal from worker availability lookups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function dayKey(d: Date) { return d.toISOString().slice(0, 10); }

function Page() {
  const fn = useServerFn(getPharmacyVisibility);
  const q = useQuery({ queryKey: ["pharm-visibility"], queryFn: () => fn({}) });
  const events = q.data?.events ?? [];

  const days: { day: string; label: string; lookups: number }[] = [];
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(new Date(e.created_at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    const k = dayKey(d);
    days.push({ day: k, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), lookups: counts.get(k) ?? 0 });
  }
  const total30 = days.reduce((a, d) => a + d.lookups, 0);
  const thisWeek = days.slice(-7).reduce((a, d) => a + d.lookups, 0);
  const prevWeek = days.slice(-14, -7).reduce((a, d) => a + d.lookups, 0);
  const delta = prevWeek ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Visibility</h1>
        <p className="text-sm text-muted-foreground">
          How often workers checked your availability. A foot-traffic signal only — Sihha has no sales, orders or payments.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Lookups (30 days)" value={total30.toLocaleString()} />
        <Stat label="This week" value={thisWeek.toLocaleString()} hint={delta === null ? undefined : `${delta >= 0 ? "+" : ""}${delta}% vs last week`} />
        <Stat label="Previous week" value={prevWeek.toLocaleString()} />
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Last 30 days</div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="lookupFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Area type="monotone" dataKey="lookups" stroke="hsl(var(--primary))" fill="url(#lookupFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {total30 === 0 && !q.isLoading && (
          <p className="mt-2 text-sm text-muted-foreground">No lookups recorded yet in the last 30 days.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
