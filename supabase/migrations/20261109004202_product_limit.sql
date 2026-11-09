-- At most 5,000 products per store (protects the AI search quota).
-- Checked once per INSERT statement, so a 2,000-row import is one check.
CREATE FUNCTION public.enforce_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business uuid;
BEGIN
  SELECT p.business_id INTO v_business
  FROM public.products p
  WHERE p.business_id IN (SELECT DISTINCT n.business_id FROM new_rows n)
  GROUP BY p.business_id
  HAVING count(*) > 5000
  LIMIT 1;
  IF v_business IS NOT NULL THEN
    RAISE EXCEPTION 'This store has reached the product limit of 5,000 products.'
      USING ERRCODE = 'check_violation', HINT = 'product_limit';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_product_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER products_limit
  AFTER INSERT ON public.products
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_product_limit();
