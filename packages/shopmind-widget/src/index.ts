/**
 * ShopMind chat widget loader for sites built with code (React, Next.js,
 * Vue, plain JS). It adds the same embed script the dashboard shows, so the
 * chat looks and behaves exactly like the copy-paste install.
 */

/** Where the widget script is served (your ShopMind app's address + /embed.js). */
export const DEFAULT_SCRIPT_URL = "https://shopmind-ai-tau.vercel.app/embed.js";

export type CartItem = { sku?: string; id?: string; quantity?: number };

export type ShopMindOptions = {
  /** Your store ID from ShopMind → Chatbot settings. */
  businessId: string;
  /** Override where embed.js is loaded from (e.g. your own domain). */
  scriptUrl?: string;
  /** Settings you'd otherwise change in the dashboard; these win over it. */
  botName?: string;
  greeting?: string;
  primaryColor?: string;
  position?: "bottom-right" | "bottom-left";
  currency?: string;
  avatarUrl?: string;
  /** Seconds before the "Need help?" prompt, or "off". */
  proactiveDelay?: number | "off";
  /** "event" fires a `shopmind:add-to-cart` window event from product cards. */
  cartMode?: "off" | "event" | "url";
  /** For cartMode "url": e.g. "https://shop.com/cart/add?id={sku}". */
  cartUrl?: string;
};

type ShopMindApi = {
  loaded?: boolean;
  cart?: CartItem[];
  setCart?: (items: CartItem[]) => void;
  getCart?: () => CartItem[];
  destroy?: () => void;
};

declare global {
  interface Window {
    ShopMind?: ShopMindApi;
  }
}

const SCRIPT_MARK = "data-shopmind-loader";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let pending: Promise<void> | null = null;

/** The `data-*` attributes the embed script reads, from the options. */
export function scriptAttributes(o: ShopMindOptions): Record<string, string> {
  if (!UUID_RE.test(o.businessId ?? "")) {
    throw new Error("ShopMind: businessId must be the store ID from Chatbot settings.");
  }
  const attrs: Record<string, string> = { "data-business-id": o.businessId };
  const set = (name: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") attrs[name] = String(value);
  };
  set("data-bot-name", o.botName);
  set("data-greeting", o.greeting);
  set("data-primary-color", o.primaryColor);
  set("data-position", o.position);
  set("data-currency", o.currency);
  set("data-avatar", o.avatarUrl);
  set("data-proactive-delay", o.proactiveDelay);
  set("data-cart-mode", o.cartMode);
  set("data-cart-url", o.cartUrl);
  return attrs;
}

/**
 * Adds the chat to the page. Safe to call more than once: later calls
 * return the same promise. Does nothing during server-side rendering.
 */
export function loadShopMind(options: ShopMindOptions): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve();
  if (window.ShopMind?.loaded) return Promise.resolve();
  if (pending) return pending;

  const attrs = scriptAttributes(options);
  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = options.scriptUrl ?? DEFAULT_SCRIPT_URL;
    script.async = true;
    script.setAttribute(SCRIPT_MARK, "");
    for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v);
    script.onload = () => resolve();
    script.onerror = () => {
      pending = null;
      script.remove();
      reject(new Error(`ShopMind: could not load ${script.src}`));
    };
    document.body.appendChild(script);
  });
  return pending;
}

/** Removes the chat from the page (e.g. when leaving a section that shows it). */
export function unloadShopMind(): void {
  if (typeof document === "undefined") return;
  window.ShopMind?.destroy?.();
  document.querySelectorAll(`script[${SCRIPT_MARK}]`).forEach((s) => s.remove());
  pending = null;
}

/**
 * Tells the assistant what's in the shopper's cart (SKUs or product IDs and
 * quantities only). Works before or after the widget has loaded.
 */
export function setShopMindCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  const api = (window.ShopMind = window.ShopMind ?? {});
  if (api.setCart) api.setCart(items);
  else api.cart = items; // picked up when the widget loads
}
