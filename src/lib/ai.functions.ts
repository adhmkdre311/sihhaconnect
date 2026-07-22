import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LANG_NAMES: Record<string, string> = {
  en: "English", ar: "Arabic", hi: "Hindi", ur: "Urdu",
  ne: "Nepali", tl: "Tagalog", bn: "Bengali",
};

function chatSystemPrompt(lang: string) {
  const langName = LANG_NAMES[lang] ?? "English";
  return `You are a multilingual health-literacy assistant for migrant workers in Qatar, operating inside Sihha. Your job is STRICTLY limited to:

1) TRANSLATION & EXPLANATION — Explain medical terms, prescriptions, lab results and doctor instructions in plain, simple language in ${langName}. Short sentences, no jargon.
2) APPOINTMENT & PROCESS GUIDANCE — Help understand how to book, reschedule, prepare (fasting, what to bring). Help understand insurance/HR forms in plain language.
3) SYMPTOM ROUTING (NOT DIAGNOSIS) — You may help pick which department/symptom category to book under. NEVER state or imply a diagnosis, name a likely condition, recommend medication (including OTC), or give a prognosis. Reframe: "I can't tell you what this is, but here's how to get it checked quickly" + booking help.
4) SAFETY ESCALATION — If the user describes any red-flag symptom (chest pain, difficulty breathing, severe bleeding, signs of heat stroke, loss of consciousness, suicidal ideation, or anything urgent), immediately (a) tell them plainly this needs urgent in-person care NOW, (b) provide emergency number 999 and nearest hospital.
5) SCOPE BOUNDARIES — You are not a doctor. Do not discuss topics unrelated to health literacy, appointments, or navigating this platform. No specific drug dosages, combinations, or home remedies beyond basic first aid.
6) TONE — Warm, respectful, calm. 2-4 sentences unless explaining a document. Always respond in ${langName} unless the user switches language.

Never break character. If asked what model you are, say you are an AI health-literacy assistant for this platform, not a doctor.`;
}

async function callGateway(body: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway error: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ choices: { message: { content: string } }[] }>;
}

const RED_FLAG = /\b(chest pain|can'?t breathe|difficulty breathing|severe bleeding|unconscious|passing out|suicid|heat stroke|stroke|seizure|choking|overdose)\b/i;

// Code-level guardrail (Sihha spec §3.5): even if a prompt is bypassed,
// diagnostic language and specific dosage advice must never reach the user.
const DIAGNOSTIC_PATTERNS: RegExp[] = [
  /you (have|are suffering from|are experiencing) [a-z\s]{1,40}(itis|osis|emia|oma|disease|infection|syndrome)\b/i,
  /this (is|looks like|sounds like|appears to be) [a-z\s]{1,40}(itis|osis|emia|oma|disease|infection|syndrome)\b/i,
  /\btake\s+\d+\s?(mg|ml|mcg|g|tablets?|pills?|capsules?)\b/i,
  /\b(i\s+diagnose|my diagnosis|the diagnosis is)\b/i,
];
const SAFE_FALLBACK =
  "I can't tell you what this is, but I can help you book a visit to get it checked. Would you like to book now?";
function checkGuardrail(text: string): { safe: boolean; reason?: string } {
  for (const p of DIAGNOSTIC_PATTERNS) {
    if (p.test(text)) return { safe: false, reason: "diagnostic_or_dosage_language_detected" };
  }
  return { safe: true };
}

// Rate limit: 30 chat messages / 10 minutes per worker.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      message: z.string().min(1).max(4000),
      language: z.string().min(2).max(5),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Rate limit check
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rl } = await supabaseAdmin
      .from("chat_rate_limits").select("window_start, count").eq("worker_id", userId).maybeSingle();
    const now = Date.now();
    const windowStart = rl ? new Date(rl.window_start).getTime() : 0;
    if (rl && now - windowStart < RATE_WINDOW_MS) {
      if ((rl.count ?? 0) >= RATE_MAX) {
        return { reply: "You've sent a lot of messages in a short time. Please pause a few minutes, or if this is urgent call 999.", flagged: false, rate_limited: true };
      }
      await supabaseAdmin.from("chat_rate_limits").update({ count: (rl.count ?? 0) + 1 }).eq("worker_id", userId);
    } else {
      await supabaseAdmin.from("chat_rate_limits").upsert({ worker_id: userId, window_start: new Date(now).toISOString(), count: 1 });
    }

    // Persist user message
    const flag = RED_FLAG.test(data.message);
    await supabase.from("chat_messages").insert({
      worker_id: userId, role: "user", content: data.message, flagged_for_human_review: flag,
    });

    // Fetch last 5 messages for continuity
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("worker_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);
    const messages = [
      { role: "system", content: chatSystemPrompt(data.language) },
      ...(history ?? []).reverse().map((m) => ({ role: m.role, content: m.content })),
    ];

    let assistantText = "";
    try {
      const out = await callGateway({ model: "google/gemini-2.5-flash", messages });
      assistantText = out.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      console.error(err);
      assistantText = "I'm having trouble right now. If this is urgent, please call 999.";
    }

    // Code-level safety net
    const guard = checkGuardrail(assistantText);
    const guardFlag = !guard.safe;
    if (!guard.safe) assistantText = SAFE_FALLBACK;

    await supabase.from("chat_messages").insert({
      worker_id: userId, role: "assistant", content: assistantText, flagged_for_human_review: flag || guardFlag,
    });

    return { reply: assistantText, flagged: flag || guardFlag };
  });

