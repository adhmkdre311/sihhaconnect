// Client-side defense-in-depth mirror of the server guardrail in ai.functions.ts.
// The server is authoritative; this catches diagnostic/dosage language slipping
// through in edge cases (rate-limit responses, cached content, dev previews).

const DIAGNOSTIC_PATTERNS: RegExp[] = [
  /you (have|are suffering from|are experiencing) [a-z\s]{1,40}(itis|osis|emia|oma|disease|infection|syndrome)\b/i,
  /this (is|looks like|sounds like|appears to be) [a-z\s]{1,40}(itis|osis|emia|oma|disease|infection|syndrome)\b/i,
  /\btake\s+\d+\s?(mg|ml|mcg|g|tablets?|pills?|capsules?)\b/i,
  /\b(i\s+diagnose|my diagnosis|the diagnosis is)\b/i,
];

export const SAFE_FALLBACK =
  "I can't tell you what this is, but I can help you book a visit to get it checked. Would you like to book now?";

export function checkGuardrail(text: string): { safe: boolean; reason?: string } {
  for (const p of DIAGNOSTIC_PATTERNS) {
    if (p.test(text)) return { safe: false, reason: "diagnostic_or_dosage_language_detected" };
  }
  return { safe: true };
}

/** Returns the safe text to render — either the original, or SAFE_FALLBACK if unsafe. */
export function safeRender(text: string): string {
  return checkGuardrail(text).safe ? text : SAFE_FALLBACK;
}