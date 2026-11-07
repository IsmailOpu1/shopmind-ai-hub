import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/utils";

describe("formatPrice", () => {
  it("defaults to taka", () => {
    expect(formatPrice(2500)).toBe("৳2,500");
  });

  it("uses the store's currency symbol", () => {
    expect(formatPrice(19.5, "USD")).toBe("$19.5");
    expect(formatPrice(1000, "INR")).toBe("₹1,000");
  });
});
