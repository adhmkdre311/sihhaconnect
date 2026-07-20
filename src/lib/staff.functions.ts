import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Platform admin: approvals & organisations ----------

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).in("role", ["platform_admin", "super_admin"]).maybeSingle();
  if (!data) throw new Error("Not authorised");
}

export const listPendingStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: requests } = await supabaseAdmin
      .from("role_requests")
      .select("id, user_id, role, clinic_id, pharmacy_id, insurer_id, company_name, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const ids = (requests ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, phone_number, approved").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null; phone_number: string | null; approved: boolean }[] };
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    return (requests ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  });

export const approveStaffRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin.from("role_requests").select("*").eq("id", data.requestId).single();
    if (!req) throw new Error("Request not found");

    // Create the org (employer) if role is employer_admin
    let orgIds: { employer_id?: string | null; clinic_id?: string | null; pharmacy_id?: string | null; insurer_id?: string | null } = {
      clinic_id: req.clinic_id, pharmacy_id: req.pharmacy_id, insurer_id: req.insurer_id,
    };
    if (req.role === "employer_admin" && req.company_name) {
      const { data: emp } = await supabaseAdmin.from("employers").insert({ company_name: req.company_name }).select("id").single();
      orgIds.employer_id = emp?.id ?? null;
      if (orgIds.employer_id) {
        await supabaseAdmin.from("profiles").update({ employer_id: orgIds.employer_id }).eq("id", req.user_id);
      }
    }

    await supabaseAdmin.from("user_roles").upsert({
      user_id: req.user_id, role: req.role,
      employer_id: orgIds.employer_id ?? null,
      clinic_id: orgIds.clinic_id ?? null,
      pharmacy_id: orgIds.pharmacy_id ?? null,
      insurer_id: orgIds.insurer_id ?? null,
    }, { onConflict: "user_id,role" });

    const patch: Record<string, unknown> = { approved: true };
    if (orgIds.pharmacy_id) patch.pharmacy_id = orgIds.pharmacy_id;
    if (orgIds.insurer_id) patch.insurer_id = orgIds.insurer_id;
    if (orgIds.clinic_id) patch.clinic_id = orgIds.clinic_id;
    await supabaseAdmin.from("profiles").update(patch).eq("id", req.user_id);

    await supabaseAdmin.from("role_requests")
      .update({ status: "approved", reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", req.id);
    return { ok: true };
  });

export const denyStaffRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ requestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("role_requests")
      .update({ status: "denied", reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.requestId);
    return { ok: true };
  });

// ---------- Pharmacy / Insurer / Medication catalogue admin ----------

export const createPharmacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().min(1), area: z.string().optional(), address: z.string().optional(),
    phone: z.string().optional(), hours: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("pharmacies").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const createInsurer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("insurers").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const linkInsurerEmployer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    insurerId: z.string().uuid(), employerId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("insurer_employer_scope").upsert({ insurer_id: data.insurerId, employer_id: data.employerId });
    return { ok: true };
  });

export const addMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().min(1), generic_name: z.string().optional(),
    form: z.string().optional(), strength: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("medications").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

// ---------- Privileged role request (pharmacy/insurance staff signup) ----------

export const requestStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(["pharmacy_staff", "insurance_staff", "platform_admin"]),
    pharmacyId: z.string().uuid().optional(),
    insurerId: z.string().uuid().optional(),
    fullName: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.role === "pharmacy_staff" && !data.pharmacyId) throw new Error("pharmacy required");
    if (data.role === "insurance_staff" && !data.insurerId) throw new Error("insurer required");
    await supabase.from("profiles").upsert({ id: userId, full_name: data.fullName });
    const { data: row, error } = await supabaseAdmin.from("role_requests").insert({
      user_id: userId, role: data.role,
      pharmacy_id: data.pharmacyId ?? null, insurer_id: data.insurerId ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { requestId: row!.id };
  });

// ---------- Pharmacy staff: manage own stock ----------

