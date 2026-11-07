import { describe, expect, it } from "vitest";
import {
  createReplyExtractor,
  isFollowUp,
  isSmallTalk,
  parsePriceRange,
} from "./chat-utils";

describe("parsePriceRange", () => {
  it.each([
    ["jacket under 100", { min: null, max: 100 }],
    ["shoes below ৳2,500", { min: null, max: 2500 }],
    ["anything less than 3k taka?", { min: null, max: 3000 }],
    ["my budget is 1500 tk", { min: null, max: 1500 }],
    ["coats over 5000", { min: 5000, max: null }],
    ["between 1000 and 3000", { min: 1000, max: 3000 }],
    ["price 3000-1000", { min: 1000, max: 3000 }],
    ["show me sneakers", { min: null, max: null }],
    ["do you have size 8-10?", { min: null, max: null }],
  ])("%s", (message, expected) => {
    expect(parsePriceRange(message)).toEqual(expected);
  });
});

describe("isSmallTalk", () => {
  it.each([
    ["hi", true],
    ["Hello there!", true],
    ["thank you", true],
    ["hi, do you have shoes?", false],
    ["ok show me jackets", false],
  ])("%s", (message, expected) => {
    expect(isSmallTalk(message)).toBe(expected);
  });
});

describe("isFollowUp", () => {
  it.each([
    ["which of those is cheaper?", true],
    ["in black", true],
    ["do you have a leather jacket for winter?", false],
  ])("%s", (message, expected) => {
    expect(isFollowUp(message)).toBe(expected);
  });
});

describe("createReplyExtractor", () => {
  const run = (chunks: string[]) => {
    const push = createReplyExtractor();
    return chunks.map((c) => push(c));
  };

  it("streams the reply value as it arrives", () => {
    expect(run(['{"reply": "Hel', 'lo there', '!", "product_refs": ["P1"]}']))
      .toEqual(["Hel", "lo there", "!"]);
  });

  it("waits for the key even when it is split", () => {
    expect(run(['{"product_refs": [], "re', 'ply":"Hi', '"}'])).toEqual(["", "Hi", ""]);
  });

  it("decodes escapes split across chunks", () => {
    // Raw JSON text: \" and ক and \n are JSON escapes, split mid-escape.
    const chunks = [String.raw`{"reply":"a \"`, String.raw`quoted\" \u09`, String.raw`95 line\nnext"}`];
    expect(run(chunks).join("")).toBe('a "quoted" ক line\nnext');
  });

  it("handles a backslash at the very end of a chunk", () => {
    expect(run(['{"reply":"x \\', '"y"}']).join("")).toBe('x "y');
  });

  it("ignores text after the value ends", () => {
    expect(run(['{"reply":"done"', ', "reply2":"x"}'])).toEqual(["done", ""]);
  });
});
