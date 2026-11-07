import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Analytics from "./Analytics";

const sample = {
  days: 7,
  totals: {
    conversations: 5,
    shopper_messages: 7,
    replies: 7,
    fallback_replies: 4,
    cards_shown: 5,
    view_clicks: 1,
    cart_clicks: 2,
    gap_questions: 2,
  },
  daily: [{ day: "2026-11-07", conversations: 5, messages: 7 }],
  top_questions: [{ question: "any discounts on sunglasses", count: 2 }],
  gaps: [
    { question: "shoes under 500 taka", reason: "no_budget_match", count: 1, last_asked: "2026-11-07T05:18:16Z" },
    { question: "do you sell laptops", reason: "no_match", count: 1, last_asked: "2026-11-07T05:18:10Z" },
  ],
  products: [{ product_id: "p1", name: "Tortoise Sunglasses", shown: 3, views: 0, carts: 2 }],
};

const rpc = vi.fn(() => Promise.resolve({ data: sample, error: null }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "owner-1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "biz-1" }, error: null }) }),
      }),
    }),
    rpc: (...args: unknown[]) => rpc(...(args as [])),
  },
}));

beforeAll(() => {
  // recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("Analytics page", () => {
  it("shows the store's numbers, gaps and products", async () => {
    render(<Analytics />);

    expect(await screen.findByText("Tortoise Sunglasses")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("store_analytics", expect.objectContaining({ p_business_id: "biz-1", p_days: 30 }));

    expect(screen.getByText("57%")).toBeInTheDocument(); // 4 of 7 replies from the backup model
    expect(screen.getByText("do you sell laptops")).toBeInTheDocument();
    expect(screen.getByText("No product or store info found")).toBeInTheDocument();
    expect(screen.getByText("Nothing in budget")).toBeInTheDocument();
    expect(screen.getByText("any discounts on sunglasses")).toBeInTheDocument();
    expect(screen.getByText("40% of cards")).toBeInTheDocument(); // 2 add-to-cart clicks of 5 cards shown
    expect(screen.getByText("20% of cards")).toBeInTheDocument(); // 1 view click of 5 cards shown
  });

  it("reloads for a different range", async () => {
    render(<Analytics />);
    await screen.findAllByText("Tortoise Sunglasses");
    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenLastCalledWith("store_analytics", expect.objectContaining({ p_days: 7 })),
    );
  });
});
