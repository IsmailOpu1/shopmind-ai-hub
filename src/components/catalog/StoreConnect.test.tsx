import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/catalog", async (orig) => ({
  ...(await orig<typeof import("@/lib/catalog")>()),
  catalogRequest: request,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));

import StoreConnect from "./StoreConnect";
import { describeSync } from "@/lib/catalog";

const none = { platform: null, url: null, syncedAt: null, error: null, count: null };

beforeEach(() => request.mockReset());

describe("StoreConnect", () => {
  it("previews the store's products, then connects", async () => {
    const onChanged = vi.fn();
    request
      .mockResolvedValueOnce({ url: "https://myshop.com", total: 12, truncated: false, sample: [{ name: "Linen Shirt", price: 45, image_url: null }] })
      .mockResolvedValueOnce({ total: 12, added: 12, updated: 0, removed: 0, truncated: false });
    render(<StoreConnect connection={none} currency="USD" onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: "WooCommerce" }));
    fireEvent.change(screen.getByLabelText("Store address"), { target: { value: "myshop.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Find my products/ }));

    expect(await screen.findByText(/Found 12 products/)).toBeInTheDocument();
    expect(screen.getByText("Linen Shirt")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith({ action: "preview", platform: "woocommerce", url: "myshop.com" });

    fireEvent.click(screen.getByRole("button", { name: /Connect and import/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(request).toHaveBeenLastCalledWith({ action: "connect", platform: "woocommerce", url: "myshop.com" });
  });

  it("shows the server's explanation when the store can't be read", async () => {
    request.mockRejectedValueOnce(new Error("We couldn't read products from that address."));
    render(<StoreConnect connection={none} currency="USD" onChanged={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Store address"), { target: { value: "blog.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Find my products/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't read products");
  });

  it("when connected: shows the status, syncs and reports a failed last sync", async () => {
    const onChanged = vi.fn();
    request.mockResolvedValueOnce({ total: 5, added: 0, updated: 2, removed: 1, truncated: false });
    render(
      <StoreConnect
        connection={{ platform: "shopify", url: "https://myshop.com", syncedAt: new Date().toISOString(), error: "Your store took too long to answer.", count: 5 }}
        currency="USD"
        onChanged={onChanged}
      />,
    );
    expect(screen.getByText(/Connected to Shopify/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Last sync failed");
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith({ action: "sync" });
  });
});

describe("describeSync", () => {
  it("summarises in plain words", () => {
    expect(describeSync({ total: 3, added: 1, updated: 0, removed: 2, truncated: false })).toBe("3 products in sync (1 added, 2 removed).");
    expect(describeSync({ total: 1, added: 0, updated: 0, removed: 0, truncated: false })).toBe("1 product in sync (no changes).");
  });
});
