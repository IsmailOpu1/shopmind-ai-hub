// Parses the catalog's "variants" column, e.g. "S, M, L:out" or
// "Black/M, Black/L:out, Navy/M". Matches the shape the database accepts
// (an array of at most 50 {size?, colour?, stock_status} objects).

export type Variant = {
  size?: string;
  colour?: string;
  stock_status: "in_stock" | "out_of_stock";
};

export const MAX_VARIANTS = 50;
const MAX_LABEL = 40;

const OUT_WORDS = new Set(["out", "oos", "sold out", "soldout", "out of stock", "no", "0", "unavailable"]);
const IN_WORDS = new Set(["in", "in stock", "yes", "available"]);

// Letter sizes, numeric sizes (42, 10.5, 32/34 is handled by "/"), "free size".
const SIZE_RE = /^(?:\d{0,2}x{0,3}[sml]|xs|xxs|xl|\d+x?l|\d{1,3}(?:\.\d)?|free\s*size|one\s*size)$/i;

function looksLikeSize(token: string): boolean {
  return SIZE_RE.test(token.replace(/\s+/g, " ").trim());
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
}

export function parseVariants(raw: unknown): { variants: Variant[]; error: string | null } {
  if (raw === null || raw === undefined) return { variants: [], error: null };
  const text = String(raw).trim();
  if (!text) return { variants: [], error: null };

  const variants: Variant[] = [];
  for (const part of text.split(/[,;|\n]+/)) {
    const item = part.trim();
    if (!item) continue;
    let label = item;
    let stock: Variant["stock_status"] = "in_stock";
    const colon = item.lastIndexOf(":");
    if (colon >= 0) {
      const flag = item.slice(colon + 1).trim().toLowerCase();
      if (OUT_WORDS.has(flag)) stock = "out_of_stock";
      else if (!IN_WORDS.has(flag)) return { variants: [], error: `Unknown stock flag "${flag}" in "${item}" (use :out)` };
      label = item.slice(0, colon).trim();
    }
    if (!label) continue;

    const variant: Variant = { stock_status: stock };
    const slash = label.indexOf("/");
    if (slash >= 0) {
      const colour = clean(label.slice(0, slash));
      const size = clean(label.slice(slash + 1));
      if (colour) variant.colour = colour;
      if (size) variant.size = size;
    } else if (looksLikeSize(label)) {
      variant.size = clean(label);
    } else {
      variant.colour = clean(label);
    }
    if (!variant.size && !variant.colour) continue;
    variants.push(variant);
  }

  if (variants.length > MAX_VARIANTS) {
    return { variants: [], error: `Too many variants (${variants.length}); the limit is ${MAX_VARIANTS}` };
  }
  return { variants, error: null };
}

/** A product is in stock if any of its variants is. */
export function stockFromVariants(variants: Variant[]): Variant["stock_status"] | null {
  if (!variants.length) return null;
  return variants.some((v) => v.stock_status === "in_stock") ? "in_stock" : "out_of_stock";
}

/** Short text for the products table: "S, M, L · 1 sold out". */
export function summarizeVariants(raw: unknown): string {
  if (!Array.isArray(raw) || !raw.length) return "";
  const labels = raw.slice(0, 6).map((v: Variant) => [v.colour, v.size].filter(Boolean).join("/"));
  const more = raw.length > 6 ? ` +${raw.length - 6}` : "";
  const out = raw.filter((v: Variant) => v.stock_status === "out_of_stock").length;
  return `${labels.join(", ")}${more}${out ? ` · ${out} sold out` : ""}`;
}
