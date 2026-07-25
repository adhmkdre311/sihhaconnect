import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["platform_admin", "super_admin"]).maybeSingle();
  if (!data) throw new Error("Not authorised");
}

const AUDIENCES = ["all", "workers", "employers", "clinics", "pharmacies"] as const;

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    status: z.enum(["all", "published", "draft"]).default("all"),
    audience: z.enum(["any", ...AUDIENCES]).default("any"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("announcements")
      .select("id, title, body, audience, employer_id, published, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (data.status === "published") q = q.eq("published", true);
    if (data.status === "draft") q = q.eq("published", false);
    if (data.audience !== "any") q = q.eq("audience", data.audience);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const empIds = Array.from(new Set((rows ?? []).map((r) => r.employer_id).filter(Boolean) as string[]));
    const { data: emps } = empIds.length
      ? await supabaseAdmin.from("employers").select("id, company_name").in("id", empIds)
      : { data: [] as { id: string; company_name: string }[] };
    const byId = new Map((emps ?? []).map((e) => [e.id, e.company_name]));
    return (rows ?? []).map((r) => ({ ...r, employer_name: r.employer_id ? byId.get(r.employer_id) ?? null : null }));
  });

export const createAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
    audience: z.enum(AUDIENCES),
    employerId: z.string().uuid().nullable().optional(),
    publish: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const employer_id = data.audience === "workers" ? (data.employerId ?? null) : null;
    const { data: row, error } = await supabaseAdmin.from("announcements").insert({
      title: data.title, body: data.body, audience: data.audience,
      employer_id, published: data.publish, created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const setAnnouncementPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(), published: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements")
      .update({ published: data.published }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
    audience: z.enum(AUDIENCES),
    employerId: z.string().uuid().nullable().optional(),
    published: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const employer_id = data.audience === "workers" ? (data.employerId ?? null) : null;
    const { error } = await supabaseAdmin.from("announcements").update({
      title: data.title, body: data.body, audience: data.audience,
      employer_id, published: data.published,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmployersLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("employers").select("id, company_name").order("company_name");
    return data ?? [];
  });