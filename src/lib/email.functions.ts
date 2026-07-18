// Resend integration via Lovable Connector Gateway.
// Send transactional emails from server code:
//   const send = useServerFn(sendEmail);
//   await send({ data: { to, subject, html } });
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function assertKeys() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");
  return { lovableKey, resendKey };
}

async function resendSend(payload: Record<string, unknown>) {
  const { lovableKey, resendKey } = assertKeys();
  const from = (payload.from as string | undefined) ?? process.env.RESEND_FROM ?? "Sihha <onboarding@resend.dev>";
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({ ...payload, from }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend send failed [${res.status}]: ${body}`);
    throw new Error(`Email send failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id: string };
}

// Minimal branded template. Kept inline to avoid pulling react-email into the
// server bundle. Escapes untrusted values.
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function brandedCodeEmail(opts: { title: string; intro: string; code: string; footer: string }) {
  const { title, intro, code, footer } = opts;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6F1E7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F1E7;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(14,92,86,0.06)">
        <tr><td style="padding-bottom:16px">
          <div style="font-family:'Space Grotesk',Inter,sans-serif;font-size:22px;font-weight:700;color:#0E5C56">Sihha</div>
        </td></tr>
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${esc(title)}</td></tr>
        <tr><td style="font-size:15px;line-height:1.55;color:#333;padding-bottom:20px">${esc(intro)}</td></tr>
        <tr><td align="center" style="padding:8px 0 24px 0">
          <div style="display:inline-block;background:#F6F1E7;border:1px solid #E4D9BF;border-radius:12px;padding:16px 28px;font-family:'SFMono-Regular',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#0E5C56">${esc(code)}</div>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.5;color:#666;padding-bottom:8px">Enter this 6-digit code in the Sihha app to continue. The code expires in 1 hour.</td></tr>
        <tr><td style="font-size:12px;color:#888;padding-top:20px;border-top:1px solid #eee">${esc(footer)}</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

const InputSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  from: z.string().optional(),
  reply_to: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
}).refine((v) => v.html || v.text, { message: "Provide html or text" });

export const sendEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    return resendSend({
      to: Array.isArray(data.to) ? data.to : [data.to],
      subject: data.subject,
      html: data.html,
      text: data.text,
      from: data.from,
      reply_to: data.reply_to,
      cc: data.cc,
      bcc: data.bcc,
    });
  });

// ---------------------------------------------------------------------------
// Custom auth email flow (Resend delivery, Supabase-issued tokens).
// ---------------------------------------------------------------------------

const RoleEnum = z.enum(["worker", "employer_admin", "clinic_staff"]);
const LangEnum = z.enum(["en", "ar", "hi", "ur", "ne", "tl", "bn"]);

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(120),
  preferredLanguage: LangEnum.default("en"),
  role: RoleEnum,
  phoneNumber: z.string().max(40).optional(),
  inviteCode: z.string().max(64).optional(),
  companyName: z.string().max(200).optional(),
  clinicId: z.string().uuid().optional(),
});

/**
 * Custom sign-up: creates a user with email_confirm=false, then emails a
 * verification link (issued by Supabase, delivered by Resend). All role
 * context is packed into user_metadata for the /auth/verify handler to
 * consume once the session is established.
 */
export const startEmailSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase().trim();

    const metadata = {
      full_name: data.fullName,
      preferred_language: data.preferredLanguage,
      phone_number: data.phoneNumber ?? null,
      pending_role: data.role,
      pending_invite_code: data.inviteCode ?? null,
      pending_company_name: data.companyName ?? null,
      pending_clinic_id: data.clinicId ?? null,
    };

    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: false,
      user_metadata: metadata,
      phone: data.phoneNumber || undefined,
    });
    if (createErr) {
      const msg = createErr.message?.toLowerCase() ?? "";
      // Enumeration-safe response — client always shows check-inbox screen.
      if (msg.includes("registered") || msg.includes("exists") || msg.includes("already")) {
        return { ok: true, alreadyExists: true };
      }
      throw createErr;
    }

    // Issue a signup 6-digit verification code (Supabase-signed OTP) and email it.
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password: data.password,
    });
    const code = link?.properties?.email_otp;
    if (linkErr || !code) {
      console.error("generateLink signup failed", linkErr);
      throw new Error("Could not issue verification code");
    }
    await resendSend({
      to: [email],
      subject: `Your Sihha confirmation code: ${code}`,
      html: brandedCodeEmail({
        title: "Confirm your email",
        intro: `Hi ${data.fullName}, use the 6-digit code below to confirm your email and finish setting up your Sihha account.`,
        code,
        footer: "If you didn't create a Sihha account, you can safely ignore this email.",
      }),
    });

    return { ok: true, alreadyExists: false };
  });

const ResendSchema = z.object({ email: z.string().email() });

export const resendSignupEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase().trim();
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const code = link?.properties?.email_otp;
    // Silent success — never leak whether the address exists / is already confirmed.
    if (error || !code) return { ok: true };
    await resendSend({
      to: [email],
      subject: `Your Sihha confirmation code: ${code}`,
      html: brandedCodeEmail({
        title: "Confirm your email",
        intro: "Here's a fresh confirmation code for your Sihha account.",
        code,
        footer: "If you didn't request this, you can ignore this email.",
      }),
    });
    return { ok: true };
  });

export const sendPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResendSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase().trim();
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    const code = link?.properties?.email_otp;
    // Enumeration-safe: always report ok. Skip send only when there's no code.
    if (error || !code) return { ok: true };
    await resendSend({
      to: [email],
      subject: `Your Sihha password reset code: ${code}`,
      html: brandedCodeEmail({
        title: "Reset your password",
        intro: "Enter the 6-digit code below in the Sihha app to reset your password. The code expires in 1 hour.",
        code,
        footer: "If you didn't request a password reset, you can safely ignore this email.",
      }),
    });
    return { ok: true };
  });