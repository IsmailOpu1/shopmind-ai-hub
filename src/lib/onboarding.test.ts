import { describe, expect, it } from "vitest";
import { isShopperSession, nextStep, onboardingSteps, progress, type OnboardingState } from "./onboarding";

const fresh: OnboardingState = { productCount: 0, unindexedCount: 0, shopperChats: 0, flags: {} };

describe("onboardingSteps", () => {
  it("starts at the catalog upload with nothing done", () => {
    const steps = onboardingSteps(fresh);
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false, false, false]);
    expect(nextStep(steps)?.id).toBe("upload");
    expect(progress(steps)).toBe(0);
  });

  it("does not count indexing as done before any products exist", () => {
    const steps = onboardingSteps({ ...fresh, unindexedCount: 0 });
    expect(steps.find((s) => s.id === "index")?.done).toBe(false);
  });

  it("points at indexing when uploaded products are waiting", () => {
    const steps = onboardingSteps({ ...fresh, productCount: 12, unindexedCount: 3 });
    expect(nextStep(steps)?.id).toBe("index");
    expect(steps[1].description).toBe("3 products are waiting to be indexed.");
  });

  it("uses the stored owner actions and real shopper chats", () => {
    const steps = onboardingSteps({
      productCount: 12,
      unindexedCount: 0,
      shopperChats: 1,
      flags: { customized_at: "x", tested_at: "x", embed_copied_at: "x" },
    });
    expect(nextStep(steps)).toBeUndefined();
    expect(progress(steps)).toBe(100);
  });
});

describe("isShopperSession", () => {
  it.each([
    ["b8e5b522-4467-4d38-8af9-972b1f69f25d", true],
    ["dash-b8e5b522-4467-4d38-8af9-972b1f69f25d", false],
    ["e2e-test-mhx1-0", false],
  ])("%s -> %s", (id, expected) => {
    expect(isShopperSession(id)).toBe(expected);
  });
});
