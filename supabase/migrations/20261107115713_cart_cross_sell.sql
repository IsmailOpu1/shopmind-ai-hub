-- Cart awareness (PRD v1.0 §6.1): products that go with what the shopper has
-- in their cart. Uses the average embedding of the cart's products, only
-- other categories (same-category items are alternatives, not add-ons), only
-- in stock, and the best match per category so suggestions vary.
CREATE FUNCTION public.match_cross_sell(
  p_business_id uuid,
  p_product_ids uuid[],
  match_count integer DEFAULT 3
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
AS $$
  WITH cart AS (
    SELECT p.embedding, p.category
    FROM public.products p
    WHERE p.business_id = p_business_id
      AND p.id = ANY (p_product_ids)
  ),
  centroid AS (
    SELECT extensions.avg(c.embedding) AS e FROM cart c WHERE c.embedding IS NOT NULL
  ),
  scored AS (
    SELECT p.*, 1 - (p.embedding OPERATOR(extensions.<=>) ce.e) AS similarity
    FROM public.products p
    CROSS JOIN centroid ce
    WHERE ce.e IS NOT NULL
      AND p.business_id = p_business_id
      AND p.embedding IS NOT NULL
      AND p.stock_status = 'in_stock'
      AND p.id <> ALL (p_product_ids)
      AND (p.category IS NULL
        OR lower(p.category) NOT IN (SELECT lower(c.category) FROM cart c WHERE c.category IS NOT NULL))
  ),
  best_per_category AS (
    SELECT DISTINCT ON (coalesce(lower(s.category), s.id::text)) s.*
    FROM scored s
    ORDER BY coalesce(lower(s.category), s.id::text), s.similarity DESC
  )
  SELECT
    b.id, b.business_id, b.name, b.description, b.price,
    b.image_url, b.category, b.stock_status, b.promo,
    b.product_url, b.sku, b.variants, b.created_at, b.similarity
  FROM best_per_category b
  ORDER BY b.similarity DESC
  LIMIT least(greatest(match_count, 1), 10);
$$;

REVOKE ALL ON FUNCTION public.match_cross_sell(uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_cross_sell(uuid, uuid[], integer) TO service_role;
