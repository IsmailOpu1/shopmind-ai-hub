import { describe, expect, it } from "vitest";
import {
  chunkDocument,
  describeVariants,
  findSize,
  normalizeVariants,
  sizeAvailability,
  variantsSearchText,
} from "./store-knowledge";

describe("chunkDocument", () => {
  it("keeps a short document in one chunk", () => {
    expect(chunkDocument("We deliver all over Bangladesh.\n\nDhaka: 1-2 days.")).toEqual([
      "We deliver all over Bangladesh.\n\nDhaka: 1-2 days.",
    ]);
  });

  it("packs paragraphs up to the limit without splitting them", () => {
    const p = "x".repeat(400);
    const chunks = chunkDocument([p, p, p].join("\n\n"), 900);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(`${p}\n\n${p}`);
    expect(chunks[1]).toBe(p);
  });

  it("starts a new paragraph at each FAQ question", () => {
    const faq = "Q: Do you deliver outside Dhaka?\nYes, everywhere.\nQ: Cash on delivery?\nYes.";
    const chunks = chunkDocument(faq, 60);
    expect(chunks[0]).toBe("Q: Do you deliver outside Dhaka?\nYes, everywhere.");
    expect(chunks[1]).toBe("Q: Cash on delivery?\nYes.");
  });

  it("cuts an over-long paragraph at sentence ends", () => {
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = chunkDocument(long, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
    expect(chunks[0].endsWith(".")).toBe(true);
  });

  it("returns nothing for blank text", () => {
    expect(chunkDocument("  \n\n ")).toEqual([]);
  });
});

describe("variants", () => {
  const variants = normalizeVariants([
    { colour: "Black", size: "M", stock_status: "in_stock" },
    { colour: "Black", size: "L", stock_status: "out_of_stock" },
    { size: "XXL" },
    { nonsense: true },
    "bad",
  ]);

  it("cleans the stored JSON", () => {
    expect(variants).toEqual([
      { colour: "Black", size: "M", stock_status: "in_stock" },
      { colour: "Black", size: "L", stock_status: "out_of_stock" },
      { colour: undefined, size: "XXL", stock_status: "in_stock" },
    ]);
  });

  it("describes them for the reply model", () => {
    expect(describeVariants(variants)).toBe("Black/M (in stock), Black/L (OUT OF STOCK), XXL (in stock)");
  });

  it("lists colours and sizes for search", () => {
    expect(variantsSearchText(variants)).toBe("Colours: Black. Sizes: M, L, XXL");
  });

  it("answers size availability", () => {
    expect(sizeAvailability(variants, "m")).toBe("in_stock");
    expect(sizeAvailability(variants, "L")).toBe("out_of_stock");
    expect(sizeAvailability(variants, "2XL")).toBe("in_stock");
    expect(sizeAvailability(variants, "S")).toBe("not_offered");
  });
});

describe("findSize", () => {
  it.each([
    ["Is size M in stock?", "M"],
    ["do you have it in size 42", "42"],
    ["medium size please", "M"],
    ["any XL?", "XL"],
    ["size: xxl", "XXL"],
    ["free size?", "Free size"],
    ["I'm looking for a small bag", null],
    ["show me shoes", null],
  ])("%s", (text, expected) => {
    expect(findSize(text)).toBe(expected);
  });
});
