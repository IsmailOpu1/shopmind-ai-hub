// Writes a store's live catalog into ShopMind: adds new products, updates
// changed ones (their AI search entry is rebuilt by the embedding trigger),
// and removes products the store no longer sells.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  type CatalogProduct,
  CatalogError,
  type Fetcher,
  type Platform,
  readCatalog,
  type Resolver,
} from "./catalog.ts";

/** Fields a sync owns; manual-only fields (none today) are left alone. */
const SYNCED_FIELDS = [
  "name",
  "description",
  "category",
  "price",
  "image_url",
  "product_url",
  "sku",
  "stock_status",
  "promo",
  "variants",
] as const;

export type ExistingRow = { id: string; external_id: string } & Record<(typeof SYNCED_FIELDS)[number], unknown>;

export type SyncPlan = {
  inserts: CatalogProduct[];
  /** Products whose synced fields changed, with the row id to update. */
  updates: (CatalogProduct & { id: string })[];
  deletes: string[];
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** What to insert, update and delete so the database matches the store. */
export function planSync(existing: ExistingRow[], incoming: CatalogProduct[]): SyncPlan {
  const byExternal = new Map(existing.map((r) => [r.external_id, r]));
  const plan: SyncPlan = { inserts: [], updates: [], deletes: [] };
  const keep = new Set<string>();
  for (const p of incoming) {
    const row = byExternal.get(p.external_id);
    if (!row) {
      plan.inserts.push(p);
      continue;
    }
    keep.add(row.id);
    const changed = SYNCED_FIELDS.some((f) => {
      const next = f === "price" && p.price !== null ? Number(p.price) : p[f];
      const prev = f === "price" && row.price !== null ? Number(row.price) : row[f];
      return !same(prev, next);
    });
    if (changed) plan.updates.push({ ...p, id: row.id });
  }
  for (const r of existing) if (!keep.has(r.id)) plan.deletes.push(r.id);
  return plan;
}

export type SyncResult = { total: number; added: number; updated: number; removed: number; truncated: boolean };

// Edge functions stop after a few minutes, so an older lock is abandoned.
const STALE_LOCK_MS = 3 * 60 * 1000;
// After a failed sync, automatic retries wait this long (manual ones don't).
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
const CHUNK = 200;

/**
 * Takes the per-store sync lock (so two syncs never run at once). Returns
 * false when another sync started in the last 3 minutes.
 */
async function takeLock(supabase: SupabaseClient, businessId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  const { data, error } = await supabase
    .from("businesses")
    .update({ catalog_sync_started_at: new Date().toISOString() })
    .eq("id", businessId)
    .or(`catalog_sync_started_at.is.null,catalog_sync_started_at.lt.${staleBefore}`)
    .select("id");
  if (error) throw new Error(`sync lock: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function syncCatalog(
  supabase: SupabaseClient,
  businessId: string,
  platform: Platform,
  baseUrl: string,
  fetcher: Fetcher,
  resolve: Resolver | null,
): Promise<SyncResult> {
  if (!(await takeLock(supabase, businessId))) {
    throw new CatalogError("A sync is already running for this store. Try again in a few minutes.", 409);
  }
  try {
    const { products, truncated } = await readCatalog(platform, baseUrl, fetcher, resolve);

    const { data: rows, error } = await supabase
      .from("products")
      .select(`id, external_id, ${SYNCED_FIELDS.join(", ")}`)
      .eq("business_id", businessId)
      .eq("source", platform);
    if (error) throw new Error(`load products: ${error.message}`);
    const plan = planSync((rows ?? []) as unknown as ExistingRow[], products);

    for (let i = 0; i < plan.inserts.length; i += CHUNK) {
      const batch = plan.inserts.slice(i, i + CHUNK).map((p) => ({ ...p, business_id: businessId, source: platform }));
      const { error: e } = await supabase.from("products").insert(batch);
      if (e) throw new Error(`add products: ${e.message}`);
    }
    // Changed products are rewritten in batches; the embedding trigger
    // clears their AI search entry only when the content really changed.
    for (let i = 0; i < plan.updates.length; i += CHUNK) {
      const batch = plan.updates.slice(i, i + CHUNK).map((p) => ({ ...p, business_id: businessId, source: platform }));
      const { error: e } = await supabase.from("products").upsert(batch, { onConflict: "id" });
      if (e) throw new Error(`update products: ${e.message}`);
    }
    for (let i = 0; i < plan.deletes.length; i += CHUNK) {
      const { error: e } = await supabase
        .from("products")
        .delete()
        .eq("business_id", businessId)
        .in("id", plan.deletes.slice(i, i + CHUNK));
      if (e) throw new Error(`remove products: ${e.message}`);
    }

    await supabase
      .from("businesses")
      .update({
        catalog_synced_at: new Date().toISOString(),
        catalog_sync_started_at: null,
        catalog_sync_error: null,
        catalog_product_count: products.length,
      })
      .eq("id", businessId);
    return {
      total: products.length,
      added: plan.inserts.length,
      updated: plan.updates.length,
      removed: plan.deletes.length,
      truncated,
    };
  } catch (e) {
    if (e instanceof CatalogError && e.status === 409) throw e;
    const message = e instanceof CatalogError ? e.message : "The sync stopped unexpectedly. Try again later.";
    // catalog_sync_started_at stays as the time of this attempt, so automatic
    // retries back off (see needsAutoSync); the lock itself expires in 3 min.
    await supabase
      .from("businesses")
      .update({ catalog_sync_error: message.slice(0, 500) })
      .eq("id", businessId);
    throw e;
  }
}

/** Syncs again when a connected store's catalog is older than this. */
export const AUTO_SYNC_AFTER_MS = 6 * 60 * 60 * 1000;

export function needsAutoSync(
  b: {
    catalog_platform: string | null;
    catalog_synced_at: string | null;
    catalog_sync_started_at: string | null;
    catalog_sync_error: string | null;
  },
  now = Date.now(),
): boolean {
  if (!b.catalog_platform) return false;
  const lastAttempt = b.catalog_sync_started_at ? Date.parse(b.catalog_sync_started_at) : NaN;
  if (now - lastAttempt < STALE_LOCK_MS) return false; // running
  if (b.catalog_sync_error && now - lastAttempt < RETRY_AFTER_FAILURE_MS) return false; // backing off
  return !b.catalog_synced_at || now - Date.parse(b.catalog_synced_at) >= AUTO_SYNC_AFTER_MS;
}
