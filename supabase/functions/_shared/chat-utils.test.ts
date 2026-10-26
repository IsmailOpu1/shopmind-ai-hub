import { describe, expect, it } from "vitest";
import { isFollowUp, isSmallTalk, parsePriceRange } from "./chat-utils";

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
