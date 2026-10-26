// Pure helpers for the chat function (no Deno or network deps, unit-tested with vitest).

const SMALL_TALK = new Set([
  "hi", "hello", "hey", "hiya", "yo", "salam", "assalamualaikum", "thanks",
  "thank", "you", "thx", "ok", "okay", "sure", "bye", "goodbye", "good",
  "nice", "cool", "great", "awesome", "perfect", "morning", "evening", "there",
]);

export function isSmallTalk(message: string): boolean {
  const words = message.toLowerCase().replace(/[^\p{L}\s]/gu, " ").split(/\s+/)
    .filter(Boolean);
  return words.length > 0 && words.length <= 4 &&
    words.every((w) => SMALL_TALK.has(w));
}

// Short replies or ones pointing back ("those", "the cheaper one") refine the
// previous request, so search with the previous shopper message as well.
const FOLLOW_UP_RE =
  /\b(it|its|that|those|these|them|this one|that one|one|ones|cheaper|cheapest|more expensive|bigger|smaller|another|other|else|similar|instead|compare|which|better)\b/i;

export function isFollowUp(message: string): boolean {
  return message.split(/\s+/).length <= 4 || FOLLOW_UP_RE.test(message);
}

const NUM = String.raw`(?:৳|\$|€|£|₹|tk\.?|bdt|usd)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:৳|tk|taka|bdt|usd|dollars?|rs)?`;

function toNumber(digits: string, k?: string): number {
  const n = Number(digits.replace(/,/g, ""));
  return k ? n * 1000 : n;
}

export function parsePriceRange(
  message: string,
): { min: number | null; max: number | null } {
  const m = message.toLowerCase();
  // A bare "8-10" is often a size; only treat it as a price with a money word.
  const mentionsMoney = /price|budget|cost|tk|taka|৳|\$|bdt|usd|rs\b|₹|€|£/.test(m);
  const between = m.match(
    new RegExp(String.raw`between\s+${NUM}\s+(?:and|to|-)\s+${NUM}`),
  ) ?? (mentionsMoney
    ? m.match(new RegExp(String.raw`${NUM}\s*(?:-|to)\s*${NUM}`))
    : null);
  if (between) {
    const a = toNumber(between[1], between[2]);
    const b = toNumber(between[3], between[4]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const max = m.match(
    new RegExp(
      String.raw`(?:under|below|less than|cheaper than|max(?:imum)?|up ?to|within|budget(?: is| of)?|<)\s*${NUM}`,
    ),
  );
  const min = m.match(
    new RegExp(
      String.raw`(?:over|above|more than|at least|min(?:imum)?|>)\s*${NUM}`,
    ),
  );
  return {
    min: min ? toNumber(min[1], min[2]) : null,
    max: max ? toNumber(max[1], max[2]) : null,
  };
}
