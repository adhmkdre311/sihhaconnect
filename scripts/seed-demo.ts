/**
 * One-command demo seed / reset (§10 "Seed demo accounts").
 *
 *   bun run seed:demo            # idempotent seed (safe to re-run)
 *   bun run seed:demo -- --reset # delete the 6 demo accounts, then re-create them
 *
 * Safety rails (this script never touches real tenant data):
 *  - only the six fixed demo emails and the four fixed demo org ids are written;
 *    --reset deletes accounts by exact demo email match only.
 *  - refuses to run when NODE_ENV=production, or against a URL listed in
 *    SEED_BLOCKED_URLS, unless --i-know-what-im-doing is passed.
 *  - requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment;
 *    it never reads or prints them.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "SihhaDemo#2026";

const EMPLOYER_ID = "d0000000-0000-4000-8000-000000000001";
const CLINIC_ID = "d0000000-0000-4000-8000-000000000002";
const PHARMACY_ID = "d0000000-0000-4000-8000-000000000003";
const INSURER_ID = "d0000000-0000-4000-8000-000000000004";

type DemoUser = {
  email: string;
  full_name: string;
  role: string;
  language: string;
  employer_id?: string;
  clinic_id?: string;
  pharmacy_id?: string;
  insurer_id?: string;
};

const DEMO_USERS: DemoUser[] = [
  { email: "admin@sihha.qa", full_name: "Sihha Platform Admin", role: "platform_admin", language: "en" },
  { email: "suman@worker.sihha.qa", full_name: "Suman Tamang", role: "worker", language: "ne", employer_id: EMPLOYER_ID },
  { email: "fatima@alwathba.qa", full_name: "Fatima Al Wathba", role: "employer_admin", language: "ar", employer_id: EMPLOYER_ID },
  { email: "desk@alrayyanclinic.qa", full_name: "Al Rayyan Front Desk", role: "clinic_staff", language: "en", clinic_id: CLINIC_ID },
  { email: "anjali@alnasrpharmacy.qa", full_name: "Anjali Nair", role: "pharmacy_staff", language: "en", pharmacy_id: PHARMACY_ID },
  { email: "khalid@qlm.qa", full_name: "Khalid Al Marri", role: "insurance_staff", language: "ar", insurer_id: INSURER_ID },
];

const DEMO_EMAILS = new Set(DEMO_USERS.map((u) => u.email));

function envFromFile(key: string): string | undefined {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i > 0 && t.slice(0, i) === key) return t.slice(i + 1).replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env in CI */
  }
  return undefined;
}

function die(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const FORCE = args.includes("--i-know-what-im-doing");

const SUPABASE_URL = process.env.SUPABASE_URL ?? envFromFile("SUPABASE_URL") ?? envFromFile("VITE_SUPABASE_URL");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) die("SUPABASE_URL is not set (and no .env fallback found).");
if (!SERVICE_ROLE_KEY) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY is not set. This script needs admin access to create accounts; " +
      "run it in an environment where that key is injected.",
  );
}
if (process.env.NODE_ENV === "production" && !FORCE) {
  die("Refusing to seed demo accounts with NODE_ENV=production. Pass --i-know-what-im-doing to override.");
}
const blocked = (process.env.SEED_BLOCKED_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (blocked.some((b) => SUPABASE_URL.includes(b)) && !FORCE) {
  die("This backend URL is listed in SEED_BLOCKED_URLS. Pass --i-know-what-im-doing to override.");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findDemoUsers() {
  const found = new Map<string, string>(); // email -> id
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die(`Could not list accounts: ${error.message}`);
    for (const u of data.users) {
      if (u.email && DEMO_EMAILS.has(u.email)) found.set(u.email, u.id);
    }
    if (data.users.length < 200) break;
  }
  return found;
}

async function seedOrgs() {
  const steps: Array<Promise<{ error: { message: string } | null }>> = [
    admin.from("employers").upsert(
      {
        id: EMPLOYER_ID,
        company_name: "Al Wathba Trading & Contracting",
        industry: "Construction",
        contact_email: "fatima@alwathba.qa",
        subscription_tier: "pilot",
        invite_code: "WATHBA26",
      } as never,
      { onConflict: "id" },
    ),
    admin.from("clinics").upsert(
      {
        id: CLINIC_ID,
        name: "Al Rayyan Clinic",
        address: "Al Rayyan, Doha",
        phone: "+974 4000 1002",
        departments: ["general", "dental", "orthopaedics"],
        languages_supported_onsite: ["en", "ar", "hi", "ne"],
      } as never,
      { onConflict: "id" },
    ),
    admin.from("pharmacies").upsert(
      {
        id: PHARMACY_ID,
        name: "Al Nasr Pharmacy",
        area: "Al Nasr",
        address: "Al Nasr Street, Doha",
        phone: "+974 4000 1003",
        hours: "08:00-23:00",
      } as never,
      { onConflict: "id" },
    ),
    admin.from("insurers").upsert(
      { id: INSURER_ID, name: "QLM Life & Medical Insurance" } as never,
      { onConflict: "id" },
    ),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) die(`Demo organisation seed failed: ${error.message}`);
  }
  const { error: scopeError } = await admin
    .from("insurer_employer_scope")
    .upsert({ insurer_id: INSURER_ID, employer_id: EMPLOYER_ID } as never, {
      onConflict: "insurer_id,employer_id",
    });
  if (scopeError) die(`Insurer scope link failed: ${scopeError.message}`);
  console.log("• demo organisations ready (employer, clinic, pharmacy, insurer + insurer scope)");
}

