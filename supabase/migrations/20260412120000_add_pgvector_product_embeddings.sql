-- pgvector for product embedding similarity search
-- https://supabase.com/docs/guides/database/extensions/pgvector

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

-- IVFFlat index for approximate nearest neighbor search (cosine distance <=>)
-- Tune `lists` after you have representative row counts (often sqrt(n), capped ~100–1000).
CREATE INDEX IF NOT EXISTS products_embedding_ivfflat_idx
  ON public.products
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Cosine similarity = 1 - cosine distance (pgvector <=> operator).
-- match_threshold is minimum similarity in [0, 1] (higher = stricter).
CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding extensions.vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  name text,
  description text,
  price numeric,
  image_url text,
  category text,
  stock_status text,
  promo text,
  created_at timestamp with time zone,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.business_id,
    p.name,
    p.description,
    p.price,
    p.image_url,
    p.category,
    p.stock_status,
    p.promo,
    p.created_at,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.products p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) >= match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_products(extensions.vector(768), double precision, integer)
  TO authenticated, service_role;
