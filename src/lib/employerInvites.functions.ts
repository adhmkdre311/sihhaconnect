// M1: employer-generated worker invite links.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myEmployerId(supabase: {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, b: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { employer_id: string | null } | null }> } };
    };
  };
}, userId: string): Promise<string> {
  const { data } = await supabase
    .from("user_roles").select("employer_id")
    .eq("user_id", userId).eq("role", "employer_admin").maybeSingle();
  if (!data?.employer_id) throw new Error("Not an employer admin");
  return data.employer_id;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const listEmployerInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const employerId = await myEmployerId(context.supabase as never, context.userId);
    const { data, error } = await context.supabase
      .from("employer_invites")
      .select("id, code, label, expires_at, max_uses, uses, revoked, created_at")
      .eq("employer_id", employerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createEmployerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    label: z.string().trim().max(80).optional(),
    days: z.number().int().min(1).max(365).default(30),
    maxUses: z.number().int().min(1).max(5000).nullable().default(null),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const employerId = await myEmployerId(context.supabase as never, context.userId);
    const expires = new Date(Date.now() + data.days * 86_400_000).toISOString();
    const { data: row, error } = await context.supabase
      .from("employer_invites")
      .insert({
        employer_id: employerId,
        code: newCode(),
        label: data.label?.length ? data.label : null,
        expires_at: expires,
        max_uses: data.maxUses,
        created_by: context.userId,
      })
      .select("id, code, label, expires_at, max_uses, uses, revoked, created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to create invite");
    return row;
  });

export const revokeEmployerInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const employerId = await myEmployerId(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("employer_invites").update({ revoked: true })
      .eq("id", data.id).eq("employer_id", employerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
