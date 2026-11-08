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
  /\b(it|its|that|those|these|them|this one|that one|one|ones|cheaper|cheapest|more expensive|bigger|smaller|another|other|else|similar|instead|compare|which|better|size|sizes)\b/i;

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

/**
 * Pulls the "reply" string out of a JSON object that arrives in pieces
 * (Gemini streaming with a JSON response schema). Each push returns the newly
 * decoded reply text, so it can be forwarded to the shopper as it is written.
 */
export function createReplyExtractor(field = "reply") {
  let buf = "";
  let pos = -1; // index of the next unread character inside the string value
  let done = false;
  const opener = new RegExp(String.raw`"${field}"\s*:\s*"`);
  const simple: Record<string, string> = {
    '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
  };

  return function push(chunk: string): string {
    buf += chunk;
    if (done) return "";
    if (pos < 0) {
      const m = opener.exec(buf);
      if (!m) return "";
      pos = m.index + m[0].length;
    }
    let out = "";
    while (pos < buf.length) {
      const c = buf[pos];
      if (c === '"') {
        done = true;
        break;
      }
      if (c !== "\\") {
        out += c;
        pos++;
        continue;
      }
      const next = buf[pos + 1];
      if (next === undefined) break; // escape split across chunks
      if (next === "u") {
        const hex = buf.slice(pos + 2, pos + 6);
        if (hex.length < 4) break;
        out += String.fromCharCode(parseInt(hex, 16));
        pos += 6;
        continue;
      }
      out += simple[next] ?? next;
      pos += 2;
    }
    return out;
  };
}

// Some models ignore the JSON format and answer in plain text, sometimes with
// the card list tacked on the end ("...Want to see it?\nproduct_refs: ["P1"]").
// That trailer must never reach the shopper; its refs are still usable.
const TRAILING_REFS_RE = /[\s,]*["']?product_refs["']?\s*[:=]\s*(\[[^\]]*\])\s*\}?\s*$/i;

export function splitPlainReply(text: string): { reply: string; refs: string[] } {
  const match = text.match(TRAILING_REFS_RE);
  if (!match) return { reply: text.trim(), refs: [] };
  let refs: string[] = [];
  try {
    const parsed: unknown = JSON.parse(match[1].replace(/'/g, '"'));
    if (Array.isArray(parsed)) refs = parsed.filter((r): r is string => typeof r === "string");
  } catch {
    // An unreadable list only loses the cards.
  }
  return { reply: text.slice(0, match.index).trim(), refs };
}