async function seedUser(u: DemoUser, existingId: string | undefined) {
  let userId = existingId;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, preferred_language: u.language },
    });
    if (error) die(`Could not update ${u.email}: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, preferred_language: u.language },
    });
    if (error || !data.user) die(`Could not create ${u.email}: ${error?.message ?? "unknown error"}`);
    userId = data.user.id;
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: u.full_name,
      email: u.email,
      preferred_language: u.language,
      approved: true,
      is_active: true,
      consent_accepted_at: new Date().toISOString(),
      employer_id: u.employer_id ?? null,
      clinic_id: u.clinic_id ?? null,
      pharmacy_id: u.pharmacy_id ?? null,
      insurer_id: u.insurer_id ?? null,
    } as never,
    { onConflict: "id" },
  );
  if (profileError) die(`Profile for ${u.email} failed: ${profileError.message}`);

  const { data: role } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", u.role as never)
    .maybeSingle();
  if (!role) {
    const { error } = await admin.from("user_roles").insert({
      user_id: userId,
      role: u.role,
      employer_id: u.employer_id ?? null,
      clinic_id: u.clinic_id ?? null,
      pharmacy_id: u.pharmacy_id ?? null,
      insurer_id: u.insurer_id ?? null,
    } as never);
    if (error) die(`Role for ${u.email} failed: ${error.message}`);
  }

  if (u.role === "clinic_staff") {
    const { error } = await admin.from("clinic_staff_permissions").upsert(
      {
        user_id: userId,
        clinic_id: CLINIC_ID,
        can_view_queue: true,
        can_edit_slots: true,
        can_add_documents: true,
        can_manage_staff: true,
      } as never,
      { onConflict: "user_id,clinic_id" },
    );
    if (error) die(`Clinic desk permissions failed: ${error.message}`);
  }

  console.log(`• ${u.email.padEnd(26)} ${u.role.padEnd(16)} ${existingId ? "updated" : "created"}`);
}

async function main() {
  const host = new URL(SUPABASE_URL!).host;
  console.log(`\nSihha demo seed → ${host}${RESET ? "  (reset mode)" : ""}\n`);

  await seedOrgs();

  if (RESET) {
    const existing = await findDemoUsers();
    for (const [email, id] of existing) {
      if (!DEMO_EMAILS.has(email)) continue; // belt and braces
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) die(`Could not delete ${email}: ${error.message}`);
      console.log(`• removed ${email}`);
    }
  }

  const existing = await findDemoUsers();
  for (const u of DEMO_USERS) {
    await seedUser(u, existing.get(u.email));
  }

  console.log(`\n✔ 6 demo accounts ready. Password: ${DEMO_PASSWORD}\n`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));