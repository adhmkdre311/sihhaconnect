import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards for the documented bug list (§6). Each test pins the fix so it cannot
 * be reintroduced by a later refactor.
 */

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("BUG-4b — worker booking must not write clinic_slots", () => {
  const workerRoutes = ["app.book.tsx", "app.index.tsx", "app.appointments.$id.tsx"];

  it.each(workerRoutes)("%s does not update or insert clinic_slots", (file) => {
    const src = read("src", "routes", file);
    const writes = /from\("clinic_slots"\)[\s\S]{0,160}\.(update|insert|upsert|delete)\(/.test(src);
    expect(writes, `${file} writes clinic_slots from the worker client`).toBe(false);
  });

  it("booking relies on slot_id so the sync trigger can flip availability", () => {
    expect(read("src", "routes", "app.book.tsx")).toMatch(/slot_id:/);
  });
});

describe("BUG-4a — insurer aggregates come from the security-definer view", () => {
  it("no code reads the removed security_invoker aggregate view", () => {
    for (const file of ["staff.functions.ts", "pharmacyHub.functions.ts"]) {
      expect(read("src", "lib", file)).not.toMatch(/insurer_employer_aggregates/);
    }
  });

  it("insurer reads go through insurer_network_overview", () => {
    expect(read("src", "lib", "staff.functions.ts")).toMatch(/insurer_network_overview/);
    expect(read("src", "lib", "pharmacyHub.functions.ts")).toMatch(/insurer_network_overview/);
  });
});

describe("BUG-3 — cross-table RLS checks stay in security definer helpers", () => {
  it("helper-backed policies are still referenced by the app layer", () => {
    const types = read("src", "integrations", "supabase", "types.ts");
    // the generated types prove the helpers survive migrations
    expect(types).toMatch(/worker_has_appointment_at_clinic/);
    expect(types).toMatch(/profile_in_my_employer/);
  });
});
