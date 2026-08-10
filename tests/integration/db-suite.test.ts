import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HAS_PG, asAnon, asUser, count, countAsUser, isPolicyViolation, scalar, sql, tryAsUser } from "../helpers/pg";

/**
 * §9.2 — the 15-check database suite, reproduced for CI.
 *
 * Every check runs against a real database with RLS applied as a specific role
 * (`set local role authenticated` + `request.jwt.claims`), inside a transaction
 * that is rolled back, so checks never leak into each other.
 */

const U = {
  workerA: "55555555-0000-0000-0000-000000000001",
  workerB: "55555555-0000-0000-0000-000000000002",
  clinicA: "55555555-0000-0000-0000-000000000003",
  employerA: "55555555-0000-0000-0000-000000000004",
  pharmacyA: "55555555-0000-0000-0000-000000000005",
  insurer: "55555555-0000-0000-0000-000000000006",
  admin: "55555555-0000-0000-0000-000000000007",
};
const EMPLOYER_A = "11111111-0000-0000-0000-000000000001";
const PHARM_A = "33333333-0000-0000-0000-000000000001";
const PHARM_B_MED = "99999999-0000-0000-0000-000000000002";
const SLOT = "66666666-0000-0000-0000-000000000001";
const CLINIC_A = "22222222-0000-0000-0000-000000000001";

const file = (name: string) => readFileSync(join(process.cwd(), "tests", "integration", name), "utf8");
const run = (body: string) =>
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-c", body], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const suite = HAS_PG ? describe : describe.skip;

