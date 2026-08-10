import { describe, expect, it } from "vitest";
import {
  GUARDRAIL_PATTERN_CLASSES,
  SAFE_FALLBACK,
  checkGuardrail,
  safeRender,
  type GuardrailPatternClass,
} from "../../src/lib/guardrail";

/** §9.1 — every blocked pattern class must trigger, safe text must pass. */
const BLOCKED: Record<GuardrailPatternClass, string[]> = {
  diagnosis_statement: [
    "You have a throat infection, so rest well.",
    "You are suffering from tonsillitis.",
  ],
  condition_naming: [
    "This looks like a kidney infection.",
    "It appears to be dermatitis.",
  ],
  explicit_diagnosis: ["My diagnosis is simple.", "The diagnosis is clear from the report."],
  dosage_instruction: ["Take 500 mg twice a day.", "Take 2 tablets after food."],
  medication_recommendation: [
    "You should take paracetamol for now.",
    "I recommend taking ibuprofen tonight.",
  ],
  drug_substitution: [
    "Instead of amoxicillin you can take something milder.",
    "An equivalent alternative would be a cheaper brand.",
  ],
  prognosis: [
    "It will get better in 3 days.",
    "This is not serious at all.",
  ],
  skip_care_or_home_remedy: [
    "You don't need a doctor for this.",
    "Gargle with salt water instead of booking.",
  ],
};

const SAFE_TEXTS = [
  "I can't tell you what this is, but I can help you book a visit today.",
  "Your report lists your haemoglobin level. Your doctor will explain what it means for you.",
  "Bring your ID and your prescription. Do not eat for 8 hours before the blood test.",
  "This needs urgent care now. Please call 999.",
  SAFE_FALLBACK,
];

describe("guardrail — blocked pattern classes", () => {
  it("declares exactly 8 pattern classes", () => {
    expect(GUARDRAIL_PATTERN_CLASSES).toHaveLength(8);
  });

  it.each(GUARDRAIL_PATTERN_CLASSES)("%s triggers the guardrail", (cls) => {
    for (const sample of BLOCKED[cls]) {
      const res = checkGuardrail(sample);
      expect(res.safe, `"${sample}" passed the guardrail`).toBe(false);
    }
  });

  it("classifies each sample as its own class", () => {
    for (const cls of GUARDRAIL_PATTERN_CLASSES) {
      for (const sample of BLOCKED[cls]) {
        expect(checkGuardrail(sample).reason, sample).toBe(cls);
      }
    }
  });
});

describe("guardrail — safe text", () => {
  it.each(SAFE_TEXTS)("passes: %s", (text) => {
    expect(checkGuardrail(text)).toEqual({ safe: true });
    expect(safeRender(text)).toBe(text);
  });
});

describe("guardrail — fallback text", () => {
  it("is the exact spec wording", () => {
    expect(SAFE_FALLBACK).toBe(
      "I can't tell you what this is, but I can help you book a visit to get it checked. Would you like to book now?",
    );
  });

  it("replaces unsafe text with the fallback", () => {
    expect(safeRender("You have bronchitis. Take 500 mg now.")).toBe(SAFE_FALLBACK);
  });

  it("the fallback itself is safe (no infinite substitution)", () => {
    expect(checkGuardrail(SAFE_FALLBACK).safe).toBe(true);
  });
});