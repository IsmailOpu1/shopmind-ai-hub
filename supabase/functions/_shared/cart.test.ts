import { describe, expect, it } from "vitest";
import { cartTotal, MAX_CART_ITEMS, normalizeCart, resolveCart, wantsCrossSell } from "./cart";

const ID = "74254b78-b0e7-4f7e-b4d8-228010665ce3";

describe("normalizeCart", () => {
  it("keeps ids and SKUs with sane quantities", () => {
    expect(normalizeCart([{ id: ID, quantity: 2 }, { sku: "SNK-01" }])).toEqual([
      { id: ID, sku: null, quantity: 2 },
      { id: null, sku: "SNK-01", quantity: 1 },
    ]);
  });

  it("drops junk and clamps quantities", () => {
    expect(normalizeCart("nope")).toEqual([]);
    expect(normalizeCart([null, 5, { id: "not-a-uuid" }, { name: "Free laptop", price: 0 }])).toEqual([]);
    expect(normalizeCart([{ sku: "A", quantity: -3 }, { sku: "B", quantity: 1e6 }, { sku: "C", quantity: "x" }])).toEqual([
      { id: null, sku: "A", quantity: 1 },
      { id: null, sku: "B", quantity: 99 },
      { id: null, sku: "C", quantity: 1 },
    ]);
  });

  it("merges repeated items and caps the cart size", () => {
    expect(normalizeCart([{ sku: "A" }, { sku: "A", quantity: 2 }])).toEqual([{ id: null, sku: "A", quantity: 3 }]);
    const many = Array.from({ length: 50 }, (_, i) => ({ sku: `S${i}` }));
    expect(normalizeCart(many)).toHaveLength(MAX_CART_ITEMS);
  });
});

describe("resolveCart", () => {
  const products = [
    { id: ID, sku: "SHT-OXF-01", name: "Oxford Shirt", price: 1599, category: "Tops" },
    { id: "5437f414-05c5-4435-9efc-03f152dee767", sku: "SNK-WHT-01", name: "White Sneakers", price: 2499, category: "Footwear" },
  ];

  it("matches by id or SKU, ignores unknown items, and totals from catalog prices", () => {
    const items = resolveCart(normalizeCart([{ sku: "SHT-OXF-01", quantity: 2 }, { id: products[1].id }, { sku: "UNKNOWN" }]), products);
    expect(items.map((i) => [i.product.name, i.quantity])).toEqual([["Oxford Shirt", 2], ["White Sneakers", 1]]);
    expect(cartTotal(items)).toBe(1599 * 2 + 2499);
  });

  it("counts the same product once when sent by id and by SKU", () => {
    const items = resolveCart(normalizeCart([{ id: ID }, { sku: "SHT-OXF-01" }]), products);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });
});

describe("wantsCrossSell", () => {
  it.each([
    "What goes well with the Oxford shirt?",
    "anything else I should get?",
    "complete the look",
    "ok I'm ready to buy",
    "what's in my cart?",
  ])("yes: %s", (m) => expect(wantsCrossSell(m)).toBe(true));

  it.each(["do you have shoes?", "is size M in stock?", "hi"])("no: %s", (m) => expect(wantsCrossSell(m)).toBe(false));
});
