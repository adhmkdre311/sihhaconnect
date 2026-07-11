import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const bootstrapWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    fullName: z.string().min(1),
    phoneNumber: z.string().min(4),
    preferredLanguage: z.enum(["en","ar","hi","ur","ne","tl","bn"]),
    inviteCode: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let employerId: string | null = null;
    if (data.inviteCode) {
      const { data: emp } = await supabaseAdmin
        .from("employers").select("id").eq("invite_code", data.inviteCode.trim()).maybeSingle();
      if (emp) employerId = emp.id;
    }

    await supabase.from("profiles").upsert({
      id: userId, full_name: data.fullName, phone_number: data.phoneNumber,
      preferred_language: data.preferredLanguage, employer_id: employerId,
    });

    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId, role: "worker", employer_id: employerId,
    }, { onConflict: "user_id,role" });

    if (employerId) {
      await supabaseAdmin.rpc("exec_sql" as never).then(() => undefined).catch(() => undefined);
      // increment worker_count manually
      const { data: emp2 } = await supabaseAdmin.from("employers").select("worker_count").eq("id", employerId).single();
      if (emp2) await supabaseAdmin.from("employers").update({ worker_count: (emp2.worker_count ?? 0) + 1 }).eq("id", employerId);
    }
    return { ok: true, employerId };
  });

export const bootstrapEmployer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    companyName: z.string().min(1),
    industry: z.string().optional(),
    fullName: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: emp, error } = await supabaseAdmin.from("employers").insert({
      company_name: data.companyName, industry: data.industry ?? null,
    }).select("id, invite_code").single();
    if (error || !emp) throw new Error(error?.message ?? "Failed to create employer");

    await supabaseAdmin.from("profiles").upsert({
      id: userId, full_name: data.fullName, employer_id: emp.id,
    });
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId, role: "employer_admin", employer_id: emp.id,
    }, { onConflict: "user_id,role" });
    return { employerId: emp.id, inviteCode: emp.invite_code };
  });

export const bootstrapClinicStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    clinicId: z.string().uuid(),
    fullName: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").upsert({
      id: userId, full_name: data.fullName, clinic_id: data.clinicId,
    });
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId, role: "clinic_staff", clinic_id: data.clinicId,
    }, { onConflict: "user_id,role" });
    return { ok: true };
  });

export const addWorkerToEmployer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    fullName: z.string().min(1),
    phoneNumber: z.string().min(4),
    email: z.string().email(),
    preferredLanguage: z.enum(["en","ar","hi","ur","ne","tl","bn"]).default("en"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // check user is employer_admin
    const { data: role } = await supabase.from("user_roles").select("employer_id").eq("user_id", userId).eq("role","employer_admin").maybeSingle();
    if (!role?.employer_id) throw new Error("Not an employer admin");

    const tempPass = Math.random().toString(36).slice(2, 10) + "A1!";
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: tempPass, email_confirm: true,
      user_metadata: { full_name: data.fullName, preferred_language: data.preferredLanguage },
      phone: data.phoneNumber,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id, full_name: data.fullName, phone_number: data.phoneNumber,
      email: data.email, preferred_language: data.preferredLanguage, employer_id: role.employer_id,
    });
    await supabaseAdmin.from("user_roles").upsert({
      user_id: created.user.id, role: "worker", employer_id: role.employer_id,
    }, { onConflict: "user_id,role" });

    const { data: emp } = await supabaseAdmin.from("employers").select("worker_count").eq("id", role.employer_id).single();
    if (emp) await supabaseAdmin.from("employers").update({ worker_count: (emp.worker_count ?? 0) + 1 }).eq("id", role.employer_id);

    return { userId: created.user.id, tempPassword: tempPass };
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().min(1),
    content: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: role } = await supabase.from("user_roles").select("employer_id").eq("user_id", userId).eq("role","employer_admin").maybeSingle();
    if (!role?.employer_id) throw new Error("Not an employer admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // insert per-worker
    const { data: workers } = await supabaseAdmin.from("profiles").select("id").eq("employer_id", role.employer_id);
    const rows = (workers ?? []).map((w) => ({
      worker_id: w.id, employer_id: role.employer_id!, type: "health_advisory" as const,
      channel: "in_app" as const, title: data.title, content: data.content,
    }));
    if (rows.length) await supabaseAdmin.from("notifications").insert(rows);
    return { sent: rows.length };
  });
