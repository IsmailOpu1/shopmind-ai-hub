// Connects a store's live Shopify / WooCommerce catalog and keeps it in sync.
// Owner-only: the store is found from the caller's login, never the body.
//
// POST { action: "preview", platform, url }  -> { total, truncated, sample[] }
// POST { action: "connect", platform, url }  -> sync result
// POST { action: "sync" }                    -> sync result
// POST { action: "disconnect", remove_products?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CatalogError, normalizeStoreUrl, type Platform, PLATFORMS, readCatalog, resolveHost } from "../_shared/catalog.ts";
import { syncCatalog } from "../_shared/catalog-sync.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server is not configured" }, 500);
  const supabase = createClient(supabaseUrl, serviceKey);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return json({ error: "Please log in again." }, 401);

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id, catalog_platform, catalog_url")
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (bizError || !business) return json({ error: "Store not found" }, 404);

  let body: { action?: unknown; platform?: unknown; url?: unknown; remove_products?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const platform = PLATFORMS.includes(body.platform as Platform) ? (body.platform as Platform) : null;
  const url = normalizeStoreUrl(body.url);

  try {
    switch (body.action) {
      case "preview": {
        if (!platform || !url) return json({ error: "Choose your platform and enter your store's address." }, 400);
        const { products, truncated } = await readCatalog(platform, url, fetch, resolveHost, 250);
        return json({
          url,
          total: products.length,
          truncated,
          sample: products.slice(0, 4).map((p) => ({ name: p.name, price: p.price, image_url: p.image_url })),
        });
      }
      case "connect": {
        if (!platform || !url) return json({ error: "Choose your platform and enter your store's address." }, 400);
        if (business.catalog_platform && (business.catalog_platform !== platform || business.catalog_url !== url)) {
          return json({ error: "Disconnect the current store first." }, 409);
        }
        const { error } = await supabase
          .from("businesses")
          .update({ catalog_platform: platform, catalog_url: url, catalog_sync_error: null })
          .eq("id", business.id);
        if (error) throw new Error(`save connection: ${error.message}`);
        return json(await syncCatalog(supabase, business.id, platform, url, fetch, resolveHost));
      }
      case "sync": {
        if (!business.catalog_platform || !business.catalog_url) return json({ error: "No store is connected." }, 400);
        return json(
          await syncCatalog(
            supabase,
            business.id,
            business.catalog_platform as Platform,
            business.catalog_url,
            fetch,
            resolveHost,
          ),
        );
      }
      case "disconnect": {
        const from = business.catalog_platform;
        if (from) {
          // Keep the products as ordinary ones unless the owner wants them gone.
          const products = supabase.from("products");
          const { error } = body.remove_products === true
            ? await products.delete().eq("business_id", business.id).eq("source", from)
            : await products.update({ source: "manual", external_id: null }).eq("business_id", business.id).eq(
              "source",
              from,
            );
          if (error) throw new Error(`disconnect products: ${error.message}`);
        }
        const { error } = await supabase
          .from("businesses")
          .update({
            catalog_platform: null,
            catalog_url: null,
            catalog_synced_at: null,
            catalog_sync_started_at: null,
            catalog_sync_error: null,
            catalog_product_count: null,
          })
          .eq("id", business.id);
        if (error) throw new Error(`disconnect: ${error.message}`);
        return json({ disconnected: true });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    if (e instanceof CatalogError) return json({ error: e.message }, e.status);
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      return json({ error: "Your store took too long to answer. Try again in a minute." }, 504);
    }
    console.error("sync-catalog:", e instanceof Error ? e.message : String(e));
    return json({ error: "Something went wrong while reading your store. Try again later." }, 500);
  }
});
