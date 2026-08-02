import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Postgres error codes that mean "the database refused this request". */
export const DENIED_CODES = ["42501", "42883", "PGRST301", "PGRST302", "PGRST202"];

export function isDenied(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && DENIED_CODES.includes(error.code)) return true;
  const m = (error.message ?? "").toLowerCase();
  return (
    m.includes("permission denied") ||
    m.includes("row-level security") ||
    m.includes("violates row-level security policy") ||
    m.includes("jwt") ||
    m.includes("not authorized")
  );
}