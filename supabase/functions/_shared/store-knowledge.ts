// Store knowledge (RAG Level 2): document chunking, product variants and
// size detection. Pure functions, unit-tested with vitest.

// --- Documents -----------------------------------------------------------------

export const CHUNK_MAX_CHARS = 900;

/**
 * Splits a store document into chunks of at most maxChars, keeping
 * paragraphs (and FAQ question+answer pairs) together where possible.
 */
export function chunkDocument(content: string, maxChars = CHUNK_MAX_CHARS): string[] {
  const text = content.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  // Paragraphs: blank lines, or a new heading / FAQ question line.
  const paragraphs = text
    .split(/\n\s*\n|\n(?=#{1,6}\s|Q[:.)]\s|\d+[.)]\s)/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length <= maxChars ? [p] : splitLong(p, maxChars)));

  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + 2 + p.length > maxChars) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// A paragraph longer than maxChars is cut at sentence ends, then hard-cut.
function splitLong(paragraph: string, maxChars: number): string[] {
  const sentences = paragraph.match(/[^.!?।\n]+[.!?।]*\s*/g) ?? [paragraph];
  const parts: string[] = [];
  let current = "";
  for (const raw of sentences) {
    let s = raw;
    while (s.length > maxChars) {
      if (current) {
        parts.push(current.trim());
        current = "";
      }
      parts.push(s.slice(0, maxChars).trim());
      s = s.slice(maxChars);
    }
    if (current.length + s.length > maxChars) {
      parts.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

/** Text embedded for a chunk: the document title gives the chunk context. */
export function chunkEmbeddingText(title: string, chunk: string): string {
  return `${title}\n${chunk}`;
}

// --- Variants ------------------------------------------------------------------

export type Variant = { size?: string; colour?: string; stock_status: "in_stock" | "out_of_stock" };

/** Cleans a product's variants JSON from the database. */
export function normalizeVariants(raw: unknown): Variant[] {
  if (!Array.isArray(raw)) return [];
  const out: Variant[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const size = typeof r.size === "string" && r.size.trim() ? r.size.trim().slice(0, 20) : undefined;
    const colour = typeof r.colour === "string" && r.colour.trim() ? r.colour.trim().slice(0, 30) : undefined;
    if (!size && !colour) continue;
    out.push({ size, colour, stock_status: r.stock_status === "out_of_stock" ? "out_of_stock" : "in_stock" });
  }
  return out;
}

export function variantLabel(v: Variant): string {
  return [v.colour, v.size].filter(Boolean).join("/");
}

/** "Black/M (in stock), Black/L (OUT OF STOCK)" for the reply model. */
export function describeVariants(variants: Variant[], limit = 20): string {
  const shown = variants.slice(0, limit).map((v) =>
    `${variantLabel(v)} (${v.stock_status === "in_stock" ? "in stock" : "OUT OF STOCK"})`
  );
  if (variants.length > limit) shown.push(`and ${variants.length - limit} more`);
  return shown.join(", ");
}

/** Searchable text for the product embedding: colours and sizes on offer. */
export function variantsSearchText(variants: Variant[]): string {
  const colours = [...new Set(variants.map((v) => v.colour).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))];
  return [
    colours.length ? `Colours: ${colours.join(", ")}` : "",
    sizes.length ? `Sizes: ${sizes.join(", ")}` : "",
  ].filter(Boolean).join(". ");
}

// --- Sizes in shopper messages -------------------------------------------------

const SIZE_WORDS: Record<string, string> = {
  small: "S",
  medium: "M",
  large: "L",
  "extra large": "XL",
  "extra small": "XS",
};

const SIZE_TOKEN = String.raw`(xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|\d{1,2}(?:\.5)?|free ?size|extra large|extra small|small|medium|large)`;

/**
 * The size a shopper asks about: "size M", "in size 42", "XL", "medium size".
 * Single letters only count next to the word "size", since "s" or "m"
 * alone are usually not sizes.
 */
export function findSize(message: string): string | null {
  const m = message.toLowerCase();
  if (/\bfree ?size\b/.test(m)) return "Free size";
  const withWord =
    m.match(new RegExp(String.raw`\bsize\s*[:#-]?\s*${SIZE_TOKEN}\b`)) ??
    m.match(new RegExp(String.raw`\b${SIZE_TOKEN}\s+size\b`));
  const token = withWord?.[1] ?? m.match(/\b(xxs|xs|xl|xxl|xxxl|2xl|3xl|4xl)\b/)?.[1];
  if (!token) return null;
  if (SIZE_WORDS[token]) return SIZE_WORDS[token];
  if (/^free ?size$/.test(token)) return "Free size";
  return /^\d/.test(token) ? token : token.toUpperCase();
}

/** Same size, ignoring case and "2XL" vs "XXL" spelling. */
export function sameSize(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.trim().toUpperCase().replace(/^2XL$/, "XXL").replace(/^3XL$/, "XXXL").replace(/\s+/g, " ");
  return norm(a) === norm(b);
}

/** In-stock / out-of-stock / not offered, for a product and size. */
export function sizeAvailability(variants: Variant[], size: string): "in_stock" | "out_of_stock" | "not_offered" {
  const matches = variants.filter((v) => v.size && sameSize(v.size, size));
  if (!matches.length) return "not_offered";
  return matches.some((v) => v.stock_status === "in_stock") ? "in_stock" : "out_of_stock";
}