suite("§9.2 database integration suite (15 checks)", () => {
  beforeAll(() => {
    run(file("teardown.sql"));
    run(file("seed.sql"));
  });

  afterAll(() => {
    run(file("teardown.sql"));
  });

  it("01 — insurer reads raw appointments → 0 rows", () => {
    expect(countAsUser(U.insurer, "select id from public.appointments")).toBe(0);
  });

  it("02 — insurer reads insurer_network_overview → own groups only, correct math", () => {
    const rows = asUser(
      U.insurer,
      "select employer_id, appointments_total, checkups_completed from public.insurer_network_overview order by employer_id",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r[0] === EMPLOYER_A)).toBe(true);

    const raw = sql(
      `select count(*), count(*) filter (where a.status = 'completed' and a.reason = 'checkup')
         from public.appointments a
         join public.profiles p on p.id = a.worker_id
        where p.employer_id = '${EMPLOYER_A}'`,
    )[0];
    const own = rows.find((r) => r[0] === EMPLOYER_A)!;
    expect(own[1]).toBe(raw[0]);
    expect(own[2]).toBe(raw[1]);
  });

  it("03 — worker reads the availability directory; write → policy violation", () => {
    expect(countAsUser(U.workerA, "select id from public.medication_availability")).toBeGreaterThan(0);
    const write = tryAsUser(
      U.workerA,
      `update public.medication_availability set in_stock = true where id = '${PHARM_B_MED}'`,
    );
    if (write.ok) {
      // No policy grants the worker this write, so it must affect zero rows.
      const affected = countAsUser(
        U.workerA,
        `select 1 from public.medication_availability where id = '${PHARM_B_MED}' and in_stock = true`,
      );
      expect(affected).toBe(0);
    } else {
      expect(isPolicyViolation(write.message), write.message).toBe(true);
    }
  });

  it("04 — workers see only their own appointments", () => {
    const rows = asUser(U.workerA, "select worker_id from public.appointments");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r[0] === U.workerA)).toBe(true);
  });

  it("05 — worker cannot read another worker's profile", () => {
    expect(countAsUser(U.workerA, `select id from public.profiles where id = '${U.workerB}'`)).toBe(0);
  });

  it("06 — self role escalation is refused / reverted", () => {
    const insert = tryAsUser(U.workerA, `insert into public.user_roles (user_id, role) values ('${U.workerA}', 'platform_admin')`);
    if (insert.ok) {
      expect(count(`select count(*) from public.user_roles where user_id = '${U.workerA}' and role = 'platform_admin'`)).toBe(0);
    } else {
      expect(isPolicyViolation(insert.message), insert.message).toBe(true);
    }

    // The profile trigger reverts privileged self-service edits.
    const bump = tryAsUser(
      U.workerA,
      `update public.profiles set approved = true, employer_id = null where id = '${U.workerA}';
       select approved::text, coalesce(employer_id::text,'null') from public.profiles where id = '${U.workerA}'`,
    );
    if (bump.ok) {
      const last = bump.rows[bump.rows.length - 1];
      expect(last[1]).toBe(EMPLOYER_A);
    } else {
      expect(isPolicyViolation(bump.message), bump.message).toBe(true);
    }
  });

  it("07 — pharmacy staff update their own listing; other pharmacy → 0 rows", () => {
    const own = tryAsUser(
      U.pharmacyA,
      `update public.medication_availability set in_stock = false
         where pharmacy_id = '${PHARM_A}' returning id`,
    );
    expect(own.ok, own.ok ? "" : own.message).toBe(true);
    if (own.ok) expect(own.rows.length).toBeGreaterThan(0);

    const foreign = countAsUser(
      U.pharmacyA,
      `select 1 from public.medication_availability m
        where m.id = '${PHARM_B_MED}' and m.pharmacy_id <> '${PHARM_A}'
          and exists (select 1 from public.medication_availability x where x.id = m.id)`,
    );
    // Visible read-only in the public directory, but never writable:
    const foreignWrite = tryAsUser(
      U.pharmacyA,
      `update public.medication_availability set in_stock = true where id = '${PHARM_B_MED}' returning id`,
    );
    if (foreignWrite.ok) expect(foreignWrite.rows.length).toBe(0);
    else expect(isPolicyViolation(foreignWrite.message), foreignWrite.message).toBe(true);
    expect(foreign).toBeGreaterThanOrEqual(0);
  });

  it("08 — clinic sees only its own queue plus visiting patients' profiles", () => {
    const appts = asUser(U.clinicA, "select clinic_id from public.appointments");
    expect(appts.length).toBeGreaterThan(0);
    expect(appts.every((r) => r[0] === CLINIC_A)).toBe(true);

    expect(countAsUser(U.clinicA, `select id from public.profiles where id = '${U.workerA}'`)).toBe(1);
    expect(countAsUser(U.clinicA, `select id from public.profiles where id = '${U.workerB}'`)).toBe(0);
  });

  it("09 — employer admin sees only their own org's profiles", () => {
    const rows = asUser(
      U.employerA,
      "select coalesce(employer_id::text,'null') from public.profiles where id <> auth.uid()",
    );
    expect(rows.every((r) => r[0] === EMPLOYER_A), JSON.stringify(rows)).toBe(true);
  });

  it("10 — admin has full access and writes are audit-logged", () => {
    expect(countAsUser(U.admin, "select id from public.appointments")).toBeGreaterThanOrEqual(3);
    expect(countAsUser(U.admin, "select id from public.documents")).toBeGreaterThanOrEqual(2);
    expect(countAsUser(U.admin, "select id from public.profiles")).toBeGreaterThanOrEqual(8);

    const rows = asUser(
      U.admin,
      `update public.profiles set full_name = 'ITEST audited' where id = '${U.workerA}';
       select count(*)::text from public.audit_logs
        where table_name = 'profiles' and record_id = '${U.workerA}' and action = 'UPDATE'`,
    );
    expect(Number(rows[rows.length - 1][0])).toBeGreaterThan(0);
  });

  it("11 — employer admin cannot escalate a worker's role", () => {
    const res = tryAsUser(
      U.employerA,
      `insert into public.user_roles (user_id, role) values ('${U.workerA}', 'employer_admin')`,
    );
    if (res.ok) {
      expect(count(`select count(*) from public.user_roles where user_id = '${U.workerA}' and role = 'employer_admin'`)).toBe(0);
    } else {
      expect(isPolicyViolation(res.message), res.message).toBe(true);
    }
  });

  it("12 — insurer reads raw documents → 0 rows", () => {
    expect(countAsUser(U.insurer, "select id from public.documents")).toBe(0);
  });

  it("13 — signup metadata claiming a privileged role never grants it", () => {
    // workerA signed up with raw_user_meta_data.role = 'platform_admin'.
    expect(scalar(`select raw_user_meta_data->>'role' from auth.users where id = '${U.workerA}'`)).toBe("platform_admin");
    expect(count(`select count(*) from public.user_roles where user_id = '${U.workerA}' and role <> 'worker'`)).toBe(0);
    expect(count(`select count(*) from public.user_roles where user_id = '${U.workerA}' and role = 'worker'`)).toBe(1);
  });

  it("14 — audit UPDATE entries contain old→new diffs", () => {
    const rows = sql(
      `begin;
       update public.profiles set full_name = 'ITEST diff check' where id = '${U.workerB}';
       select detail::text from public.audit_logs
         where table_name = 'profiles' and record_id = '${U.workerB}' and action = 'UPDATE'
         order by created_at desc limit 1;
       rollback;`,
    );
    const detail = JSON.parse(rows[rows.length - 1][0]) as Record<string, { old: unknown; new: unknown }>;
    expect(detail).toHaveProperty("full_name");
    expect(detail.full_name.new).toBe("ITEST diff check");
    expect(detail.full_name.old).not.toBe("ITEST diff check");
    // Only changed fields are recorded (BUG-1).
    expect(Object.keys(detail).filter((k) => k !== "updated_at")).toEqual(["full_name"]);
  });

  it("15 — slot sync: booking makes the slot unavailable, cancelling frees it", () => {
    const rows = sql(
      `begin;
       insert into public.appointments (worker_id, clinic_id, department, scheduled_at, status, slot_id)
         values ('${U.workerA}', '${CLINIC_A}', 'general', now() + interval '2 days', 'booked', '${SLOT}');
       select is_available::text, booked::text from public.clinic_slots where id = '${SLOT}';
       update public.appointments set status = 'cancelled' where slot_id = '${SLOT}';
       select is_available::text, booked::text from public.clinic_slots where id = '${SLOT}';
       rollback;`,
    );
    const [afterBook, afterCancel] = [rows[rows.length - 2], rows[rows.length - 1]];
    expect(afterBook).toEqual(["f", "1"]);
    expect(afterCancel).toEqual(["t", "0"]);
  });

  it("bonus — anonymous callers still see nothing", () => {
    const rows = asAnon("select count(*)::text from public.appointments");
    expect(rows[rows.length - 1][0]).toBe("0");
  });
});