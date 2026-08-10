import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * CI wrapper for the §9.2 suite. It shells out to psql so the exact same script
 * can be run by hand against a local Supabase:
 *   psql "$INTEGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/integration/rls-suite.sql
 *
 * The suite needs a privileged connection (it seeds auth.users and asserts as
 * other roles), so it self-skips when only a restricted connection is present.
 */
const url = process.env.INTEGRATION_DATABASE_URL ?? "";
const suite = url ? describe : describe.skip;

suite("§9.2 RLS + trigger database suite", () => {
  it("all 15 checks pass and leave the database unchanged", () => {
    const out = execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", "tests/integration/rls-suite.sql"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(out).toContain("all 15 checks passed");
  });
});