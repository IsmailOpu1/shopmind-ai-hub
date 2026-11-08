import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const db = vi.hoisted(() => ({ row: { widget_seen_at: null as string | null, widget_seen_origin: null as string | null } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: db.row, error: null }) }) }),
    }),
  },
}));

import InstallGuide from "./InstallGuide";
import InstallCheck from "./InstallCheck";

const BIZ = "491b3c9c-41cd-4bc8-8a16-1e4965a85667";

describe("InstallGuide", () => {
  it("shows the steps for the builder picked", () => {
    render(<InstallGuide snippet="<script></script>" />);
    expect(screen.getByRole("button", { name: "Shopify" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list", { name: "Steps for Shopify" })).toHaveTextContent("theme.liquid");

    fireEvent.click(screen.getByRole("button", { name: "Wix" }));
    expect(screen.getByRole("list", { name: "Steps for Wix" })).toHaveTextContent("Body - end");
    expect(screen.getByText(/Premium/)).toBeInTheDocument();
    expect(screen.queryByText("Email the code to my developer")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Other / my developer" }));
    expect(screen.getByText("Email the code to my developer").closest("a")).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:"),
    );
  });
});

describe("InstallCheck", () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    open = vi.fn();
    vi.stubGlobal("open", open);
    db.row = { widget_seen_at: null, widget_seen_origin: null };
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const run = async (site: string) => {
    render(<InstallCheck businessId={BIZ} initial={{ seenAt: null, origin: null }} />);
    fireEvent.change(screen.getByLabelText("Your website address"), { target: { value: site } });
    fireEvent.click(screen.getByRole("button", { name: /Check my site/ }));
  };

  it("asks for a valid address", async () => {
    await run("my shop");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your website address");
    expect(open).not.toHaveBeenCalled();
  });

  it("opens the site and confirms once the widget reports in", async () => {
    await run("myshop.com");
    expect(open).toHaveBeenCalledWith("https://myshop.com/", "_blank", "noopener");
    expect(screen.getByText(/Keep it open/)).toBeInTheDocument();

    db.row = { widget_seen_at: new Date().toISOString(), widget_seen_origin: "https://www.myshop.com" };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(screen.getByText("It works! The chat is on your website.")).toBeInTheDocument();
    expect(localStorage.getItem(`shopmind_site_${BIZ}`)).toBe("myshop.com");
  });

  it("says when it can't find the chat", async () => {
    await run("myshop.com");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50_000);
    });
    expect(screen.getByText("We couldn't find the chat on your website yet.")).toBeInTheDocument();
  });

  it("says when the chat is on a different address", async () => {
    db.row = { widget_seen_at: new Date().toISOString(), widget_seen_origin: "https://myshop.myshopify.com" };
    await run("myshop.com");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50_000);
    });
    expect(screen.getByText("The chat is installed, but on a different address.")).toBeInTheDocument();
  });
});
