import { describe, expect, it, beforeAll } from "vitest";
import { anonClient, isDenied } from "./helpers/clients";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./helpers/env";

/**
 * Regression tests for the anonymous (unauthenticated) role.
 *
 * Contract: an anonymous caller must never be able to read tenant data and must
 * never be able to write to any table, regardless of RLS policy refactors.
 */

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// Tables that hold tenant / personal / operational data. Anonymous callers may
// receive either a permission error (no GRANT) or an empty set (RLS filters all
// rows) -- never actual rows.
const NO_ANON_ROWS_TABLES = [
  "profiles",
  "user_roles",
  "appointments",
  "documents",
  "chat_messages",
  "chat_rate_limits",
  "clinics",
  "clinic_slots",
  "clinic_staff_permissions",
  "clinic_invites",
  "employers",
  "claims",
  "insurers",
  "insurer_employer_scope",
  "notifications",
  "announcements",
  "audit_logs",
  "role_requests",
  "platform_settings",
  "pharmacy_stock",
  "pharmacy_lookups",
] as const;

// Writes that must always be refused for anonymous callers.
const ANON_WRITE_PROBES: Array<{ table: string; row: Record<string, unknown> }> = [
  { table: "user_roles", row: { user_id: NIL_UUID, role: "platform_admin" } },
  { table: "profiles", row: { id: NIL_UUID, full_name: "rls-probe" } },
  { table: "clinics", row: { name: "rls-probe", departments: [], languages_supported_onsite: [] } },
  { table: "clinic_slots", row: { clinic_id: NIL_UUID, department: "general", slot_at: new Date().toISOString() } },
  { table: "appointments", row: { worker_id: NIL_UUID, clinic_id: NIL_UUID, department: "general", scheduled_at: new Date().toISOString() } },
  { table: "documents", row: { worker_id: NIL_UUID, type: "other" } },
  { table: "chat_messages", row: { worker_id: NIL_UUID, role: "user", content: "rls-probe" } },
  { table: "employers", row: { company_name: "rls-probe" } },
  { table: "claims", row: { claim_ref: "rls-probe", insurer_id: NIL_UUID, service_date: "2026-01-01", amount: 1 } },
  { table: "announcements", row: { title: "rls-probe", body: "rls-probe", audience: "all_workers" } },
  { table: "audit_logs", row: { action: "rls-probe" } },
  { table: "platform_settings", row: { key: "rls-probe", value: {} } },
  { table: "role_requests", row: { user_id: NIL_UUID, role: "platform_admin" } },
  { table: "clinic_staff_permissions", row: { user_id: NIL_UUID, clinic_id: NIL_UUID, can_manage_staff: true } },
];

// SECURITY DEFINER helpers / RPCs must not be executable by anon.
const NO_ANON_RPCS: Array<{ fn: string; args: Record<string, unknown> }> = [
  { fn: "is_admin", args: {} },
  { fn: "my_role", args: {} },
  { fn: "my_employer_id", args: {} },
  { fn: "my_clinic_id", args: {} },
  { fn: "current_employer_id", args: {} },
  { fn: "current_clinic_id", args: {} },
  { fn: "has_role", args: { _user_id: NIL_UUID, _role: "platform_admin" } },
  { fn: "is_approved", args: { _uid: NIL_UUID } },
  { fn: "has_clinic_perm", args: { _perm: "can_manage_staff" } },
  { fn: "can_manage_clinic", args: { _clinic: NIL_UUID } },
  { fn: "request_privileged_role", args: { _role: "employer_admin", _clinic_id: null, _company_name: "rls-probe" } },
  { fn: "send_broadcast", args: { _title: "rls-probe", _body: "rls-probe" } },
  { fn: "purge_old_documents", args: {} },
];

describe("anonymous role RLS regressions", () => {
  beforeAll(() => {
    expect(SUPABASE_URL, "SUPABASE_URL must be available to run RLS tests").toBeTruthy();
    expect(SUPABASE_PUBLISHABLE_KEY, "publishable key must be available").toBeTruthy();
  });

  it.each(NO_ANON_ROWS_TABLES)("anon cannot read rows from %s", async (table) => {
    const { data, error } = await anonClient().from(table).select("*").limit(1);
    if (error) {
      expect(isDenied(error), `${table}: unexpected error ${error.code} ${error.message}`).toBe(true);
      return;
    }
    expect(data ?? [], `${table} leaked rows to an anonymous caller`).toHaveLength(0);
  });

  it.each(ANON_WRITE_PROBES.map((p) => [p.table, p.row] as const))(
    "anon cannot insert into %s",
    async (table, row) => {
      const { error } = await anonClient().from(table).insert(row as never);
      expect(error, `anonymous insert into ${table} was accepted`).not.toBeNull();
      expect(isDenied(error), `${table}: ${error?.code} ${error?.message}`).toBe(true);
    },
  );

  it.each(ANON_WRITE_PROBES.map((p) => p.table))("anon cannot delete rows from %s", async (table) => {
    // Deleting everything the anon role can see: must remove zero rows.
    const { data, error } = await anonClient()
      .from(table)
      .delete()
      .not("created_at", "is", null)
      .select();
    if (!error) {
      expect(data ?? [], `anonymous delete removed rows from ${table}`).toHaveLength(0);
    }
  });

  it.each(NO_ANON_RPCS.map((r) => [r.fn, r.args] as const))(
    "anon cannot execute %s()",
    async (fn, args) => {
      const { error } = await anonClient().rpc(fn, args as never);
      expect(error, `anonymous execute of ${fn}() was accepted`).not.toBeNull();
      expect(isDenied(error), `${fn}: ${error?.code} ${error?.message}`).toBe(true);
    },
  );
});