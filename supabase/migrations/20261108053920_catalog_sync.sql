-- Live catalog: products can come from the owner's Shopify or WooCommerce
-- store and are kept in sync by the sync-catalog function.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE public.products ADD CONSTRAINT products_source_check
  CHECK (source IN ('manual', 'shopify', 'woocommerce'));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_external_id_length;
ALTER TABLE public.products ADD CONSTRAINT products_external_id_length
  CHECK (external_id IS NULL OR char_length(external_id) <= 100);

CREATE UNIQUE INDEX IF NOT EXISTS products_external_key
  ON public.products (business_id, source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS catalog_platform text,
  ADD COLUMN IF NOT EXISTS catalog_url text,
  ADD COLUMN IF NOT EXISTS catalog_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS catalog_sync_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS catalog_sync_error text,
  ADD COLUMN IF NOT EXISTS catalog_product_count integer;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_catalog_shape;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_catalog_shape CHECK (
  (catalog_platform IS NULL OR catalog_platform IN ('shopify', 'woocommerce'))
  AND (catalog_url IS NULL OR (catalog_url ~ '^https://' AND char_length(catalog_url) <= 200))
  AND (catalog_sync_error IS NULL OR char_length(catalog_sync_error) <= 500)
);

-- Owners must not set the sync bookkeeping themselves (only the function
-- does, with the service role): keep the columns but block client writes.
REVOKE UPDATE (catalog_platform, catalog_url, catalog_synced_at, catalog_sync_started_at,
               catalog_sync_error, catalog_product_count, widget_seen_at, widget_seen_origin)
  ON public.businesses FROM anon, authenticated;
