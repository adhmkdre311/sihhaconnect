// Resend integration via Lovable Connector Gateway.
// Send transactional emails from server code:
//   const send = useServerFn(sendEmail);
//   await send({ data: { to, subject, html } });
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resendSend } from "./email.server";

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