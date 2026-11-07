-- RAG Level 2: store knowledge (PRD v2 §6).
--
-- 1. Product variants: size/colour options with their own stock, stored on
--    the product as a small JSON list: [{"size":"M","colour":"Black","stock_status":"in_stock"}].
-- 2. Store documents (FAQ, shipping, returns, size guide...) that owners
--    write in the dashboard. They are split into chunks, embedded, and
--    searched alongside products so the bot can answer policy questions.

-- Load pgvector's library in this session so its hnsw.* settings exist; the
-- match_products definition below sets hnsw.iterative_scan.
SELECT '[1,2]'::extensions.vector(2);

-- 1. Variants -----------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_variants_shape;
ALTER TABLE public.products ADD CONSTRAINT products_variants_shape
  CHECK (
    jsonb_typeof(variants) = 'array'
    AND jsonb_array_length(variants) <= 50
    AND pg_column_size(variants) < 8192
  );

-- Variants are part of the product's searchable text (colours, sizes), so a
-- change to them also clears the embedding for re-indexing.
CREATE OR REPLACE FUNCTION public.reset_product_embedding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  embedding_unchanged boolean :=
    (NEW.embedding IS NULL AND OLD.embedding IS NULL)
    OR COALESCE(NEW.embedding OPERATOR(extensions.=) OLD.embedding, false);
BEGIN
  IF embedding_unchanged
     AND (NEW.name, NEW.description, NEW.category, NEW.price, NEW.stock_status, NEW.promo, NEW.variants)
       IS DISTINCT FROM
       (OLD.name, OLD.description, OLD.category, OLD.price, OLD.stock_status, OLD.promo, OLD.variants) THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_product_embedding() FROM PUBLIC, anon, authenticated;

-- match_products returns variants too (same arguments; new result column).
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
  product_url text, sku text, variants jsonb, created_at timestamp with time zone,
  similarity double precision
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
      1 - ((p.embedding::extensions.halfvec(3072)) OPERATOR(extensions.<=>) (query_embedding::extensions.halfvec(3072))) AS vector_score
    FROM public.products p
    WHERE p.business_id = p_business_id
      AND p.embedding IS NOT NULL
      AND (min_price IS NULL OR p.price >= min_price)
      AND (max_price IS NULL OR p.price <= max_price)
    ORDER BY (p.embedding::extensions.halfvec(3072)) OPERATOR(extensions.<=>) (query_embedding::extensions.halfvec(3072))
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
    s.product_url, s.sku, s.variants, s.created_at, r.similarity
  FROM ranked r
  JOIN scoped s ON s.id = r.id
  ORDER BY r.similarity DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text, numeric, numeric)
  TO service_role;

-- 2. Store documents ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other'
    CHECK (kind IN ('faq', 'shipping', 'returns', 'size_guide', 'payment', 'other')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
  -- NULL until the chunks for the current content are embedded.
  indexed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_documents_business_idx ON public.store_documents (business_id);

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.store_documents(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(3072),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, content)) STORED,
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS document_chunks_business_idx ON public.document_chunks (business_id);
CREATE INDEX IF NOT EXISTS document_chunks_fts_idx ON public.document_chunks USING gin (fts);

-- Editing a document drops its old chunks; the indexer rebuilds them.
CREATE OR REPLACE FUNCTION public.store_document_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.title, NEW.content, NEW.kind) IS NOT DISTINCT FROM (OLD.title, OLD.content, OLD.kind) THEN
    RETURN NEW;
  END IF;
  -- The owner can't change which store a document belongs to.
  IF TG_OP = 'UPDATE' THEN
    NEW.business_id := OLD.business_id;
    NEW.created_at := OLD.created_at;
    DELETE FROM public.document_chunks WHERE document_id = OLD.id;
  END IF;
  NEW.updated_at := now();
  NEW.indexed_at := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.store_document_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS store_document_changed ON public.store_documents;
CREATE TRIGGER store_document_changed
  BEFORE INSERT OR UPDATE ON public.store_documents
  FOR EACH ROW EXECUTE FUNCTION public.store_document_changed();

-- At most 30 documents per store.
CREATE OR REPLACE FUNCTION public.store_documents_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.store_documents WHERE business_id = NEW.business_id) >= 30 THEN
    RAISE EXCEPTION 'A store can have at most 30 documents' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.store_documents_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS store_documents_limit ON public.store_documents;
CREATE TRIGGER store_documents_limit
  BEFORE INSERT ON public.store_documents
  FOR EACH ROW EXECUTE FUNCTION public.store_documents_limit();

-- Row level security: owners manage their own documents and can read their
-- chunks; chunks are written only by the indexer (service role).
ALTER TABLE public.store_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.store_documents FROM anon, authenticated;
REVOKE ALL ON public.document_chunks FROM anon, authenticated;
GRANT SELECT, DELETE ON public.store_documents TO authenticated;
GRANT INSERT (business_id, kind, title, content) ON public.store_documents TO authenticated;
GRANT UPDATE (kind, title, content) ON public.store_documents TO authenticated;
GRANT SELECT (id, document_id, business_id, chunk_index, content) ON public.document_chunks TO authenticated;

DROP POLICY IF EXISTS "Owners manage their documents" ON public.store_documents;
CREATE POLICY "Owners manage their documents" ON public.store_documents
  FOR ALL TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())))
  WITH CHECK (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Owners read their chunks" ON public.document_chunks;
CREATE POLICY "Owners read their chunks" ON public.document_chunks
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

-- Hybrid search over a store's document chunks (70% vector, 30% keywords),
-- like match_products. Stores have at most a few hundred chunks, so the
-- vector part scans the store's chunks directly.
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  p_business_id uuid,
  query_embedding extensions.vector,
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 3,
  query_text text DEFAULT ''
)
RETURNS TABLE (
  id bigint, document_id uuid, title text, kind text, content text, similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH scoped AS (
    SELECT c.* FROM public.document_chunks c
    WHERE c.business_id = p_business_id AND c.embedding IS NOT NULL
  ),
  scored AS (
    SELECT
      s.id,
      1 - (s.embedding OPERATOR(extensions.<=>) query_embedding) AS vector_score,
      CASE WHEN query_text <> '' AND s.fts @@ plainto_tsquery('english'::regconfig, query_text)
        THEN ts_rank(s.fts, plainto_tsquery('english'::regconfig, query_text)) ELSE 0 END AS text_score
    FROM scoped s
  )
  SELECT c.id, c.document_id, d.title, d.kind, c.content,
    sc.vector_score * 0.7 + sc.text_score * 0.3 AS similarity
  FROM scored sc
  JOIN scoped c ON c.id = sc.id
  JOIN public.store_documents d ON d.id = c.document_id
  WHERE sc.vector_score >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_document_chunks(uuid, extensions.vector, double precision, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid, extensions.vector, double precision, integer, text)
  TO service_role;

-- 3. Analytics: a question answered from store documents is not a catalog gap.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_search_status_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_search_status_check
  CHECK (search_status IN ('skipped', 'matched', 'no_match', 'no_budget_match', 'info'));

COMMENT ON COLUMN public.messages.search_status IS
  'User messages only: skipped (small talk), matched (products shown), info (answered from store documents), no_match (nothing shown), no_budget_match (nothing in the asked budget).';
