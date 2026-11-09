-- Security hardening (no behaviour change for the app).

-- 1. Owners write only the product fields the dashboard edits. The AI search
--    data (embedding, fts), ids, timestamps and the sync bookkeeping
--    (source, external_id) are written by our functions only.
REVOKE INSERT, UPDATE ON public.products FROM authenticated;
GRANT INSERT (business_id, name, description, price, image_url, category, stock_status,
              variants, promo, product_url, sku)
  ON public.products TO authenticated;
GRANT UPDATE (name, description, price, image_url, category, stock_status,
              variants, promo, product_url, sku)
  ON public.products TO authenticated;

-- 2. Product images must be web links (product_url already is).
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_image_url_check;
ALTER TABLE public.products ADD CONSTRAINT products_image_url_check
  CHECK (image_url IS NULL OR (image_url ~* '^https?://' AND char_length(image_url) <= 1000));

-- 3. The app never uses GraphQL; removing it hides the schema from the API.
DROP EXTENSION IF EXISTS pg_graphql;
