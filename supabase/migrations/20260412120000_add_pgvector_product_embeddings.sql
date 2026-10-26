-- pgvector + hybrid (vector + full-text) product search.
-- This file records the schema that was built by hand on the live project in
-- April 2026 (3072-dim Gemini embeddings, generated fts column, hybrid
-- match_products). It is idempotent so it is safe to re-run.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- gemini-embedding-001 with outputDimensionality = 3072.
-- (ivfflat/hnsw indexes support at most 2000 dims, so there is no ANN index.)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(3072);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english'::regconfig,
      COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' ||
      COALESCE(category, '') || ' ' || COALESCE(stock_status, '') || ' ' ||
      COALESCE(promo, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS products_fts_idx ON public.products USING gin (fts);

-- Original vector-only search.
CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding extensions.vector,
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (
  id uuid, business_id uuid, name text, description text, price numeric,
  image_url text, category text, stock_status text, promo text,
  created_at timestamp with time zone, similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id, p.business_id, p.name, p.description,
    p.price, p.image_url, p.category, p.stock_status,
    p.promo, p.created_at,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.products p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) >= match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Hybrid search: 70% vector similarity + 30% full-text rank.
CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding extensions.vector,
  match_threshold double precision,
  match_count integer,
  query_text text DEFAULT ''
)
RETURNS TABLE (
  id uuid, business_id uuid, name text, description text, price numeric,
  image_url text, category text, stock_status text, promo text,
  created_at timestamp with time zone, similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH vector_search AS (
    SELECT
      p.id, p.business_id, p.name, p.description,
      p.price, p.image_url, p.category, p.stock_status,
      p.promo, p.created_at,
      1 - (p.embedding <=> query_embedding) AS vector_score,
      0::float AS text_score
    FROM public.products p
    WHERE p.embedding IS NOT NULL
      AND 1 - (p.embedding <=> query_embedding) >= match_threshold
  ),
  text_search AS (
    SELECT
      p.id, p.business_id, p.name, p.description,
      p.price, p.image_url, p.category, p.stock_status,
      p.promo, p.created_at,
      0::float AS vector_score,
      ts_rank(p.fts, plainto_tsquery('english', query_text)) AS text_score
    FROM public.products p
    WHERE query_text != ''
      AND p.fts @@ plainto_tsquery('english', query_text)
  ),
  combined AS (
    SELECT * FROM vector_search
    UNION ALL
    SELECT * FROM text_search
  ),
  ranked AS (
    SELECT
      id, business_id, name, description, price,
      image_url, category, stock_status, promo, created_at,
      MAX(vector_score) AS vector_score,
      MAX(text_score) AS text_score,
      (MAX(vector_score) * 0.7 + MAX(text_score) * 0.3) AS similarity
    FROM combined
    GROUP BY id, business_id, name, description, price,
             image_url, category, stock_status, promo, created_at
  )
  SELECT
    id, business_id, name, description, price,
    image_url, category, stock_status, promo, created_at,
    similarity
  FROM ranked
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
