import { describe, expect, it } from "vitest";
import { detectFallbackIntent, scriptedReply } from "../../src/lib/assistantFallback";
import { checkGuardrail } from "../../src/lib/guardrail";

/** §9.1 — scripted replies cover every intent and stay guardrail-clean. */
const SAMPLES: Array<[string, string]> = [
  ["emergency", "I have severe chest pain right now"],
  ["emergency", "my friend is unconscious, help"],
  ["substitution", "what else can I take instead?"],
  ["substitution", "is there an alternative medicine for this"],
  ["pharmacy", "which pharmacy has this medicine in stock?"],
  ["booking", "I want to book an appointment tomorrow"],
  ["booking", "how do I cancel my slot"],
  ["document", "what does this lab report say"],
  ["general", "hello"],
];

describe("fallback intent detection", () => {
  it.each(SAMPLES)("%s ← %s", (intent, message) => {
    expect(detectFallbackIntent(message)).toBe(intent);
  });

  it("emergency wins over any other intent", () => {
    expect(detectFallbackIntent("I can't breathe, should I book an appointment?")).toBe("emergency");
  });
});

describe("scripted replies", () => {
  it("never substitutes a medicine", () => {
    const reply = scriptedReply("what else can I take instead of amoxicillin?");
    expect(reply).toMatch(/can't suggest or swap any medicine/i);
    expect(reply).toMatch(/book a visit|pharmacies/i);
  });

  it("escalates emergencies to 999", () => {
    expect(scriptedReply("severe bleeding")).toMatch(/999/);
  });

  it("routes booking, pharmacy and document intents to the right surface", () => {
    expect(scriptedReply("book appointment")).toMatch(/Book tab/);
    expect(scriptedReply("pharmacy in stock")).toMatch(/pharmacy directory/i);
    expect(scriptedReply("explain my prescription")).toMatch(/Documents tab/);
  });

  it("never mentions ordering, reserving or prices (scope boundary)", () => {
    for (const [, message] of SAMPLES) {
      expect(scriptedReply(message)).not.toMatch(/\b(order|reserve|price|cheaper)\b/i);
    }
  });

  it("every scripted reply passes the guardrail", () => {
    for (const [, message] of SAMPLES) {
      expect(checkGuardrail(scriptedReply(message)).safe, message).toBe(true);
    }
  });
});