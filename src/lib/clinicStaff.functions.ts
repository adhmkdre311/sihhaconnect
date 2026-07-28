import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resendSend } from "@/lib/email.server";

type Perms = {
  can_view_queue: boolean;
  can_edit_slots: boolean;
  can_add_documents: boolean;
  can_manage_staff: boolean;
};

async function assertClinicManager(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("clinic_staff_permissions")
    .select("clinic_id, can_manage_staff")
    .eq("user_id", userId)
    .eq("can_manage_staff", true)
    .maybeSingle();
  if (!data?.clinic_id) throw new Error("You don't have permission to manage clinic staff.");
  return data.clinic_id as string;
}

const permsSchema = z.object({
  can_view_queue: z.boolean(),
  can_edit_slots: z.boolean(),
  can_add_documents: z.boolean(),
  can_manage_staff: z.boolean(),
});

// ---------- Team roster + permissions ----------

export const getMyClinicPerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("clinic_staff_permissions")
      .select("clinic_id, can_view_queue, can_edit_slots, can_add_documents, can_manage_staff")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

export const listClinicTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clinicId = await assertClinicManager(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: perms }, { data: invites }] = await Promise.all([
      supabaseAdmin
        .from("clinic_staff_permissions")
        .select("user_id, can_view_queue, can_edit_slots, can_add_documents, can_manage_staff, created_at")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("clinic_invites")
        .select("id, email, status, can_view_queue, can_edit_slots, can_add_documents, can_manage_staff, created_at, expires_at, accepted_at")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
    ]);
    const ids = (perms ?? []).map((p) => p.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const staff = (perms ?? []).map((p) => ({
      ...p,
      profile: byId.get(p.user_id) ?? null,
      is_self: p.user_id === context.userId,
    }));
    return { clinicId, staff, invites: invites ?? [] };
  });

export const updateClinicStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), perms: permsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const clinicId = await assertClinicManager(context.userId);
    if (data.userId === context.userId && !data.perms.can_manage_staff) {
      throw new Error("You cannot remove your own manage-staff permission.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("clinic_staff_permissions")
      .update(data.perms)
      .eq("user_id", data.userId)
      .eq("clinic_id", clinicId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeClinicStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const clinicId = await assertClinicManager(context.userId);
    if (data.userId === context.userId) throw new Error("You can't remove yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("clinic_staff_permissions").delete().eq("user_id", data.userId).eq("clinic_id", clinicId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "clinic_staff").eq("clinic_id", clinicId);
    return { ok: true };
  });

// ---------- Invites ----------

function makeToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const inviteClinicStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().email(), perms: permsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const clinicId = await assertClinicManager(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const token = makeToken();

    const { data: clinic } = await supabaseAdmin.from("clinics").select("name").eq("id", clinicId).single();
    const { data: inviter } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", context.userId).single();

    const { data: row, error } = await supabaseAdmin
      .from("clinic_invites")
      .insert({
        clinic_id: clinicId, email, token,
        can_view_queue: data.perms.can_view_queue,
        can_edit_slots: data.perms.can_edit_slots,
        can_add_documents: data.perms.can_add_documents,
        can_manage_staff: data.perms.can_manage_staff,
        invited_by: context.userId,
      })
      .select("id, token, expires_at")
      .single();
    if (error) throw new Error(error.message);

    const origin = process.env.PUBLIC_SITE_URL || "https://sihhaconnect.lovable.app";
    const link = `${origin}/clinic/accept-invite?token=${token}`;
    const clinicName = clinic?.name ?? "our clinic";
    const inviterLabel = inviter?.full_name || inviter?.email || "A colleague";

    try {
      await resendSend({
        to: [email],
        subject: `You've been invited to join ${clinicName} on Sihha`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111">
            <h1 style="font-size:20px;margin:0 0 12px">Join ${clinicName} on Sihha</h1>
            <p>${inviterLabel} has invited you to join <strong>${clinicName}</strong> as clinic staff.</p>
            <p>Your permissions:</p>
            <ul>
              ${data.perms.can_view_queue ? "<li>View incoming appointment queue</li>" : ""}
              ${data.perms.can_edit_slots ? "<li>Manage clinic availability slots</li>" : ""}
              ${data.perms.can_add_documents ? "<li>Add patient documents</li>" : ""}
              ${data.perms.can_manage_staff ? "<li>Manage staff & invites</li>" : ""}
            </ul>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Accept invitation</a>
            </p>
            <p style="font-size:12px;color:#666">Or copy this link: ${link}</p>
            <p style="font-size:12px;color:#666">This invite expires in 14 days.</p>
          </div>`,
      });
    } catch (err) {
      // Log but don't fail: manager can still share the link manually.
      console.error("Invite email failed", err);
    }

    return { id: row!.id, link };
  });

export const revokeClinicInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const clinicId = await assertClinicManager(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("clinic_invites")
      .update({ status: "revoked" })
      .eq("id", data.inviteId)
      .eq("clinic_id", clinicId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previewClinicInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("clinic_invites")
      .select("id, email, status, expires_at, clinic_id, can_view_queue, can_edit_slots, can_add_documents, can_manage_staff, clinics(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { ok: false as const, reason: "not_found" as const };
    if (invite.status !== "pending") return { ok: false as const, reason: "used" as const, status: invite.status };
    if (new Date(invite.expires_at) < new Date()) return { ok: false as const, reason: "expired" as const };
    const { data: me } = await supabaseAdmin.from("profiles").select("email").eq("id", context.userId).single();
    const emailMatches = (me?.email ?? "").toLowerCase() === invite.email.toLowerCase();
    return {
      ok: true as const,
      emailMatches,
      invitedEmail: invite.email,
      clinicName: (invite as unknown as { clinics: { name: string } | null }).clinics?.name ?? "this clinic",
      perms: {
        can_view_queue: invite.can_view_queue,
        can_edit_slots: invite.can_edit_slots,
        can_add_documents: invite.can_add_documents,
        can_manage_staff: invite.can_manage_staff,
      } satisfies Perms,
    };
  });

export const acceptClinicInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("clinic_invites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("Invite not found.");
    if (invite.status !== "pending") throw new Error("This invite is no longer valid.");
    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin.from("clinic_invites").update({ status: "expired" }).eq("id", invite.id);
      throw new Error("This invite has expired.");
    }

    const { data: me } = await supabaseAdmin.from("profiles").select("email").eq("id", context.userId).single();
    if ((me?.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("Sign in with the email address this invite was sent to.");
    }

    await supabaseAdmin.from("user_roles").upsert({
      user_id: context.userId, role: "clinic_staff", clinic_id: invite.clinic_id,
    }, { onConflict: "user_id,role" });

    await supabaseAdmin.from("clinic_staff_permissions").upsert({
      user_id: context.userId,
      clinic_id: invite.clinic_id,
      can_view_queue: invite.can_view_queue,
      can_edit_slots: invite.can_edit_slots,
      can_add_documents: invite.can_add_documents,
      can_manage_staff: invite.can_manage_staff,
    }, { onConflict: "user_id,clinic_id" });

    await supabaseAdmin.from("profiles").update({ approved: true, clinic_id: invite.clinic_id }).eq("id", context.userId);

    await supabaseAdmin.from("clinic_invites").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: context.userId,
    }).eq("id", invite.id);

    return { ok: true, clinicId: invite.clinic_id as string };
  });