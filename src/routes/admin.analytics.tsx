import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminAnalytics } from "@/lib/adminConsole.functions";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/analytics")({ component: Analytics });

function Analytics() {
  const load = useServerFn(getAdminAnalytics);
  const q = useQuery({ queryKey: ["admin-analytics"], queryFn: () => load({}) });
  const d = q.data;

  const cards = [
    { label: "Signups (12 weeks)", value: d?.cards.signups12w ?? 0 },
    { label: "Appointments", value: d?.cards.appointments ?? 0 },
    { label: "Completion rate", value: `${d?.cards.completionRate ?? 0}%` },
    { label: "Medication lookups (8w)", value: d?.cards.lookups8w ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Aggregated platform trends. No individual health data is shown.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{q.isLoading ? "—" : c.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="font-medium">Signups per week</h2>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d?.signupsPerWeek ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="font-medium">Appointments by status</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d?.appointmentsByStatus ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="font-medium">Users by role</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d?.usersByRole ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="font-medium">Medication lookups per week</h2>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d?.lookupsPerWeek ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}