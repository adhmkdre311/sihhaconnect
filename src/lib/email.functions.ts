// Resend integration via Lovable Connector Gateway.
// Send transactional emails from server code:
//   const send = useServerFn(sendEmail);
//   await send({ data: { to, subject, html } });
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

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
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

    // Use verified domain via env, else Resend's onboarding sender (owner-only delivery).
    const from = data.from ?? process.env.RESEND_FROM ?? "Sihha <onboarding@resend.dev>";

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(data.to) ? data.to : [data.to],
        subject: data.subject,
        html: data.html,
        text: data.text,
        reply_to: data.reply_to,
        cc: data.cc,
        bcc: data.bcc,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend send failed [${res.status}]: ${body}`);
      throw new Error(`Email send failed [${res.status}]: ${body}`);
    }
    return (await res.json()) as { id: string };
  });