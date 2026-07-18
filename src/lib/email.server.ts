const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function assertKeys() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");
  return { lovableKey, resendKey };
}

export async function resendSend(payload: Record<string, unknown>) {
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
        <tr><td style="font-size:13px;line-height:1.5;color:#666;padding-bottom:8px">Enter this code in the Sihha app to continue. The code expires in 1 hour.</td></tr>
        <tr><td style="font-size:12px;color:#888;padding-top:20px;border-top:1px solid #eee">${esc(footer)}</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export async function sendAuthCodeEmail(opts: {
  email: string;
  code: string;
  subject: string;
  title: string;
  intro: string;
  footer: string;
}) {
  await resendSend({
    to: [opts.email],
    subject: opts.subject,
    html: brandedCodeEmail({
      title: opts.title,
      intro: opts.intro,
      code: opts.code,
      footer: opts.footer,
    }),
  });
}