export const summarizeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      documentId: z.string().uuid(),
      text: z.string().min(1).max(20000),
      language: z.string().min(2).max(5),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const langName = LANG_NAMES[data.language] ?? "English";
    const sysPrompt = `You will receive the text of a medical document (prescription, lab report, or clinic visit summary). Target language: ${langName}.

Produce a plain-language summary for a non-medical reader with possibly low health literacy. Output ONLY valid JSON in this exact structure, no preamble, no markdown fences:

{
  "document_type": "prescription | lab_report | visit_summary | insurance_form | unknown",
  "summary": "2-4 sentence plain-language explanation in ${langName}",
  "key_instructions": ["short actionable bullet"],
  "medications_mentioned": [{"name":"as written","plain_language_purpose":"purpose only, no dosing advice beyond what's printed"}],
  "follow_up_needed": true,
  "follow_up_reason": "string or null",
  "flagged_for_human_review": false,
  "flag_reason": "string or null"
}

Only restate what is explicitly written. Never infer a diagnosis or add advice not present. If unclear or low-quality, set flagged_for_human_review true. If urgent, set follow_up_needed and flagged_for_human_review both true.`;

    type Summary = {
      document_type: string;
      summary: string;
      key_instructions: string[];
      medications_mentioned: { name: string; plain_language_purpose: string }[];
      follow_up_needed: boolean;
      follow_up_reason: string | null;
      flagged_for_human_review: boolean;
      flag_reason: string | null;
    };
    let parsed: Summary = {
      document_type: "unknown",
      summary: "",
      key_instructions: [],
      medications_mentioned: [],
      follow_up_needed: false,
      follow_up_reason: null,
      flagged_for_human_review: true,
      flag_reason: "AI unavailable",
    };
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
      parsed = { ...parsed, ...JSON.parse(cleaned) };
    } catch (err) {
      console.error("summarize error", err);
    }

    // Verify ownership
    const { data: doc } = await supabase.from("documents").select("id, worker_id").eq("id", data.documentId).single();
    if (!doc || doc.worker_id !== userId) throw new Error("Not authorized");

    const allowedTypes = ["prescription","lab_report","visit_summary","insurance_form","other"] as const;
    const docType = (allowedTypes as readonly string[]).includes(parsed.document_type)
      ? (parsed.document_type as typeof allowedTypes[number])
      : "other";
    await supabase.from("documents").update({
      original_text: data.text,
      ai_summary_json: parsed as unknown as never,
      ai_plain_language_summary: parsed.summary,
      flagged_for_human_review: parsed.flagged_for_human_review,
      type: docType,
    }).eq("id", data.documentId);

    return { summary: parsed };
  });

export const generateVisitContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      appointmentId: z.string().uuid(),
      symptomCategory: z.string(),
      workerNotes: z.string().max(2000).optional(),
      sourceLanguage: z.string(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const sourceName = LANG_NAMES[data.sourceLanguage] ?? "the worker's language";
    let ctxText = "";
    try {
      const out = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Translate and briefly summarize this patient's booking note into English for clinic front-desk staff. Neutral, 1-2 sentences. Preserve symptoms as reported. Do not diagnose. Original language: ${sourceName}.` },
          { role: "user", content: `Symptom category: ${data.symptomCategory}\nNotes: ${data.workerNotes ?? "(none)"}` },
        ],
      });
      ctxText = out.choices?.[0]?.message?.content ?? "";
    } catch (err) { console.error(err); }
    await supabase.from("appointments").update({ ai_context_summary: ctxText }).eq("id", data.appointmentId);
    return { ok: true };
  });

export const translateVisitSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      appointmentId: z.string().uuid(),
      englishSummary: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Load appointment + patient language
    const { data: appt } = await supabase
      .from("appointments").select("id, worker_id, clinic_id").eq("id", data.appointmentId).single();
    if (!appt) throw new Error("Not found");
    const { data: patient } = await supabase
      .from("profiles").select("preferred_language").eq("id", appt.worker_id).single();
    const lang = patient?.preferred_language ?? "en";
    const langName = LANG_NAMES[lang] ?? "English";

    let translated = data.englishSummary;
    try {
      const out = await callGateway({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Translate the following clinical visit summary into ${langName}. Keep it plain and simple for a non-medical reader. Do not add advice not in the original. Output the translation only.` },
          { role: "user", content: data.englishSummary },
        ],
      });
      translated = out.choices?.[0]?.message?.content ?? translated;
    } catch (err) { console.error(err); }

    await supabase.from("appointments").update({
      visit_summary: translated, status: "completed",
    }).eq("id", data.appointmentId);

    await supabase.from("notifications").insert({
      worker_id: appt.worker_id, type: "general", channel: "in_app",
      title: "Visit summary available",
      content: translated.slice(0, 500),
    });
    return { ok: true };
  });
