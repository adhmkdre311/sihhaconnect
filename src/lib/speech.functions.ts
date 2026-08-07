// E7: speech-to-text for the assistant (low-literacy accessibility).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decodeAudio, transcribeWithLovableAi } from "@/lib/speech.server";

export const transcribeVoiceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      audioBase64: z.string().min(64).max(12_000_000),
      mimeType: z.string().min(3).max(60),
      language: z.string().min(2).max(5).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { blob, filename } = decodeAudio(data.audioBase64, data.mimeType);
    const text = await transcribeWithLovableAi(blob, filename, data.language);
    return { text };
  });
