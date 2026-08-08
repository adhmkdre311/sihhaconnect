// M5 server-only helpers: front-desk lookup of a walk-in worker.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WalkInMatch = { id: string; full_name: string | null; phone_number: string | null; preferred_language: string | null };

export async function findWorkerByContact(query: string): Promise<WalkInMatch[]> {
  const q = query.trim();
  if (q.length < 4) return [];
  const digits = q.replace(/[^\d]/g, "");
  const filters = [`email.ilike.%${q}%`, `full_name.ilike.%${q}%`];
  if (digits.length >= 5) filters.push(`phone_number.ilike.%${digits}%`);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone_number, preferred_language, is_active")
    .or(filters.join(","))
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((p) => p.is_active)
    .map(({ id, full_name, phone_number, preferred_language }) => ({ id, full_name, phone_number, preferred_language }));
}
