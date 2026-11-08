import { describe, expect, it } from "vitest";
import { normalizeOrigin, shouldRecordSighting, SIGHTING_REFRESH_MS } from "./install";

describe("normalizeOrigin", () => {
  it("keeps the http(s) origin only", () => {
    expect(normalizeOrigin("https://Shop.Example.com")).toBe("https://shop.example.com");
    expect(normalizeOrigin("https://shop.example.com/products/1?x=2")).toBe("https://shop.example.com");
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects missing, opaque and non-web origins", () => {
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("null")).toBeNull();
    expect(normalizeOrigin("file:///C:/site/index.html")).toBeNull();
    expect(normalizeOrigin("chrome-extension://abc")).toBeNull();
    expect(normalizeOrigin("not a url")).toBeNull();
    expect(normalizeOrigin(`https://${"a".repeat(250)}.com`)).toBeNull();
  });
});

describe("shouldRecordSighting", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  const recent = new Date(now - 60_000).toISOString();
  const old = new Date(now - SIGHTING_REFRESH_MS - 1).toISOString();

  it("records a first sighting or a new website", () => {
    expect(shouldRecordSighting({ origin: null, seenAt: null }, "https://a.com", now)).toBe(true);
    expect(shouldRecordSighting({ origin: "https://a.com", seenAt: recent }, "https://b.com", now)).toBe(true);
  });

  it("refreshes the same website only now and then", () => {
    expect(shouldRecordSighting({ origin: "https://a.com", seenAt: recent }, "https://a.com", now)).toBe(false);
    expect(shouldRecordSighting({ origin: "https://a.com", seenAt: old }, "https://a.com", now)).toBe(true);
  });
});
