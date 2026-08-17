import { createFileRoute, Link } from "@tanstack/react-router";
import fallbackSummary from "../../acceptance-summary.json";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestAcceptanceRun } from "@/lib/acceptance.functions";

type Status = "pass" | "fail" | "skip";
type Result = { name: string; status: Status; detail?: string; ms: number };

export const Route = createFileRoute("/tests")({
  loader: async () => ({ run: await getLatestAcceptanceRun() }),
  errorComponent: () => (
    <main className="min-h-screen bg-background px-4 py-10">
      <p className="text-sm text-muted-foreground">Could not load the latest test run.</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen bg-background px-4 py-10">
      <p className="text-sm text-muted-foreground">No test runs recorded yet.</p>
    </main>
  ),
  head: () => ({
    meta: [
      { title: "Test Dashboard — Sihha Connect" },
      {
        name: "description",
        content:
          "Acceptance suite dashboard for Sihha Connect: pass, fail and skipped counts plus per-check timing breakdowns.",
      },
      { property: "og:title", content: "Test Dashboard — Sihha Connect" },
      {
        property: "og:description",
        content:
          "Acceptance suite dashboard for Sihha Connect: pass, fail and skipped counts plus per-check timing breakdowns.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TestDashboard,
});

const statusStyles: Record<Status, string> = {
  pass: "bg-primary/10 text-primary",
  fail: "bg-destructive/10 text-destructive",
  skip: "bg-accent/20 text-accent-foreground",
};

const statusLabel: Record<Status, string> = { pass: "PASS", fail: "FAIL", skip: "SKIP" };

function TestDashboard() {
  const { run } = Route.useLoaderData();
  const results = (run?.results ?? fallbackSummary.results ?? []) as Result[];
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const totalMs = run?.total_ms ?? results.reduce((sum, r) => sum + (r.ms || 0), 0);
  const slowest = Math.max(1, ...results.map((r) => r.ms || 0));

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Test dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest acceptance run · {results.length} checks · {totalMs}ms total
              {run ? ` · saved ${new Date(run.created_at).toLocaleString()} (${run.source})` : " · not yet saved"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              failed === 0 ? statusStyles.pass : statusStyles.fail
            }`}
          >
            {failed === 0 ? "Suite passing" : "Suite failing"}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Passed", value: passed, cls: "text-primary" },
            { label: "Failed", value: failed, cls: "text-destructive" },
            { label: "Skipped", value: skipped, cls: "text-muted-foreground" },
            { label: "Total", value: results.length, cls: "text-foreground" },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent className="p-4 text-center">
                <div className={`text-3xl font-bold ${c.cls}`}>{c.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Timing breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.length === 0 && (
              <p className="text-sm text-muted-foreground">No results recorded yet.</p>
            )}
            {results.map((r) => (
              <div key={r.name} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${statusStyles[r.status]}`}
                  >
                    {statusLabel[r.status]}
                  </span>
                  <span className="flex-1 text-foreground">{r.name}</span>
                  <span className="tabular-nums text-muted-foreground">{r.ms}ms</span>
                </div>
                {r.detail && (
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                )}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      r.status === "fail" ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{ width: `${Math.max(2, ((r.ms || 0) / slowest) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="mt-8">
          <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}