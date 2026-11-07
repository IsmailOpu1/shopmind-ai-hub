import { describe, expect, it } from "vitest";
import { parseVariants, stockFromVariants, summarizeVariants } from "./variants";

describe("parseVariants", () => {
  it("reads sizes with an out-of-stock flag", () => {
    expect(parseVariants("S, M, L:out").variants).toEqual([
      { size: "S", stock_status: "in_stock" },
      { size: "M", stock_status: "in_stock" },
      { size: "L", stock_status: "out_of_stock" },
    ]);
  });

  it("reads colour/size pairs", () => {
    expect(parseVariants("Black/M; Navy/L:sold out").variants).toEqual([
      { colour: "Black", size: "M", stock_status: "in_stock" },
      { colour: "Navy", size: "L", stock_status: "out_of_stock" },
    ]);
  });

  it("tells sizes from colours when there is no slash", () => {
    expect(parseVariants("XL, 42, free size, Olive Green").variants).toEqual([
      { size: "XL", stock_status: "in_stock" },
      { size: "42", stock_status: "in_stock" },
      { size: "free size", stock_status: "in_stock" },
      { colour: "Olive Green", stock_status: "in_stock" },
    ]);
  });

  it("returns nothing for an empty cell", () => {
    expect(parseVariants("")).toEqual({ variants: [], error: null });
    expect(parseVariants(undefined)).toEqual({ variants: [], error: null });
  });

  it("rejects unknown stock flags and too many variants", () => {
    expect(parseVariants("M:maybe").error).toMatch(/Unknown stock flag/);
    const many = Array.from({ length: 51 }, (_, i) => String(i + 1)).join(",");
    expect(parseVariants(many).error).toMatch(/limit is 50/);
  });
});

describe("stockFromVariants", () => {
  it("is in stock when any variant is", () => {
    expect(stockFromVariants(parseVariants("S:out, M").variants)).toBe("in_stock");
    expect(stockFromVariants(parseVariants("S:out, M:out").variants)).toBe("out_of_stock");
    expect(stockFromVariants([])).toBeNull();
  });
});

describe("summarizeVariants", () => {
  it("lists labels and counts sold-out ones", () => {
    expect(summarizeVariants(parseVariants("Black/M, Black/L:out").variants)).toBe("Black/M, Black/L · 1 sold out");
    expect(summarizeVariants([])).toBe("");
  });
});
