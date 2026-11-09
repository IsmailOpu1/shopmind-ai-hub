"use client";

import { useEffect, useRef } from "react";
import { type CartItem, loadShopMind, setShopMindCart, type ShopMindOptions, unloadShopMind } from "./index.js";

export type ShopMindChatProps = ShopMindOptions & {
  /** The shopper's cart; the assistant is told whenever it changes. */
  cart?: CartItem[];
  /** Remove the chat when this component unmounts (default: keep it). */
  removeOnUnmount?: boolean;
  onError?: (error: Error) => void;
};

/**
 * Drop-in chat for React / Next.js: put it once in your root layout.
 *
 *   <ShopMindChat businessId="your-store-id" />
 */
export function ShopMindChat({ cart, removeOnUnmount = false, onError, ...options }: ShopMindChatProps) {
  // Options are read once, like the script tag; change them in the dashboard.
  const first = useRef(options);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  useEffect(() => {
    loadShopMind(first.current).catch((e: Error) => {
      if (errorRef.current) errorRef.current(e);
      else console.error(e);
    });
    return () => {
      if (removeOnUnmount) unloadShopMind();
    };
  }, [removeOnUnmount]);

  const cartKey = cart ? JSON.stringify(cart) : null;
  useEffect(() => {
    if (cartKey !== null) setShopMindCart(JSON.parse(cartKey) as CartItem[]);
  }, [cartKey]);

  return null;
}

export default ShopMindChat;
// A library entry point, not an app module: re-exports are intended.
// eslint-disable-next-line react-refresh/only-export-components
export { loadShopMind, setShopMindCart, unloadShopMind };
export type { CartItem, ShopMindOptions };
