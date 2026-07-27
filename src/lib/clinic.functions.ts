import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LANG_NAMES: Record<string, string> = {
  en: "English", ar: "Arabic", hi: "Hindi", ur: "Urdu",
  ne: "Nepali", tl: "Tagalog", bn: "Bengali",
};

async function callGateway(body: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI gateway ${res.status}`);
  return res.json() as Promise<{ choices: { message: { content: string } }[] }>;
}

export const translateContextNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ appointmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, context_note, context_note_translated, worker_id, worker:profiles!appointments_worker_id_fkey(preferred_language)")
      .eq("id", data.appointmentId).single();
    if (!appt?.context_note) return { ok: true, translated: null };
    if (appt.context_note_translated) return { ok: true, translated: appt.context_note_translated };
    const w = appt.worker as { preferred_language?: string } | null;
    const sourceLang = LANG_NAMES[w?.preferred_language ?? "en"] ?? "the worker's language";
    let translated = appt.context_note;
    try {
      const out = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Translate the following patient booking note from ${sourceLang} into plain neutral English for clinic front-desk staff. 1-2 short sentences. Preserve reported symptoms. Do NOT diagnose. Output the translation only.` },
          { role: "user", content: appt.context_note },
        ],
      });
      translated = out.choices?.[0]?.message?.content?.trim() || translated;
    } catch (err) { console.error(err); }
    await supabase.from("appointments").update({ context_note_translated: translated }).eq("id", data.appointmentId);
    return { ok: true, translated };
  });

export const clinicAddDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      workerId: z.string().uuid(),
      type: z.enum(["prescription","lab_report","visit_summary","insurance_form","other"]),
      title: z.string().max(200).optional(),
      text: z.string().min(1).max(20000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Verify clinic scope
    const { data: check } = await supabase.rpc("worker_has_appointment_at_clinic", { _worker: data.workerId });
    if (!check) throw new Error("Not authorized: patient has no appointment at your clinic");
    // Get worker language
    const { data: prof } = await supabase.from("profiles").select("preferred_language").eq("id", data.workerId).single();
    const lang = prof?.preferred_language ?? "en";
    const langName = LANG_NAMES[lang] ?? "English";

    // Insert doc
    const { data: doc, error } = await supabase.from("documents").insert({
      worker_id: data.workerId,
      type: data.type,
      original_text: data.text,
      flagged_for_human_review: false,
    }).select("id").single();
    if (error || !doc) throw new Error(error?.message || "Insert failed");

    // Summarize for worker
    const sysPrompt = `You will receive the text of a medical document (${data.type}). Target language: ${langName}.
Produce a plain-language summary for a non-medical reader. Output ONLY valid JSON:
{"document_type":"${data.type}","summary":"2-4 sentences in ${langName}","key_instructions":[],"medications_mentioned":[],"follow_up_needed":false,"follow_up_reason":null,"flagged_for_human_review":false,"flag_reason":null}
Only restate what is written. Never diagnose.`;
    try {
      const out = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: data.text },
        ],
      });
      const raw = out.choices?.[0]?.message?.content ?? "{}";
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned) as { summary?: string; flagged_for_human_review?: boolean };
      await supabase.from("documents").update({
        ai_summary_json: parsed as never,
        ai_plain_language_summary: parsed.summary ?? null,
        flagged_for_human_review: parsed.flagged_for_human_review ?? false,
      }).eq("id", doc.id);
    } catch (err) { console.error("summary err", err); }

    // Notify worker
    await supabase.from("notifications").insert({
      worker_id: data.workerId, type: "general", channel: "in_app",
      title: data.title ?? "New document available",
      content: "Your clinic added a new document. Open Records to read a simple explanation.",
    });

    return { ok: true, documentId: doc.id };
  });