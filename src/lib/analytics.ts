// Shapes and number formatting for the analytics page. The raw numbers come
// from the store_analytics database function (one call per page load).

export type AnalyticsTotals = {
  conversations: number;
  shopper_messages: number;
  replies: number;
  fallback_replies: number;
  cards_shown: number;
  view_clicks: number;
  cart_clicks: number;
  gap_questions: number;
};

export type DailyPoint = { day: string; conversations: number; messages: number };
export type TopQuestion = { question: string; count: number };
export type CatalogGap = {
  question: string;
  reason: "no_match" | "no_budget_match";
  count: number;
  last_asked: string;
};
export type ProductStat = { product_id: string; name: string; shown: number; views: number; carts: number };

export type StoreAnalytics = {
  days: number;
  totals: AnalyticsTotals;
  daily: DailyPoint[];
  top_questions: TopQuestion[];
  gaps: CatalogGap[];
  products: ProductStat[];
};

const EMPTY_TOTALS: AnalyticsTotals = {
  conversations: 0,
  shopper_messages: 0,
  replies: 0,
  fallback_replies: 0,
  cards_shown: 0,
  view_clicks: 0,
  cart_clicks: 0,
  gap_questions: 0,
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : []);

/** Defensive parse of the function's JSON so a missing key never crashes the page. */
export function parseAnalytics(raw: unknown): StoreAnalytics {
  const r = (raw ?? {}) as Record<string, unknown>;
  const t = (r.totals ?? {}) as Record<string, unknown>;
  const totals = Object.fromEntries(
    Object.keys(EMPTY_TOTALS).map((k) => [k, num(t[k])]),
  ) as AnalyticsTotals;
  return {
    days: num(r.days),
    totals,
    daily: list(r.daily).map((d) => ({
      day: String(d.day),
      conversations: num(d.conversations),
      messages: num(d.messages),
    })),
    top_questions: list(r.top_questions).map((q) => ({ question: String(q.question), count: num(q.count) })),
    gaps: list(r.gaps).map((g) => ({
      question: String(g.question),
      reason: g.reason === "no_budget_match" ? "no_budget_match" : "no_match",
      count: num(g.count),
      last_asked: String(g.last_asked),
    })),
    products: list(r.products).map((p) => ({
      product_id: String(p.product_id),
      name: String(p.name),
      shown: num(p.shown),
      views: num(p.views),
      carts: num(p.carts),
    })),
  };
}

/** Share as a whole-number percentage, or null when there is nothing to divide by. */
export function percent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 100);
}

export function formatPercent(value: number | null): string {
  return value === null ? "–" : `${value}%`;
}

export type FunnelStep = { label: string; value: number; rateOfShown: number | null };

/**
 * Card shown → View product → Add to cart. Rates are against cards shown:
 * a shopper can add to cart straight from the card without viewing first,
 * so a step-to-step rate could pass 100%.
 */
export function funnel(totals: AnalyticsTotals): FunnelStep[] {
  const steps = [
    { label: "Cards shown", value: totals.cards_shown },
    { label: "View clicks", value: totals.view_clicks },
    { label: "Add-to-cart clicks", value: totals.cart_clicks },
  ];
  return steps.map((s, i) => ({
    ...s,
    rateOfShown: i === 0 ? null : percent(s.value, totals.cards_shown),
  }));
}

/** "2026-11-07" → "7 Nov", without time zone shifts. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** The viewer's IANA time zone, so "today" on the chart matches their clock. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const GAP_REASON_LABEL: Record<CatalogGap["reason"], string> = {
  no_match: "No product or store info found",
  no_budget_match: "Nothing in budget",
};
