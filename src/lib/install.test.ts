import { describe, expect, it } from "vitest";
import {
  INSTALL_GUIDES,
  RECENT_SIGHTING_MS,
  developerEmail,
  isRecentSighting,
  normalizeSiteUrl,
  siteMatches,
  timeAgo,
} from "./install";

describe("normalizeSiteUrl", () => {
  it("accepts what owners type", () => {
    expect(normalizeSiteUrl("myshop.com")).toBe("https://myshop.com/");
    expect(normalizeSiteUrl("  https://www.myshop.com/shop  ")).toBe("https://www.myshop.com/shop");
    expect(normalizeSiteUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it("rejects things that aren't a website", () => {
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl("my shop")).toBeNull();
    expect(normalizeSiteUrl("myshop")).toBeNull();
    expect(normalizeSiteUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("siteMatches", () => {
  it("matches the same host with or without www", () => {
    expect(siteMatches("https://www.myshop.com", "https://myshop.com/")).toBe(true);
    expect(siteMatches("https://myshop.com", "https://www.myshop.com/products")).toBe(true);
  });

  it("does not match a different site", () => {
    expect(siteMatches("https://myshop.myshopify.com", "https://myshop.com/")).toBe(false);
    expect(siteMatches(null, "https://myshop.com/")).toBe(false);
  });
});

describe("isRecentSighting / timeAgo", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  it("treats the last 15 minutes as recent", () => {
    expect(isRecentSighting(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(isRecentSighting(new Date(now - RECENT_SIGHTING_MS - 1).toISOString(), now)).toBe(false);
    expect(isRecentSighting(null, now)).toBe(false);
  });

  it("says how long ago in words", () => {
    expect(timeAgo(new Date(now - 20_000).toISOString(), now)).toBe("just now");
    expect(timeAgo(new Date(now - 60_000).toISOString(), now)).toBe("1 minute ago");
    expect(timeAgo(new Date(now - 3 * 3600_000).toISOString(), now)).toBe("3 hours ago");
    expect(timeAgo(new Date(now - 2 * 86400_000).toISOString(), now)).toBe("2 days ago");
  });
});

describe("guides", () => {
  it("covers the common builders, each with steps", () => {
    expect(INSTALL_GUIDES.map((g) => g.id)).toEqual(["shopify", "wix", "wordpress", "squarespace", "webflow", "other"]);
    for (const g of INSTALL_GUIDES) expect(g.steps.length).toBeGreaterThan(1);
  });

  it("puts the code in the developer email", () => {
    const link = developerEmail('<script src="x"></script>');
    expect(link.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(link.split("&body=")[1])).toContain('<script src="x"></script>');
  });
});
