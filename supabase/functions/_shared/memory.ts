// Persistent shopper memory: short preference notes the bot keeps for a
// returning shopper (sizes, colours, styles, budget, who they shop for) and
// the products it showed them. Pure helpers, shared by the chat function and
// its tests.

export const MAX_FACTS = 10;
export const MAX_FACT_CHARS = 100;
export const MAX_REMEMBERED_PRODUCTS = 6;
export const MEMORY_DAYS = 90;

const VISITOR_RE = /^[A-Za-z0-9_-]{8,100}$/;

export function normalizeVisitorId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return VISITOR_RE.test(v) ? v : null;
}

// Contact details, links, long numbers (phones, card or order numbers) and
// anything that reads like an instruction to the bot are never remembered.
const BLOCKED_FACT_RE = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /https?:\/\/|www\./i, // link
  /\d[\d\s-]{6,}\d/, // phone, card, order or account numbers
  /\b(?:password|otp|pin|cvv|card number|bkash|nagad|address|house|road|flat|apartment|phone|mobile|whatsapp|email)\b/i,
  /\b(?:ignore|instruction|system prompt|prompt|pretend|act as|you must|always say|discount code|coupon|for free|free of charge)\b/i,
];

/** A cleaned-up note, or null when it must not be stored. */
export function sanitizeFact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Control characters (and line breaks) become spaces.
  // eslint-disable-next-line no-control-regex
  const fact = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
  if (fact.length < 3 || fact.length > MAX_FACT_CHARS) return null;
  if (BLOCKED_FACT_RE.some((re) => re.test(fact))) return null;
  return fact;
}

/** Old notes plus new ones (newest last), without repeats, capped. */
export function mergeFacts(old: string[], incoming: unknown, max = MAX_FACTS): string[] {
  const fresh = (Array.isArray(incoming) ? incoming : [])
    .map(sanitizeFact)
    .filter((f): f is string => f !== null);
  const key = (f: string) => f.toLowerCase();
  const freshKeys = new Set(fresh.map(key));
  // A repeated note moves to the end (it was just confirmed again).
  const merged = [...old.filter((f) => !freshKeys.has(key(f))), ...fresh];
  const seen = new Set<string>();
  const unique = merged.filter((f) => (seen.has(key(f)) ? false : (seen.add(key(f)), true)));
  return unique.slice(-max);
}

/** Most recently shown products first, without repeats, capped. */
export function mergeRecent(old: string[], shown: string[], max = MAX_REMEMBERED_PRODUCTS): string[] {
  return [...new Set([...shown, ...old])].slice(0, max);
}

const FORGET_RE =
  /\b(?:forget (?:me|about me|everything|what i (?:said|told you)|my (?:details|data|info|preferences))|(?:delete|erase|remove|clear) (?:my )?(?:data|info|information|details|history|preferences|memory)|don'?t remember (?:me|anything))\b|amake bhule jao|bhule jao/i;

/** The shopper asked the bot to forget them. */
export function wantsForget(message: string): boolean {
  return FORGET_RE.test(message);
}

/** The profile is still fresh enough to use. */
export function isFresh(lastSeen: string | null | undefined, now = Date.now()): boolean {
  const t = Date.parse(lastSeen ?? "");
  return Number.isFinite(t) && now - t < MEMORY_DAYS * 24 * 60 * 60 * 1000;
}
