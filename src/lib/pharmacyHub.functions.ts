import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myPharmacyId(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("pharmacy_id").eq("user_id", userId).eq("role", "pharmacy_staff").maybeSingle();
  return data?.pharmacy_id ?? null;
}

// ---------- E1: Inventory listing (availability directory only) ----------

export const listMyAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) return { pharmacy: null, rows: [] as { id: string; medication_name: string; in_stock: boolean; updated_at: string }[] };
    const { supabase } = context;
    const [{ data: pharmacy }, { data: rows }] = await Promise.all([
      supabase.from("pharmacies").select("id, name, area, address, phone, hours").eq("id", pid).single(),
      supabase.from("medication_availability")
        .select("id, medication_name, in_stock, updated_at")
        .eq("pharmacy_id", pid)
        .order("medication_name"),
    ]);
    return { pharmacy, rows: rows ?? [] };
  });

export const addAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) throw new Error("Not linked to a pharmacy");
    const { supabase, userId } = context;
    const { error } = await supabase.from("medication_availability").insert({
      pharmacy_id: pid, medication_name: data.name.trim(), in_stock: true, last_updated_by: userId,
    });
    if (error) {
      if (error.code === "23505" || /duplicate key/i.test(error.message)) {
        throw new Error(`“${data.name.trim()}” is already on your list.`);
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const setAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), inStock: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) throw new Error("Not linked to a pharmacy");
    const { supabase, userId } = context;
    const { error } = await supabase.from("medication_availability")
      .update({ in_stock: data.inStock, last_updated_by: userId })
      .eq("id", data.id).eq("pharmacy_id", pid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) throw new Error("Not linked to a pharmacy");
    const { error } = await context.supabase.from("medication_availability")
      .delete().eq("id", data.id).eq("pharmacy_id", pid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- E2: Visibility dashboard (foot-traffic signal) ----------

export const getPharmacyVisibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) return { events: [] as { created_at: string; medication_name: string | null }[] };
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data } = await context.supabase
      .from("availability_lookup_events")
      .select("created_at, medication_name")
      .eq("pharmacy_id", pid)
      .gte("created_at", since)
      .order("created_at");
    return { events: data ?? [] };
  });

// ---------- E3: Pharmacy settings ----------

export const updateMyPharmacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().trim().min(2).max(120),
    area: z.string().trim().max(120).optional(),
    address: z.string().trim().max(240).optional(),
    phone: z.string().trim().max(40).optional(),
    hours: z.string().trim().max(120).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const pid = await myPharmacyId(context.userId);
    if (!pid) throw new Error("Not linked to a pharmacy");
    const { error } = await context.supabase.from("pharmacies").update({
      name: data.name,
      area: data.area ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      hours: data.hours ?? null,
    }).eq("id", pid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Worker: availability search + lookup logging ----------

export const searchAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("medication_availability")
      .select("id, medication_name, in_stock, updated_at, pharmacies!inner(id, name, area, address, phone, hours)")
      .ilike("medication_name", `%${data.query}%`)
      .eq("in_stock", true)
      .limit(50);
    return { rows: rows ?? [] };
  });

export const logAvailabilityLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pharmacyId: z.string().uuid(),
    medicationName: z.string().trim().max(120).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("availability_lookup_events").insert({
      pharmacy_id: data.pharmacyId, medication_name: data.medicationName ?? null,
    });
    return { ok: true };
  });

// ---------- F1/F2: Insurer network overview (aggregated only) ----------

export const getNetworkOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles").select("insurer_id").eq("user_id", userId).eq("role", "insurance_staff").maybeSingle();
    const [{ data: insurer }, { data: rows }] = await Promise.all([
      role?.insurer_id
        ? supabase.from("insurers").select("id, name").eq("id", role.insurer_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("insurer_network_overview")
        .select("employer_id, company_name, workers_enrolled, checkups_completed, appointments_total, no_show_rate_pct"),
    ]);
    return { insurer, rows: rows ?? [] };
  });
