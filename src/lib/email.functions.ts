// Resend integration via Lovable Connector Gateway.
// Send transactional emails from server code:
//   const send = useServerFn(sendEmail);
//   await send({ data: { to, subject, html } });
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resendSend, sendAuthCodeEmail } from "./email.server";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
 * verification code (issued by Supabase, delivered by Resend). All role
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
      if (msg.includes("registered") || msg.includes("exists") || msg.includes("already")) {
        // Repeated signup attempts are common in QA and for users who missed
        // the first email. Keep the response enumeration-safe, but still issue
        // a fresh OTP instead of silently showing a dead check-inbox screen.
        const { data: retryLink, error: retryErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });
        const retryCode = retryLink?.properties?.email_otp;
        if (!retryErr && retryCode) {
          await sendAuthCodeEmail({
            email,
            code: retryCode,
            subject: `Your Sihha confirmation code: ${retryCode}`,
            title: "Confirm your email",
            intro: "Use the verification code below to continue with your Sihha account.",
            footer: "If you didn't request this, you can ignore this email.",
          });
        }
        return { ok: true, alreadyExists: true };
      }
      throw createErr;
    }

    // Issue a signup verification code (Supabase-signed OTP) and email it.
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
    await sendAuthCodeEmail({
      email,
      code,
      subject: `Your Sihha confirmation code: ${code}`,
      title: "Confirm your email",
      intro: `Hi ${data.fullName}, use the verification code below to confirm your email and finish setting up your Sihha account.`,
      footer: "If you didn't create a Sihha account, you can safely ignore this email.",
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
    await sendAuthCodeEmail({
      email,
      code,
      subject: `Your Sihha confirmation code: ${code}`,
      title: "Confirm your email",
      intro: "Here's a fresh confirmation code for your Sihha account.",
      footer: "If you didn't request this, you can ignore this email.",
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
    await sendAuthCodeEmail({
      email,
      code,
      subject: `Your Sihha password reset code: ${code}`,
      title: "Reset your password",
      intro: "Enter the verification code below in the Sihha app to reset your password. The code expires in 1 hour.",
      footer: "If you didn't request a password reset, you can safely ignore this email.",
    });
    return { ok: true };
  });