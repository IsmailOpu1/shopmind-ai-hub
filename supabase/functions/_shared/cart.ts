// Cart awareness (PRD v1.0 §6.1 "Cart Awareness"): the widget sends what the
// shopper has in their cart; the server trusts only ids/SKUs and looks the
// products up itself, so names and prices always come from the catalog.
// Pure helpers, unit-tested with vitest.

export const MAX_CART_ITEMS = 20;
const MAX_QUANTITY = 99;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CartLine = { id: string | null; sku: string | null; quantity: number };

/** Validates the cart sent by the widget. Anything malformed is dropped, never an error. */
export function normalizeCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: CartLine[] = [];
  for (const item of raw.slice(0, MAX_CART_ITEMS * 2)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" && UUID_RE.test(r.id.trim()) ? r.id.trim().toLowerCase() : null;
    const sku = typeof r.sku === "string" && r.sku.trim() ? r.sku.trim().slice(0, 100) : null;
    if (!id && !sku) continue;
    const q = Math.floor(Number(r.quantity ?? 1));
    const quantity = Number.isFinite(q) ? Math.min(Math.max(q, 1), MAX_QUANTITY) : 1;
    const same = lines.find((l) => (id && l.id === id) || (sku && l.sku === sku));
    if (same) same.quantity = Math.min(same.quantity + quantity, MAX_QUANTITY);
    else lines.push({ id, sku, quantity });
    if (lines.length >= MAX_CART_ITEMS) break;
  }
  return lines;
}

type CartProduct = { id: string; sku: string | null; name: string; price: number | null; category: string | null };

/** Joins cart lines to the store's products; lines that match nothing are dropped. */
export function resolveCart<T extends CartProduct>(lines: CartLine[], products: T[]): Array<{ product: T; quantity: number }> {
  const out: Array<{ product: T; quantity: number }> = [];
  for (const line of lines) {
    const product = products.find((p) => (line.id && p.id === line.id) || (line.sku && p.sku === line.sku));
    if (!product) continue;
    const same = out.find((o) => o.product.id === product.id);
    if (same) same.quantity = Math.min(same.quantity + line.quantity, MAX_QUANTITY);
    else out.push({ product, quantity: line.quantity });
  }
  return out;
}

export function cartTotal(items: Array<{ product: { price: number | null }; quantity: number }>): number {
  return items.reduce((sum, i) => sum + (Number(i.product.price) || 0) * i.quantity, 0);
}

// "What goes with it?", "complete the look", "anything else?", or getting ready
// to buy: the moments a shopkeeper suggests an add-on. Other messages don't get
// cross-sell suggestions, so the bot doesn't push extras in every reply.
const CROSS_SELL_RE =
  /\b(go(?:es)? (?:well )?with|pair(?:s|ed)? with|match(?:es|ing)?|complete (?:the|my) look|anything else|what else|something else to|add(?:-| )?ons?|accessor(?:y|ies|ise)|checkout|check out|ready to (?:buy|order)|place (?:the|my|an) order|that'?s all|in my cart|my cart)\b/i;

export function wantsCrossSell(message: string): boolean {
  return CROSS_SELL_RE.test(message);
}
