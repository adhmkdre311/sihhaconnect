/**
 * Publishes acceptance-summary.json into the acceptance_runs table so the
 * /tests dashboard shows persisted counts and timings across reloads.
 *
 *   bun run acceptance:publish            (after `bun run acceptance -- --json`)
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2] ?? "acceptance-summary.json";
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const summary = JSON.parse(readFileSync(file, "utf8")) as {
  ok: boolean;
  passed: number;
  failed: number;
  skipped: number;
  results: { name: string; status: string; detail?: string; ms: number }[];
};

const totalMs = summary.results.reduce((sum, r) => sum + (r.ms || 0), 0);
const db = createClient(url, key, { auth: { persistSession: false } });
const { error } = await db.from("acceptance_runs").insert({
  ok: summary.ok,
  passed: summary.passed,
  failed: summary.failed,
  skipped: summary.skipped,
  total_ms: totalMs,
  source: process.env.GITHUB_ACTIONS ? "ci" : "local",
  results: summary.results,
});
if (error) {
  console.error(`Publish failed: ${error.message}`);
  process.exit(1);
}
console.log(`Published run: ${summary.passed} passed · ${summary.failed} failed · ${summary.skipped} skipped`);
