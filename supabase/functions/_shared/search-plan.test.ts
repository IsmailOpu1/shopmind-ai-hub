import { describe, expect, it } from "vitest";
import { buildSearchPlan, findColour, focusOnCategories, matchCategories, rerank } from "./search-plan";

const categories = ["Footwear", "Shirts", "Trousers", "Jackets", "Accessories"];

describe("matchCategories", () => {
  it.each([
    ["do you have shoes?", ["Footwear"]],
    ["white sneakers please", ["Footwear"]],
    ["any t-shirts", ["Shirts"]],
    ["I need pants for work", ["Trousers"]],
    ["sunglasses", ["Accessories"]],
    ["a jacket or a belt", ["Jackets", "Accessories"]],
    ["something nice", []],
  ])("%s", (text, expected) => {
    expect(matchCategories(text, categories)).toEqual(expected);
  });
});

describe("findColour", () => {
  it("finds whole colour words only", () => {
    expect(findColour("in black please")).toBe("black");
    expect(findColour("blackberry jam")).toBeNull();
  });
});

describe("buildSearchPlan", () => {
  const base = { previousUserMessage: "", lastShownPrices: [], storeCategories: categories };

  it("reads category, colour, budget and stock from one message", () => {
    const plan = buildSearchPlan({ ...base, message: "black shoes under 3000 that are in stock" });
    expect(plan).toMatchObject({
      followUp: false,
      categories: ["Footwear"],
      colour: "black",
      minPrice: null,
      maxPrice: 3000,
      inStockOnly: true,
      searchText: "black shoes under 3000 that are in stock",
    });
  });

  it("keeps the earlier category and budget for a short follow-up", () => {
    const plan = buildSearchPlan({
      ...base,
      message: "in green",
      previousUserMessage: "trousers under 2500",
    });
    expect(plan).toMatchObject({ followUp: true, categories: ["Trousers"], colour: "green", maxPrice: 2500 });
    expect(plan.searchText).toBe("trousers under 2500\nin green");
  });

  it("turns 'cheaper' into a price cap below what was shown", () => {
    const plan = buildSearchPlan({
      ...base,
      message: "anything cheaper?",
      previousUserMessage: "do you have loafers",
      lastShownPrices: [3299, 2499],
    });
    expect(plan.maxPrice).toBe(2498.99);
    expect(plan.categories).toEqual(["Footwear"]);
  });

  it("does not treat a new full question as a follow-up", () => {
    const plan = buildSearchPlan({
      ...base,
      message: "do you have a leather jacket for winter?",
      previousUserMessage: "shoes under 500",
    });
    expect(plan).toMatchObject({ followUp: false, categories: ["Jackets"], maxPrice: null });
  });
});

describe("rerank", () => {
  const p = (name: string, category: string, similarity: number, stock = "in_stock") => ({
    name,
    description: null,
    category,
    stock_status: stock,
    similarity,
  });

  it("prefers the asked category and colour over raw similarity", () => {
    const plan = buildSearchPlan({
      message: "green trousers",
      previousUserMessage: "",
      lastShownPrices: [],
      storeCategories: categories,
    });
    const ranked = rerank(
      [p("Green Shirt", "Shirts", 0.7), p("White Linen Trousers", "Trousers", 0.6), p("Forest Green Chinos", "Trousers", 0.55)],
      plan,
    );
    expect(ranked.map((r) => r.name)).toEqual(["Forest Green Chinos", "White Linen Trousers", "Green Shirt"]);
  });

  it("pushes out-of-stock items down when the shopper wants stock", () => {
    const plan = buildSearchPlan({
      message: "trousers in stock",
      previousUserMessage: "",
      lastShownPrices: [],
      storeCategories: categories,
    });
    const ranked = rerank([p("Linen", "Trousers", 0.8, "out_of_stock"), p("Chinos", "Trousers", 0.6)], plan);
    expect(ranked.map((r) => r.name)).toEqual(["Chinos", "Linen"]);
  });
});

describe("focusOnCategories", () => {
  const plan = buildSearchPlan({
    message: "anything cheaper?",
    previousUserMessage: "do you have loafers?",
    lastShownPrices: [3299],
    storeCategories: categories,
  });

  it("drops other categories when the asked one has matches", () => {
    const result = focusOnCategories(
      [{ name: "Sneakers", category: "Footwear" }, { name: "Oxford", category: "Shirts" }],
      plan,
    );
    expect(result.map((p) => p.name)).toEqual(["Sneakers"]);
  });

  it("keeps everything when nothing is in the asked category", () => {
    const products = [{ name: "Oxford", category: "Shirts" }];
    expect(focusOnCategories(products, plan)).toEqual(products);
  });
});
