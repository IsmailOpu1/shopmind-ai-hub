-- Add to cart / View product (PRD v2 §2) and shopper event tracking for analytics.

-- Products: optional SKU (used in cart URL templates, e.g. a Shopify variant id).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_length;
ALTER TABLE public.products ADD CONSTRAINT products_sku_length CHECK (sku IS NULL OR char_length(sku) <= 100);

-- Stores choose how "Add to cart" works: off, a browser event, or a cart URL.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS cart_mode text NOT NULL DEFAULT 'off';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS cart_url_template text;
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_cart_mode_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_cart_mode_check
  CHECK (cart_mode IN ('off', 'event', 'url'));
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_cart_url_template_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_cart_url_template_check
  CHECK (
    cart_url_template IS NULL
    OR (char_length(cart_url_template) <= 500 AND cart_url_template ~ '^(https?://|/)')
  );
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_cart_url_required;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_cart_url_required
  CHECK (cart_mode <> 'url' OR cart_url_template IS NOT NULL);

GRANT UPDATE (cart_mode, cart_url_template) ON public.businesses TO authenticated;

-- Which model wrote each assistant reply (gemini / openrouter), for analytics.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS model text;

-- Shopper events. Written only by the chat function (service role).
CREATE TABLE IF NOT EXISTS public.chat_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('card_shown', 'view_click', 'cart_click')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_events_business_created_idx
  ON public.chat_events (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_events_product_idx
  ON public.chat_events (product_id);

ALTER TABLE public.chat_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_events FROM anon, authenticated;
GRANT SELECT ON public.chat_events TO authenticated;

DROP POLICY IF EXISTS "Owners read their events" ON public.chat_events;
CREATE POLICY "Owners read their events" ON public.chat_events
  FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())
    )
  );

-- match_products also returns sku.
DROP FUNCTION IF EXISTS public.match_products(uuid, extensions.vector, double precision, integer, text, numeric, numeric);

CREATE FUNCTION public.match_products(
  p_business_id uuid,
  query_embedding extensions.vector,
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 10,
  query_text text DEFAULT '',
  min_price numeric DEFAULT NULL,
  max_price numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid, business_id uuid, name text, description text, price numeric,
  image_url text, category text, stock_status text, promo text,
  product_url text, sku text, created_at timestamp with time zone, similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH scoped AS (
    SELECT p.*
    FROM public.products p
    WHERE p.business_id = p_business_id
      AND (min_price IS NULL OR p.price >= min_price)
      AND (max_price IS NULL OR p.price <= max_price)
  ),
  vector_search AS (
    SELECT
      s.id,
      1 - (s.embedding OPERATOR(extensions.<=>) query_embedding) AS vector_score,
      0::float AS text_score
    FROM scoped s
    WHERE s.embedding IS NOT NULL
      AND 1 - (s.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  ),
  text_search AS (
    SELECT
      s.id,
      0::float AS vector_score,
      ts_rank(s.fts, plainto_tsquery('english'::regconfig, query_text)) AS text_score
    FROM scoped s
    WHERE query_text <> ''
      AND s.fts @@ plainto_tsquery('english'::regconfig, query_text)
  ),
  ranked AS (
    SELECT
      c.id,
      MAX(c.vector_score) * 0.7 + MAX(c.text_score) * 0.3 AS similarity
    FROM (
      SELECT * FROM vector_search
      UNION ALL
      SELECT * FROM text_search
    ) c
    GROUP BY c.id
  )
  SELECT
    s.id, s.business_id, s.name, s.description, s.price,
    s.image_url, s.category, s.stock_status, s.promo,
    s.product_url, s.sku, s.created_at, r.similarity
  FROM ranked r
  JOIN scoped s ON s.id = r.id
  ORDER BY r.similarity DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text, numeric, numeric)
  TO service_role;
