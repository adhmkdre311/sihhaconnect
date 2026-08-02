import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Reads project .env without extra deps (no dotenv in the app runtime). */
export function loadEnvFile(file = ".env"): Record<string, string> {
  let raw = "";
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1).replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = loadEnvFile();

export const SUPABASE_URL =
  process.env.SUPABASE_URL ?? fileEnv.SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  fileEnv.SUPABASE_PUBLISHABLE_KEY ??
  fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";