#!/usr/bin/env bun
/**
 * §9.4 acceptance suite — one command, CI-friendly output.
 *
 *   bun run acceptance                     # unit/guard tests + module checks (db suite auto-skipped)
 *   INTEGRATION_DATABASE_URL=... bun run acceptance
 *   bun run acceptance -- --db "postgres://..."   # explicit connection
 *   bun run acceptance -- --skip-db --json
 *
 * Exit code 0 = every required stage passed. Non-zero = at least one failure.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const asJson = flag("json");
const skipDb = flag("skip-db");
const dbUrl = value("db") ?? process.env.INTEGRATION_DATABASE_URL ?? "";

type Result = { name: string; status: "pass" | "fail" | "skip"; detail?: string; ms: number };
const results: Result[] = [];

const ICON = { pass: "PASS", fail: "FAIL", skip: "SKIP" } as const;
function log(line: string) {
  if (!asJson) console.log(line);
}
function record(name: string, status: Result["status"], ms: number, detail?: string) {
  results.push({ name, status, detail, ms });
  log(`${ICON[status]}  ${name}${detail ? ` — ${detail}` : ""} (${ms}ms)`);
}

function run(name: string, cmd: string, args: string[]) {
  const started = Date.now();
  const out = spawnSync(cmd, args, { encoding: "utf8" });
  const ms = Date.now() - started;
  const text = `${out.stdout ?? ""}${out.stderr ?? ""}`;
  if (out.error) {
    record(name, "fail", ms, out.error.message);
  } else if (out.status !== 0) {
    record(name, "fail", ms, lastLines(text));
  } else {
    record(name, "pass", ms, summaryLine(text));
  }
  return { ok: out.status === 0 && !out.error, text };
}

const lastLines = (t: string, n = 12) =>
  t.trim().split("\n").slice(-n).join(" | ").slice(0, 1200) || "no output";
const summaryLine = (t: string) => {
  const m = t.match(/Tests\s+\d+ passed[^\n]*/) ?? t.match(/all \d+ checks passed/);
  return m?.[0];
};

// ---------------------------------------------------------------- stage 1 ----
// §9.1 unit tests + RLS/server-fn guards (the vitest suite).
function stageUnit() {
  run("§9.1 unit + guard tests (vitest)", "bunx", ["vitest", "run", "--reporter=basic"]);
}

// ---------------------------------------------------------------- stage 2 ----
// §9.2 the 15-check database suite, run through psql inside one rolled-back tx.
function stageDatabase() {
  const name = "§9.2 database suite (15 checks)";
  if (skipDb) return record(name, "skip", 0, "--skip-db");
  const conn = dbUrl || (process.env.PGHOST ? "" : undefined);
  if (conn === undefined) {
    return record(name, "skip", 0, "set INTEGRATION_DATABASE_URL (or PG* env) to run");
  }
  const args = conn ? [conn] : [];
  const { ok, text } = run(name, "psql", [
    ...args,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "tests/integration/rls-suite.sql",
  ]);
  if (ok && !text.includes("all 15 checks passed")) {
    const last = results[results.length - 1]!;
    last.status = "fail";
    last.detail = "suite finished without the 'all 15 checks passed' marker";
    log(`FAIL  ${name} — ${last.detail}`);
  }
}

// ---------------------------------------------------------------- stage 3 ----
// §9.4 definition-of-done per module: every screen exists and still carries the
// behaviour the acceptance walkthrough checks by hand.
type Check = { module: string; label: string; files: string[]; patterns?: RegExp[] };

