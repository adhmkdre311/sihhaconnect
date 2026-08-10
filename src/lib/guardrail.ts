// Single source of truth for the assistant guardrail (spec §3.5 / §9.1).
// Used by the server (ai.functions.ts) before persisting or returning a reply,
// and by the client as defense-in-depth for rate-limit / cached / dev content.

/** The 8 blocked pattern classes. Order is stable so tests can pin them. */
export const GUARDRAIL_PATTERN_CLASSES = [
  "diagnosis_statement",
  "condition_naming",
  "explicit_diagnosis",
  "dosage_instruction",
  "medication_recommendation",
  "drug_substitution",
  "prognosis",
  "skip_care_or_home_remedy",
] as const;

export type GuardrailPatternClass = (typeof GUARDRAIL_PATTERN_CLASSES)[number];

const PATTERNS: Array<{ cls: GuardrailPatternClass; re: RegExp }> = [
  {
    cls: "diagnosis_statement",
    re: /you (have|likely have|probably have|are suffering from|are experiencing) [a-z\s]{1,40}(itis|osis|emia|oma|disease|infection|syndrome|flu|fracture)\b/i,
  },
  {
    cls: "condition_naming",
    re: /(this|that|it) (is|looks like|sounds like|seems like|appears to be) (likely |probably |most likely )?[a-z\s]{1,40}(itis|osis|emia|oma|disease|infection|syndrome|flu|fracture)\b/i,
  },
  { cls: "explicit_diagnosis", re: /\b(i\s+diagnose|my diagnosis|the diagnosis is|diagnosed you with)\b/i },
  { cls: "dosage_instruction", re: /\btake\s+\d+\s?(mg|ml|mcg|g|tablets?|pills?|capsules?|drops?|doses?)\b/i },
  {
    cls: "medication_recommendation",
    re: /\b(you should|you can|i recommend|i suggest|try) (take|taking|use|using|buy|buying) (some )?(paracetamol|ibuprofen|panadol|aspirin|amoxicillin|antibiotics?|painkillers?|this medicine|that medicine)\b/i,
  },
  {
    cls: "drug_substitution",
    re: /\b(instead of|in place of|as a substitute for|replace) [a-z\s-]{2,40}\b(you can|you could|take|use|try)\b|\b(a good|an? (equivalent|alternative)) (substitute|alternative|replacement) (is|would be)\b/i,
  },
  {
    cls: "prognosis",
    re: /\b(it|this|you) (will|should) (heal|clear up|get better|go away|recover)\b[^.]{0,40}\b(in|within|after)\s+\d+\s?(hour|day|week|month)s?\b|\b(is|it'?s) (not )?(serious|life[- ]threatening|dangerous)\b/i,
  },
  {
    cls: "skip_care_or_home_remedy",
    re: /\b(you don'?t need (to see )?a (doctor|clinic)|no need to (see a doctor|book|visit)|there'?s no need for a (doctor|visit))\b|\b(gargle|drink) [a-z\s]{0,20}(salt water|honey|ginger|turmeric)\b[^.]{0,30}\b(instead|to (cure|treat) )/i,
  },
];

export const SAFE_FALLBACK =
  "I can't tell you what this is, but I can help you book a visit to get it checked. Would you like to book now?";

export function checkGuardrail(text: string): { safe: boolean; reason?: GuardrailPatternClass } {
  for (const { cls, re } of PATTERNS) {
    if (re.test(text)) return { safe: false, reason: cls };
  }
  return { safe: true };
}

/** Returns the safe text to render — either the original, or SAFE_FALLBACK if unsafe. */
export function safeRender(text: string): string {
  return checkGuardrail(text).safe ? text : SAFE_FALLBACK;
}