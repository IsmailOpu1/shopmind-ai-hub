import { describe, expect, it } from "vitest";
import { buildCartUrl, validateCartTemplate } from "./cart";

describe("validateCartTemplate", () => {
  it.each([
    ["/cart/add?id={sku}", null],
    ["https://shop.example.com/cart?add={id}", null],
    ["", "Enter your store's add-to-cart link."],
    ["javascript:alert(1)//{id}", "The link must start with https://, http:// or a single /."],
    ["//evil.example/cart?add={id}", "The link must start with https://, http:// or a single /."],
    ["/\\evil.example/cart?add={id}", "The link must start with https://, http:// or a single /."],
    ["/cart", "Include {id}, {sku} or {product_url} so the link points at the right product."],
  ])("%s", (template, expected) => {
    expect(validateCartTemplate(template)).toBe(expected);
  });
});

describe("buildCartUrl", () => {
  const product = { id: "p-1", sku: "VAR 42", product_url: "https://s.com/p?a=1" };

  it("fills and encodes placeholders", () => {
    expect(buildCartUrl("/cart/add?id={sku}&qty=1", product)).toBe("/cart/add?id=VAR%2042&qty=1");
    expect(buildCartUrl("https://s.com/add?u={product_url}", product)).toBe(
      "https://s.com/add?u=https%3A%2F%2Fs.com%2Fp%3Fa%3D1",
    );
  });

  it("returns null when a value is missing", () => {
    expect(buildCartUrl("/cart/add?id={sku}", { id: "p-2", sku: null })).toBeNull();
  });

  it("rejects templates that aren't web or relative links", () => {
    expect(buildCartUrl("javascript:{id}", product)).toBeNull();
  });
});
