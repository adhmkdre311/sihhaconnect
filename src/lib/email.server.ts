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