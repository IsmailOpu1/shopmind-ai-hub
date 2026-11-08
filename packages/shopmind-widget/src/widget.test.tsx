import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { DEFAULT_SCRIPT_URL, loadShopMind, scriptAttributes, setShopMindCart, unloadShopMind } from "./index";
import { ShopMindChat } from "./react";

const BIZ = "491b3c9c-41cd-4bc8-8a16-1e4965a85667";
const scripts = () => [...document.querySelectorAll("script[data-shopmind-loader]")] as HTMLScriptElement[];

afterEach(() => {
  unloadShopMind();
  delete window.ShopMind;
});

describe("scriptAttributes", () => {
  it("maps options to the embed script's data attributes", () => {
    expect(scriptAttributes({ businessId: BIZ, botName: "Mira", position: "bottom-left", proactiveDelay: "off" })).toEqual({
      "data-business-id": BIZ,
      "data-bot-name": "Mira",
      "data-position": "bottom-left",
      "data-proactive-delay": "off",
    });
  });

  it("rejects a missing or wrong store ID", () => {
    expect(() => scriptAttributes({ businessId: "abc" })).toThrow("store ID");
  });
});

describe("loadShopMind", () => {
  it("adds the script once and resolves when it loads", async () => {
    const first = loadShopMind({ businessId: BIZ });
    const again = loadShopMind({ businessId: BIZ });
    expect(again).toBe(first);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toBe(DEFAULT_SCRIPT_URL);
    expect(scripts()[0].getAttribute("data-business-id")).toBe(BIZ);
    scripts()[0].onload?.(new Event("load"));
    await expect(first).resolves.toBeUndefined();
  });

  it("does nothing when the widget is already on the page", async () => {
    window.ShopMind = { loaded: true };
    await loadShopMind({ businessId: BIZ });
    expect(scripts()).toHaveLength(0);
  });

  it("rejects and cleans up when the script fails to load", async () => {
    const p = loadShopMind({ businessId: BIZ, scriptUrl: "https://example.com/embed.js" });
    scripts()[0].onerror?.(new Event("error"));
    await expect(p).rejects.toThrow("could not load");
    expect(scripts()).toHaveLength(0);
  });
});

describe("setShopMindCart", () => {
  it("queues the cart before load and uses setCart after", () => {
    setShopMindCart([{ sku: "A", quantity: 1 }]);
    expect(window.ShopMind?.cart).toEqual([{ sku: "A", quantity: 1 }]);
    const setCart = vi.fn();
    window.ShopMind = { setCart };
    setShopMindCart([{ sku: "B" }]);
    expect(setCart).toHaveBeenCalledWith([{ sku: "B" }]);
  });
});

describe("<ShopMindChat>", () => {
  it("loads the widget, passes the cart, and can remove itself on unmount", () => {
    const destroy = vi.fn();
    const { rerender, unmount } = render(<ShopMindChat businessId={BIZ} cart={[{ sku: "A" }]} removeOnUnmount />);
    expect(scripts()).toHaveLength(1);
    expect(window.ShopMind?.cart).toEqual([{ sku: "A" }]);

    const setCart = vi.fn();
    window.ShopMind = { ...window.ShopMind, setCart, destroy };
    rerender(<ShopMindChat businessId={BIZ} cart={[{ sku: "A" }, { sku: "B" }]} removeOnUnmount />);
    expect(setCart).toHaveBeenCalledWith([{ sku: "A" }, { sku: "B" }]);

    unmount();
    expect(destroy).toHaveBeenCalled();
    expect(scripts()).toHaveLength(0);
  });
});
