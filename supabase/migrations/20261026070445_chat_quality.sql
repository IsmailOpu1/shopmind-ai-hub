-- Phase 2: price-aware search, store currency, product links, products shown
-- per assistant message, and re-embedding when a product changes.

-- Store currency used to format prices in the widget and in replies.
ALTER TABLE public.businesses
  ADD COLUMN currency text NOT NULL DEFAULT 'BDT'
    CHECK (currency IN ('BDT', 'USD', 'EUR', 'GBP', 'INR'));

GRANT UPDATE (currency) ON public.businesses TO authenticated;

-- Link for the "View product" button on product cards.
ALTER TABLE public.products
  ADD COLUMN product_url text
    CHECK (product_url IS NULL OR product_url ~* '^https?://');

-- Products the assistant showed with each reply ("which of those is cheaper?").
ALTER TABLE public.messages
  ADD COLUMN product_ids uuid[] NOT NULL DEFAULT '{}';

-- A changed product needs a fresh embedding; embed-products picks up NULLs.
CREATE FUNCTION public.reset_product_embedding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (NEW.name, NEW.description, NEW.category, NEW.price, NEW.stock_status, NEW.promo)
     IS DISTINCT FROM
     (OLD.name, OLD.description, OLD.category, OLD.price, OLD.stock_status, OLD.promo)
     AND NEW.embedding IS NOT DISTINCT FROM OLD.embedding THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_product_embedding() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER products_reset_embedding
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.reset_product_embedding();

-- Search gains optional price bounds and returns product_url.
DROP FUNCTION IF EXISTS public.match_products(uuid, extensions.vector, double precision, integer, text);

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
  product_url text, created_at timestamp with time zone, similarity double precision
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
    s.product_url, s.created_at, r.similarity
  FROM ranked r
  JOIN scoped s ON s.id = r.id
  ORDER BY r.similarity DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text, numeric, numeric)
  TO service_role;
