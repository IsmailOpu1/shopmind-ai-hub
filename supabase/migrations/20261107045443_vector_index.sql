-- RAG Level 1: fast vector search for large catalogs.
-- pgvector indexes plain vectors only up to 2000 dimensions; our 3072-dim
-- Gemini embeddings are indexed as halfvec (up to 4000), which scores the same
-- to 4 decimal places on this catalog.
CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
  ON public.products
  USING hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops);

-- Vector half of the hybrid search now walks the index (nearest first, store
-- filter applied as it goes thanks to iterative scans) instead of scoring
-- every product. Same signature and results shape as before.
CREATE OR REPLACE FUNCTION public.match_products(
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
SET hnsw.iterative_scan = 'relaxed_order'
AS $$
  WITH scoped AS (
    SELECT p.*
    FROM public.products p
    WHERE p.business_id = p_business_id
      AND (min_price IS NULL OR p.price >= min_price)
      AND (max_price IS NULL OR p.price <= max_price)
  ),
  nearest AS (
    SELECT
      p.id,
      1 - (p.embedding::extensions.halfvec(3072) OPERATOR(extensions.<=>)
           query_embedding::extensions.halfvec(3072)) AS vector_score
    FROM public.products p
    WHERE p.business_id = p_business_id
      AND p.embedding IS NOT NULL
      AND (min_price IS NULL OR p.price >= min_price)
      AND (max_price IS NULL OR p.price <= max_price)
    ORDER BY p.embedding::extensions.halfvec(3072) OPERATOR(extensions.<=>)
             query_embedding::extensions.halfvec(3072)
    LIMIT GREATEST(match_count * 4, 40)
  ),
  vector_search AS (
    SELECT n.id, n.vector_score, 0::float AS text_score
    FROM nearest n
    WHERE n.vector_score >= match_threshold
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
