import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Admin = SupabaseClient<Database>;

export async function adminClient(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

export async function assertPlatformAdmin(userId: string): Promise<Admin> {
  const db = await adminClient();
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["platform_admin", "super_admin"])
    .maybeSingle();
  if (!data) throw new Error("Not authorised");
  return db;
}

export async function audit(
  db: Admin,
  actorId: string,
  action: string,
  table: string,
  recordId: string | null,
  detail: Record<string, unknown>,
) {
  await db.from("audit_logs").insert({
    actor_id: actorId,
    action,
    table_name: table,
    record_id: recordId,
    detail: detail as never,
  });
}

export function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function lastWeeks(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  now.setUTCDate(now.getUTCDate() - day);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export type RecordRow = { id: string; when: string; status: string; a: string; b: string; c: string };

export function filterRows(rows: RecordRow[], search?: string): RecordRow[] {
  const term = search?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) => `${r.a} ${r.b} ${r.c} ${r.status}`.toLowerCase().includes(term));
}

export async function nameMap(db: Admin, ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email || "—"]));
}

function unusedLastWeeks(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  now.setUTCDate(now.getUTCDate() - day);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}