// Fallback ("no API key" / gateway down) assistant replies.
// Scripted, never diagnostic — the assistant must stay useful offline (§9.4).

export type FallbackIntent =
  | "emergency"
  | "booking"
  | "substitution"
  | "pharmacy"
  | "document"
  | "general";

const INTENTS: Array<{ intent: FallbackIntent; re: RegExp }> = [
  {
    intent: "emergency",
    re: /\b(chest pain|can'?t breathe|cannot breathe|difficulty breathing|severe bleeding|unconscious|passing out|suicid|heat stroke|stroke|seizure|choking|overdose|emergency)\b/i,
  },
  {
    intent: "substitution",
    re: /\b(instead of|substitute|alternative|replace|what else can i take|another medicine|different medicine)\b/i,
  },
  { intent: "pharmacy", re: /\b(pharmac(y|ies)|in stock|available|availability|where can i (find|get)|medicine near)\b/i },
  { intent: "booking", re: /\b(book|booking|appointment|reschedul|cancel|slot|see a doctor|visit the clinic)\b/i },
  { intent: "document", re: /\b(prescription|lab report|result|report|document|paper|form|what does this say|translate)\b/i },
];

export function detectFallbackIntent(message: string): FallbackIntent {
  for (const { intent, re } of INTENTS) if (re.test(message)) return intent;
  return "general";
}

const REPLIES: Record<FallbackIntent, string> = {
  emergency:
    "This needs urgent in-person care now. Please call 999 or go to the nearest hospital emergency department immediately.",
  booking:
    "I can help you get seen. Open the Book tab, choose your reason, pick a clinic and then a time slot. You will get a notification at every step.",
  substitution:
    "I can't suggest or swap any medicine — only a doctor or pharmacist can do that. I can help you book a visit, or check which pharmacies list your prescribed medicine as in stock.",
  pharmacy:
    "You can check the pharmacy directory in the app: it shows which pharmacies list a medicine as in stock, plus their area and opening hours. Ordering and prices are not part of Sihha.",
  document:
    "Upload the document in the Documents tab and I will explain what it says in plain language in your language. I can explain the words, but I can't interpret results or advise on treatment.",
  general:
    "I'm your health-literacy assistant: I can explain documents and medical words, and help you book or prepare for a clinic visit. I can't tell you what a condition is. If this is urgent, call 999.",
};

/** Deterministic reply used when the AI gateway is unavailable. */
export function scriptedReply(message: string): string {
  return REPLIES[detectFallbackIntent(message)];
}