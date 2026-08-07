// Server-only helpers for speech-to-text. Kept out of *.functions.ts so the
// server-fn split transform cannot strip them (tss-serverfn-split).
const MAX_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
};

export function decodeAudio(base64: string, mimeType: string): { blob: Blob; filename: string } {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.byteLength === 0) throw new Error("Empty recording — please record again.");
  if (bytes.byteLength > MAX_BYTES) throw new Error("Recording is too long. Please keep it under a minute.");
  const base = mimeType.split(";")[0]!.trim();
  const ext = EXT_BY_MIME[base];
  if (!ext) throw new Error(`Unsupported audio format: ${base}`);
  return { blob: new Blob([bytes], { type: base }), filename: `recording.${ext}` };
}

export async function transcribeWithLovableAi(
  blob: Blob, filename: string, language?: string,
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Voice input is not configured");

  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", blob, filename);
  // Bare ISO-639-1 only; omit when we are unsure so the model auto-detects.
  if (language && /^[a-z]{2}$/.test(language)) form.append("language", language);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Voice input is busy right now — please try again in a moment.");
    if (res.status === 402) throw new Error("Voice input is temporarily unavailable (billing).");
    throw new Error(`Transcription failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
