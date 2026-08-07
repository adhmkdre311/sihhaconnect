import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static regression guards for server functions.
 *
 * These catch privilege-escalation regressions that a database test cannot see:
 * a server function losing its auth middleware, trusting a client-supplied
 * user/tenant id, or reaching for the RLS-bypassing admin client without first
 * verifying the caller.
 */

const LIB_DIR = join(process.cwd(), "src", "lib");

const functionFiles = readdirSync(LIB_DIR)
  .filter((f) => f.endsWith(".functions.ts"))
  .map((f) => ({ file: f, source: readFileSync(join(LIB_DIR, f), "utf8") }));

type ServerFn = { file: string; name: string; body: string; hasAuth: boolean };

function parseServerFns(file: string, source: string): ServerFn[] {
  const out: ServerFn[] = [];
  const re = /export const (\w+) = createServerFn\(/g;
  const starts: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) starts.push({ name: m[1], index: m.index });
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : source.length;
    const body = source.slice(s.index, end);
    out.push({
      file,
      name: s.name,
      body,
      hasAuth: /\.middleware\(\[[^\]]*requireSupabaseAuth/.test(body),
    });
  });
  return out;
}

const serverFns = functionFiles.flatMap(({ file, source }) => parseServerFns(file, source));

/**
 * Server functions intentionally callable without a session.
 * Anything added here must expose no tenant or personal data.
 */
const PUBLIC_SERVER_FNS = new Set(["listClinicDirectory", "listStaffOrgDirectory", "sendEmail"]);

describe("server function auth guards", () => {
  it("discovers the server functions", () => {
    expect(serverFns.length).toBeGreaterThan(30);
  });

  it("every server function is either authenticated or explicitly allowlisted", () => {
    const unguarded = serverFns
      .filter((fn) => !fn.hasAuth && !PUBLIC_SERVER_FNS.has(fn.name))
      .map((fn) => `${fn.file}:${fn.name}`);
    expect(unguarded, "unauthenticated server functions found").toEqual([]);
  });

  it("allowlisted public server functions still exist (stale allowlist guard)", () => {
    const names = new Set(serverFns.map((fn) => fn.name));
    for (const name of PUBLIC_SERVER_FNS) expect(names.has(name), `${name} no longer exists`).toBe(true);
  });

  it("public server functions do not read personal or tenant tables", () => {
    const sensitive = /from\("(profiles|user_roles|appointments|documents|chat_messages|claims|notifications|role_requests|clinic_staff_permissions|clinic_invites|employers)"\)/;
    for (const fn of serverFns.filter((f) => PUBLIC_SERVER_FNS.has(f.name))) {
      expect(sensitive.test(fn.body), `${fn.file}:${fn.name} touches a sensitive table without auth`).toBe(false);
    }
  });

  it("no server function derives the caller identity from client input", () => {
    // The caller identity must come from context.userId (verified bearer token).
    const offenders = serverFns
      .filter((fn) => /data\.(actorId|callerId|currentUserId|authUserId|myUserId)\b/.test(fn.body))
      .map((fn) => `${fn.file}:${fn.name}`);
    expect(offenders, "server function trusts a client-supplied caller identity").toEqual([]);
  });

  it("authenticated server functions read the caller id from context", () => {
    const offenders = serverFns
      .filter((fn) => fn.hasAuth && !/\buserId\b/.test(fn.body) && !/\bcontext\b/.test(fn.body))
      .map((fn) => `${fn.file}:${fn.name}`);
    expect(offenders, "authenticated server function ignores the verified caller context").toEqual([]);
  });

  it("admin (RLS-bypassing) client is only loaded via dynamic import inside handlers", () => {
    for (const { file, source } of functionFiles) {
      const staticImport = /^\s*import\s+[^;]*client\.server["']/m.test(source);
      expect(staticImport, `${file} statically imports the admin client`).toBe(false);
    }
  });

  it("server functions that use the admin client verify the caller first", () => {
    const offenders = serverFns
      .filter((fn) => /supabaseAdmin/.test(fn.body) && !PUBLIC_SERVER_FNS.has(fn.name))
      .filter((fn) => !fn.hasAuth)
      .map((fn) => `${fn.file}:${fn.name}`);
    expect(offenders, "admin client used without auth middleware").toEqual([]);
  });
});

describe("role protection guards", () => {
  const roleWriters = serverFns.filter((fn) =>
    /from\("user_roles"\)\s*\.\s*(insert|upsert|update|delete)|from\("user_roles"\)[\s\S]{0,80}\.(insert|upsert|update|delete)\(/.test(
      fn.body,
    ),
  );

  it("role grants never happen through the caller's RLS client", () => {
    for (const fn of roleWriters) {
      const writesViaUserClient = /(?<!Admin)\bsupabase\s*\n?\s*\.from\("user_roles"\)[\s\S]{0,120}\.(insert|upsert|update|delete)\(/.test(
        fn.body,
      );
      expect(writesViaUserClient, `${fn.file}:${fn.name} writes user_roles with the user client`).toBe(false);
    }
  });

  it("self-service bootstrap never grants a privileged role", () => {
    const privileged = /role:\s*"(platform_admin|super_admin|employer_admin|clinic_staff|pharmacy_staff|insurance_staff)"/;
    for (const fn of serverFns.filter((f) => /^bootstrap/.test(f.name))) {
      expect(privileged.test(fn.body), `${fn.file}:${fn.name} self-grants a privileged role`).toBe(false);
    }
  });

  it("privileged role grants are gated on a platform-admin check", () => {
    const grantFns = serverFns.filter((fn) =>
      /role:\s*(request|req|r)\.role|role:\s*"(platform_admin|employer_admin|clinic_staff|pharmacy_staff|insurance_staff)"/.test(
        fn.body,
      ),
    );
    for (const fn of grantFns) {
      // Legitimate gates: a platform-admin check, or a single-use invite token
      // that the inviting organisation issued and the server validates.
      const gated =
        /is_admin|platform_admin|assertAdmin|requireAdmin/.test(fn.body) ||
        /clinic_invites[\s\S]{0,400}(token|expires_at|status)/.test(fn.body);
      expect(gated, `${fn.file}:${fn.name} grants a role without an admin or invite check`).toBe(true);
    }
  });
});

describe("client-side auth wiring", () => {
  const start = readFileSync(join(process.cwd(), "src", "start.ts"), "utf8");

  it("registers bearer-token function middleware", () => {
    expect(start).toMatch(/functionMiddleware:\s*\[[^\]]*attachSupabaseAuth/);
  });

  it("auth middleware rejects requests without a valid bearer token", () => {
    const mw = readFileSync(
      join(process.cwd(), "src", "integrations", "supabase", "auth-middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/No authorization header provided/);
    expect(mw).toMatch(/Only Bearer tokens are supported/);
    expect(mw).toMatch(/getClaims/);
    expect(mw).toMatch(/persistSession: false/);
  });
});