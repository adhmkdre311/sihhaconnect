import { execFileSync } from "node:child_process";

/**
 * Direct Postgres access for the §9.2 integration suite.
 *
 * Skipped automatically when no managed connection is present (PGHOST unset),
 * so the unit suite still runs on a bare checkout.
 */
export const HAS_PG = Boolean(process.env.PGHOST || process.env.DATABASE_URL);

export function sql(query: string): string[][] {
  const out = execFileSync("psql", ["-At", "-F", "\u0001", "-v", "ON_ERROR_STOP=1", "-c", query], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => l.split("\u0001"));
}

export function scalar(query: string): string | null {
  const rows = sql(query);
  return rows.length ? (rows[0][0] ?? null) : null;
}

export function count(query: string): number {
  return Number(scalar(query) ?? "0");
}

/** Runs `body` with RLS applied as the given user id (authenticated role). */
function claims(userId: string) {
  return `set local role authenticated; set local "request.jwt.claims" = '${JSON.stringify({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
  })}';`;
}

/** Runs a statement as the anonymous (unauthenticated) role. */
export function asAnon(query: string): string[][] {
  return sql(`begin; set local role anon; ${query}; rollback;`);
}

export function asUser(userId: string, query: string): string[][] {
  return sql(`begin; ${claims(userId)} ${query}; rollback;`);
}

export function countAsUser(userId: string, query: string): number {
  const rows = asUser(userId, `select count(*) from (${query}) q`);
  return Number(rows[rows.length - 1]?.[0] ?? "0");
}

export type PgError = { ok: false; message: string };

/** Executes a statement as a user, capturing a policy/permission refusal. */
export function tryAsUser(userId: string, query: string): { ok: true; rows: string[][] } | PgError {
  try {
    return { ok: true, rows: asUser(userId, query) };
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const message = String(e.stderr ?? e.message ?? err);
    return { ok: false, message };
  }
}

export function isPolicyViolation(message: string): boolean {
  return /row-level security|permission denied|violates row-level security policy|not authorized/i.test(message);
}