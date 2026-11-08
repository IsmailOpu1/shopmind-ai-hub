import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { type InboxConversation, isWaiting, shopperLabel, sortInbox, validateReply } from "./inbox";

const conv = (id: string, status: "open" | "closed", lastRole: "user" | "agent" | "assistant" | null, at: string): InboxConversation => ({
  id,
  session_id: `sess-${id}`,
  handoff_status: status,
  handoff_at: at,
  handoff_reason: null,
  last: lastRole ? { id: `m-${id}`, role: lastRole, content: "x", created_at: at } : null,
});

describe("inbox helpers", () => {
  it("a chat waits when it's open and the shopper spoke last", () => {
    expect(isWaiting(conv("a", "open", "user", "2026-11-08T01:00:00Z"))).toBe(true);
    expect(isWaiting(conv("b", "open", "agent", "2026-11-08T01:00:00Z"))).toBe(false);
    expect(isWaiting(conv("c", "closed", "user", "2026-11-08T01:00:00Z"))).toBe(false);
  });

  it("lists the longest-waiting chat first, then open ones, then closed", () => {
    const sorted = sortInbox([
      conv("closed-new", "closed", "assistant", "2026-11-08T05:00:00Z"),
      conv("open-replied", "open", "agent", "2026-11-08T04:00:00Z"),
      conv("waiting-new", "open", "user", "2026-11-08T03:00:00Z"),
      conv("waiting-old", "open", "user", "2026-11-08T01:00:00Z"),
      conv("closed-old", "closed", "assistant", "2026-11-08T00:00:00Z"),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["waiting-old", "waiting-new", "open-replied", "closed-new", "closed-old"]);
  });

  it("checks replies", () => {
    expect(validateReply("   ")).toMatch(/Write a reply/);
    expect(validateReply("x".repeat(2001))).toMatch(/2000/);
    expect(validateReply("Thanks, it ships tomorrow")).toBeNull();
  });

  it("labels anonymous shoppers by their session's tail", () => {
    expect(shopperLabel("e2e-test-handoff-1a2b")).toBe("Shopper 1a2b");
  });
});
