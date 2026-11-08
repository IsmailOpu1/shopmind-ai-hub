import { describe, expect, it } from "vitest";
import { NAV_ITEMS, navItemFor } from "./nav";

describe("navItemFor", () => {
  it("matches each dashboard page", () => {
    for (const item of NAV_ITEMS) expect(navItemFor(item.url)?.title).toBe(item.title);
  });

  it("handles trailing slashes and sub-pages, never matching Home by prefix", () => {
    expect(navItemFor("/dashboard/")?.title).toBe("Home");
    expect(navItemFor("/dashboard/inbox/abc")?.title).toBe("Inbox");
    expect(navItemFor("/dashboard/unknown")).toBeNull();
  });
});
