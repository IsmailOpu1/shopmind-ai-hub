import { describe, expect, it } from "vitest";
import { formatDay, formatPercent, funnel, parseAnalytics, percent } from "./analytics";

describe("parseAnalytics", () => {
  it("fills missing keys with zeros and empty lists", () => {
    const a = parseAnalytics({ days: 7, totals: { conversations: 3 } });
    expect(a.days).toBe(7);
    expect(a.totals.conversations).toBe(3);
    expect(a.totals.cart_clicks).toBe(0);
    expect(a.daily).toEqual([]);
    expect(a.gaps).toEqual([]);
  });

  it("survives null", () => {
    expect(parseAnalytics(null).totals.replies).toBe(0);
  });

  it("keeps rows and normalises the gap reason", () => {
    const a = parseAnalytics({
      gaps: [{ question: "laptops", reason: "something else", count: 2, last_asked: "2026-11-07" }],
      products: [{ product_id: "p1", name: "Loafers", shown: "4", views: 1, carts: 1 }],
    });
    expect(a.gaps[0].reason).toBe("no_match");
    expect(a.products[0].shown).toBe(4);
  });
});

describe("percent", () => {
  it("rounds and handles zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBeNull();
    expect(formatPercent(null)).toBe("–");
    expect(formatPercent(40)).toBe("40%");
  });
});

describe("funnel", () => {
  it("gives each step's rate against cards shown", () => {
    const steps = funnel({
      conversations: 0,
      shopper_messages: 0,
      replies: 0,
      fallback_replies: 0,
      cards_shown: 20,
      view_clicks: 5,
      cart_clicks: 2,
      gap_questions: 0,
    });
    expect(steps.map((s) => s.rateOfShown)).toEqual([null, 25, 10]);
  });
});

describe("formatDay", () => {
  it("formats an ISO day without shifting it", () => {
    expect(formatDay("2026-11-07")).toBe("7 Nov");
    expect(formatDay("bad")).toBe("bad");
  });
});
