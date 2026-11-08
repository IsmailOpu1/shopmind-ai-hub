import { supabase } from "@/integrations/supabase/client";

export type Platform = "shopify" | "woocommerce";

export const PLATFORM_NAMES: Record<Platform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
};

export type CatalogPreview = {
  url: string;
  total: number;
  truncated: boolean;
  sample: { name: string; price: number | null; image_url: string | null }[];
};

export type SyncResult = { total: number; added: number; updated: number; removed: number; truncated: boolean };

type Action =
  | { action: "preview"; platform: Platform; url: string }
  | { action: "connect"; platform: Platform; url: string }
  | { action: "sync" }
  | { action: "disconnect"; remove_products: boolean };

/** Calls the sync-catalog function as the logged-in owner. */
export async function catalogRequest<T>(body: Action): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) throw new Error("Missing Supabase URL or anon key.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please log in again.");

  const res = await fetch(`${supabaseUrl}/functions/v1/sync-catalog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  });
  let payload: Record<string, unknown> = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : `Request failed (${res.status}).`);
  }
  return payload as T;
}

/** "Added 12, updated 3, removed 1" in plain words. */
export function describeSync(r: SyncResult): string {
  const parts = [
    r.added && `${r.added} added`,
    r.updated && `${r.updated} updated`,
    r.removed && `${r.removed} removed`,
  ].filter(Boolean);
  const head = `${r.total} product${r.total === 1 ? "" : "s"} in sync`;
  const tail = parts.length ? ` (${parts.join(", ")})` : " (no changes)";
  return head + tail + (r.truncated ? ". Only the first 2,000 products are synced." : ".");
}
