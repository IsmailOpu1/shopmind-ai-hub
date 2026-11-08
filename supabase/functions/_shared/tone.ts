// Bot personality (PRD v1.0 Phase 3): the store picks how its assistant
// sounds. A tone only changes wording; the grounding and safety rules in the
// chat prompt are the same for every tone. Kept in sync with
// src/lib/tone.ts (the dashboard's list), which the tests check.

export const TONES = ["friendly", "professional", "playful", "luxury"] as const;
export type Tone = (typeof TONES)[number];

const STYLES: Record<Tone, { persona: string; style: string }> = {
  friendly: {
    persona: "a warm, knowledgeable shopkeeper",
    style: "Friendly, confident and concise: 1-3 short sentences, an emoji only rarely.",
  },
  professional: {
    persona: "a polite, efficient sales advisor",
    style: "Courteous, clear and to the point: 1-3 short sentences. No slang, no exclamation marks, no emojis.",
  },
  playful: {
    persona: "an upbeat, fun shop assistant who loves what the store sells",
    style: "Cheerful and lively, with light humour and at most one emoji: 1-3 short sentences.",
  },
  luxury: {
    persona: "an attentive personal stylist at a premium boutique",
    style:
      'Elegant, calm and refined: 1-3 short sentences. Describe pieces by their craft, fabric and fit in evocative words (e.g. "beautifully tailored", "a timeless piece"), offer suggestions graciously ("May I suggest..."), and invite rather than ask ("Shall I show you...?"). Never pushy or chatty: no exclamation marks, no emojis.',
  },
};

export function normalizeTone(raw: unknown): Tone {
  return TONES.includes(raw as Tone) ? (raw as Tone) : "friendly";
}

export function toneStyle(raw: unknown): { persona: string; style: string } {
  return STYLES[normalizeTone(raw)];
}