async function myPharmacyId(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("pharmacy_id").eq("user_id", userId).eq("role", "pharmacy_staff").maybeSingle();
  return data?.pharmacy_id ?? null;
}

export const getMyPharmacyStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) return { pharmacy: null, stock: [] as { medication_id: string; in_stock: boolean; name: string; generic_name: string | null }[] };
    const { supabase } = context;
    const [{ data: pharmacy }, { data: meds }, { data: stock }] = await Promise.all([
      supabase.from("pharmacies").select("*").eq("id", pid).single(),
      supabase.from("medications").select("id, name, generic_name").order("name"),
      supabase.from("pharmacy_stock").select("medication_id, in_stock").eq("pharmacy_id", pid),
    ]);
    const stockMap = new Map((stock ?? []).map((s) => [s.medication_id, s.in_stock]));
    const rows = (meds ?? []).map((m) => ({
      medication_id: m.id, name: m.name, generic_name: m.generic_name,
      in_stock: stockMap.get(m.id) ?? false,
    }));
    return { pharmacy, stock: rows };
  });

export const setStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    medicationId: z.string().uuid(), inStock: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) throw new Error("Not linked to a pharmacy");
    const { supabase, userId } = context;
    const { error } = await supabase.from("pharmacy_stock").upsert({
      pharmacy_id: pid, medication_id: data.medicationId, in_stock: data.inStock,
      updated_by: userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Worker: medication search (availability only) ----------

export const searchMedicationAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.query.trim();
    const { data: meds } = await supabase
      .from("medications")
      .select("id, name, generic_name, form, strength")
      .or(`name.ilike.%${q}%,generic_name.ilike.%${q}%`)
      .limit(20);
    const results = await Promise.all(
      (meds ?? []).map(async (m) => {
        const { data: stock } = await supabase
          .from("pharmacy_stock")
          .select("in_stock, pharmacy_id, updated_at, pharmacies!inner(id, name, area, address, phone, hours)")
          .eq("medication_id", m.id).eq("in_stock", true).limit(20);
        return { medication: m, pharmacies: stock ?? [] };
      }),
    );
    return results;
  });

export const logPharmacyLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    medicationId: z.string().uuid(), pharmacyId: z.string().uuid().optional(), area: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("pharmacy_lookups").insert({
      medication_id: data.medicationId, pharmacy_id: data.pharmacyId ?? null, area: data.area ?? null,
    });
    return { ok: true };
  });

// ---------- Insurance staff: aggregated view ----------

export const getInsurerAggregates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles").select("insurer_id").eq("user_id", userId).eq("role", "insurance_staff").maybeSingle();
    if (!role?.insurer_id) return { insurer: null, rows: [] };
    const [{ data: insurer }, { data: rows }] = await Promise.all([
      supabase.from("insurers").select("*").eq("id", role.insurer_id).single(),
      supabase.from("insurer_employer_aggregates").select("*").eq("insurer_id", role.insurer_id),
    ]);
    return { insurer, rows: rows ?? [] };
  });

// ---------- Admin: list orgs (for linking/creating) ----------

export const listOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: pharmacies }, { data: insurers }, { data: employers }, { data: clinics }, { data: meds }, { data: links }] = await Promise.all([
      supabaseAdmin.from("pharmacies").select("id, name, area").order("name"),
      supabaseAdmin.from("insurers").select("id, name").order("name"),
      supabaseAdmin.from("employers").select("id, company_name, worker_count").order("company_name"),
      supabaseAdmin.from("clinics").select("id, name").order("name"),
      supabaseAdmin.from("medications").select("id, name, generic_name").order("name"),
      supabaseAdmin.from("insurer_employer_scope").select("insurer_id, employer_id"),
    ]);
    return { pharmacies: pharmacies ?? [], insurers: insurers ?? [], employers: employers ?? [], clinics: clinics ?? [], medications: meds ?? [], links: links ?? [] };
  });