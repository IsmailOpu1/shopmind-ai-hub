import { supabase } from "@/integrations/supabase/client";

/**
 * Asks the embed-products function to index every product of the store that
 * has no AI search embedding yet. Resolves with how many were indexed.
 */
export async function indexProducts(businessId: string): Promise<number> {
  return (await indexStore(businessId)).products;
}

/**
 * Indexes everything new or edited in the store: products without an
 * embedding and store documents (FAQ, shipping...) not yet searchable.
 */
export async function indexStore(businessId: string): Promise<{ products: number; documents: number }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase URL or anon key.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("No session; sign in again to update the AI search.");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/embed-products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ business_id: businessId }),
  });

  let payload: { error?: string; embedded_count?: number; documents_indexed?: number } = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error
        ? payload.error
        : `Indexing failed (${res.status}). Your changes were saved.`,
    );
  }
  return { products: payload.embedded_count ?? 0, documents: payload.documents_indexed ?? 0 };
}
