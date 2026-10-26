import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: "৳",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

export const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export function formatPrice(price: number | null | undefined, currency = "BDT"): string {
  if (price === null || price === undefined || !Number.isFinite(Number(price))) return "";
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Number(price).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