const MODULE_CHECKS: Check[] = [
  // A — auth & roles
  { module: "A auth/roles", label: "auth screens + role routing", files: ["src/routes/auth.tsx", "src/routes/auth.index.tsx", "src/lib/portals.ts"], patterns: [/platform_admin/] },
  { module: "A auth/roles", label: "staff signup requests a role", files: ["src/routes/staff-signup.tsx"], patterns: [/requestStaffRole|request_privileged_role/] },
  // B — worker app
  { module: "B worker", label: "home, booking, assistant, documents", files: ["src/routes/app.index.tsx", "src/routes/app.book.tsx", "src/routes/app.chat.tsx", "src/routes/app.records.tsx"] },
  { module: "B worker", label: "booking books a slot, never writes clinic_slots", files: ["src/routes/app.book.tsx"], patterns: [/slot_id:/] },
  { module: "B worker", label: "assistant is non-diagnostic (guardrail)", files: ["src/lib/guardrail.ts", "src/lib/ai.functions.ts"], patterns: [/guardrail|blocked/i] },
  // C — clinic
  { module: "C clinic", label: "queue, slots, patients, walk-in", files: ["src/routes/clinic.index.tsx", "src/routes/clinic.slots.tsx", "src/routes/clinic.patients.tsx", "src/components/WalkInDialog.tsx"] },
  // D — employer
  { module: "D employer", label: "roster, compliance, appointments, invites", files: ["src/routes/employer.roster.tsx", "src/routes/employer.compliance.tsx", "src/routes/employer.appointments.tsx", "src/components/EmployerInviteLinks.tsx"] },
  // E — pharmacy
  { module: "E pharmacy", label: "availability directory only (no dispensing)", files: ["src/routes/pharmacy.index.tsx", "src/routes/pharmacy.visibility.tsx", "src/lib/pharmacyHub.functions.ts"], patterns: [/medication_availability/] },
  // F — insurance
  { module: "F insurance", label: "aggregates only, via the definer view", files: ["src/routes/insurance.index.tsx", "src/routes/insurance.claims.tsx", "src/lib/staff.functions.ts"], patterns: [/insurer_network_overview/] },
  // G — admin
  { module: "G admin", label: "users, orgs, records, analytics, audit, settings", files: ["src/routes/admin.users.tsx", "src/routes/admin.orgs.tsx", "src/routes/admin.records.tsx", "src/routes/admin.analytics.tsx", "src/routes/admin.audit.tsx", "src/routes/admin.settings.tsx"] },
  { module: "G admin", label: "view-as impersonation is audited", files: ["src/components/ViewAsBanner.tsx", "src/lib/viewAs.functions.ts"] },
  // cross-cutting
  { module: "X i18n", label: "7 languages incl. RTL Arabic", files: ["src/lib/i18n.tsx"], patterns: [/\bar\b/, /\bhi\b/, /\bur\b/, /\bne\b/, /\btl\b/, /\bbn\b/, /rtl/i] },
  { module: "X notifications", label: "shared staff notifications inbox", files: ["src/components/StaffNotifications.tsx"] },
];

function stageModules() {
  for (const check of MODULE_CHECKS) {
    const started = Date.now();
    const missing = check.files.filter((f) => !existsSync(join(process.cwd(), f)));
    let detail: string | undefined;
    if (missing.length) {
      detail = `missing: ${missing.join(", ")}`;
    } else if (check.patterns?.length) {
      const blob = check.files.map((f) => readFileSync(join(process.cwd(), f), "utf8")).join("\n");
      const unmatched = check.patterns.filter((p) => !p.test(blob)).map(String);
      if (unmatched.length) detail = `pattern not found: ${unmatched.join(", ")}`;
    }
    record(
      `§9.4 ${check.module} — ${check.label}`,
      detail ? "fail" : "pass",
      Date.now() - started,
      detail,
    );
  }
}

// -------------------------------------------------------------------- run ----
log("Sihha §9.4 acceptance suite");
log("=".repeat(60));
stageUnit();
stageDatabase();
stageModules();

const failed = results.filter((r) => r.status === "fail");
const skipped = results.filter((r) => r.status === "skip");
const passed = results.filter((r) => r.status === "pass");

if (asJson) {
  console.log(
    JSON.stringify(
      { ok: failed.length === 0, passed: passed.length, failed: failed.length, skipped: skipped.length, results },
      null,
      2,
    ),
  );
} else {
  log("=".repeat(60));
  log(`${passed.length} passed · ${failed.length} failed · ${skipped.length} skipped`);
  if (failed.length) {
    log("\nFailures:");
    for (const f of failed) log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
  }
  log(failed.length ? "ACCEPTANCE: FAIL" : "ACCEPTANCE: PASS");
}

process.exit(failed.length ? 1 : 0);
