import { isFollowUp, parsePriceRange } from "./chat-utils.ts";

/**
 * Turns the shopper's latest message (plus a little conversation context)
 * into a search plan: what to search for and which soft filters to apply.
 * Deterministic on purpose: no extra model call per message.
 */

const COLOURS = [
  "black", "white", "grey", "gray", "silver", "gold", "red", "maroon", "pink",
  "orange", "yellow", "beige", "cream", "tan", "camel", "brown", "khaki",
  "olive", "green", "teal", "blue", "navy", "purple", "tortoise",
];

// Shopper words -> words that tend to appear in category names.
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  shoe: ["footwear", "shoe"],
  sneaker: ["footwear", "shoe", "sneaker"],
  loafer: ["footwear", "shoe"],
  boot: ["footwear", "shoe", "boot"],
  sandal: ["footwear", "shoe", "sandal"],
  footwear: ["footwear", "shoe"],
  shirt: ["shirt", "top"],
  tshirt: ["shirt", "top", "tee"],
  tee: ["shirt", "top", "tee"],
  top: ["top", "shirt"],
  trouser: ["trouser", "pant", "bottom"],
  pant: ["trouser", "pant", "bottom"],
  chino: ["trouser", "pant", "bottom"],
  jean: ["jean", "denim", "trouser", "pant"],
  jacket: ["jacket", "outerwear", "coat"],
  blazer: ["jacket", "outerwear", "blazer", "suit"],
  coat: ["coat", "jacket", "outerwear"],
  sunglass: ["accessor", "eyewear", "sunglass"],
  belt: ["accessor", "belt"],
  watch: ["accessor", "watch"],
  bag: ["accessor", "bag"],
  wallet: ["accessor", "wallet"],
};

const CHEAPER_RE = /\b(cheaper|less expensive|lower price|more affordable|budget option)\b/i;
const PRICIER_RE = /\b(more expensive|pricier|premium|higher end|better quality)\b/i;
const IN_STOCK_RE = /\b(in stock|available now|available|ready to ship)\b/i;

function stem(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("es") && /(sh|ch|x|s)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/t-shirt/g, "tshirt").split(/[^a-z]+/).filter(Boolean).map(stem);
}

export function findColour(text: string): string | null {
  const tokens = new Set(text.toLowerCase().split(/[^a-z]+/));
  return COLOURS.find((c) => tokens.has(c)) ?? null;
}

/** Store categories the text refers to, directly or through a synonym. */
export function matchCategories(text: string, categories: string[]): string[] {
  const asked = new Set<string>();
  for (const w of words(text)) {
    asked.add(w);
    for (const syn of CATEGORY_SYNONYMS[w] ?? []) asked.add(syn);
  }
  return categories.filter((category) =>
    words(category).some((cw) => [...asked].some((a) => cw === a || (a.length >= 5 && cw.startsWith(a))))
  );
}

export type SearchPlan = {
  /** Text used for the embedding and keyword search. */
  searchText: string;
  followUp: boolean;
  categories: string[];
  colour: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
  /** Human-readable notes for the reply model. */
  notes: string[];
};

export function buildSearchPlan(input: {
  message: string;
  previousUserMessage: string;
  /** Prices of the products shown in the previous reply. */
  lastShownPrices: number[];
  storeCategories: string[];
}): SearchPlan {
  const { message, previousUserMessage, lastShownPrices, storeCategories } = input;
  const followUp = previousUserMessage !== "" && isFollowUp(message);
  const notes: string[] = [];

  let categories = matchCategories(message, storeCategories);
  if (!categories.length && followUp) categories = matchCategories(previousUserMessage, storeCategories);

  const colour = findColour(message) ?? (followUp ? findColour(previousUserMessage) : null);

  let { min: minPrice, max: maxPrice } = parsePriceRange(message);
  if (minPrice === null && maxPrice === null && followUp) {
    ({ min: minPrice, max: maxPrice } = parsePriceRange(previousUserMessage));
  }
  const shown = lastShownPrices.filter((p) => Number.isFinite(p));
  if (followUp && shown.length) {
    if (CHEAPER_RE.test(message)) {
      maxPrice = Math.min(...shown) - 0.01;
      notes.push("The shopper wants something cheaper than what you just showed.");
    } else if (PRICIER_RE.test(message)) {
      minPrice = Math.max(...shown) + 0.01;
      notes.push("The shopper wants something more premium than what you just showed.");
    }
  }

  const inStockOnly = IN_STOCK_RE.test(message);
  if (colour) notes.push(`The shopper wants the colour ${colour}; say honestly if no product in the catalog has it.`);
  if (inStockOnly) notes.push("The shopper only wants products that are in stock.");

  const searchText = followUp ? `${previousUserMessage}\n${message}` : message;
  return { searchText, followUp, categories, colour, minPrice, maxPrice, inStockOnly, notes };
}

export type Rankable = {
  name: string;
  description: string | null;
  category: string | null;
  stock_status: string;
  similarity: number;
};

/** Re-orders search results using the plan's soft filters. */
export function rerank<T extends Rankable>(products: T[], plan: SearchPlan): T[] {
  const wanted = new Set(plan.categories.map((c) => c.toLowerCase()));
  const score = (p: T) => {
    let s = p.similarity;
    if (wanted.size && p.category) s += wanted.has(p.category.toLowerCase()) ? 0.25 : -0.1;
    if (plan.colour) {
      const text = `${p.name} ${p.description ?? ""}`.toLowerCase();
      if (new RegExp(`\\b${plan.colour}\\b`).test(text)) s += 0.2;
    }
    if (p.stock_status === "in_stock") s += 0.03;
    else if (plan.inStockOnly) s -= 0.5;
    return s;
  };
  return products
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ p }) => p);
}

/**
 * Keeps only products in the asked-for categories when there are any, so a
 * "cheaper shoes" question isn't answered with a shirt. If none match, all
 * results stay and the reply model can say so honestly.
 */
export function focusOnCategories<T extends { category: string | null }>(products: T[], plan: SearchPlan): T[] {
  if (!plan.categories.length) return products;
  const wanted = new Set(plan.categories.map((c) => c.toLowerCase()));
  const inCategory = products.filter((p) => p.category && wanted.has(p.category.toLowerCase()));
  return inCategory.length ? inCategory : products;
}
