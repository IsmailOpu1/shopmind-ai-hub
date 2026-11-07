-- Fix: with search_path = '' the vector "=" operator behind IS NOT DISTINCT FROM
-- could not be found, so every UPDATE on products failed (product edits and
-- embed-products writes). Compare embeddings with the schema-qualified operator.
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
     AND (NEW.name, NEW.description, NEW.category, NEW.price, NEW.stock_status, NEW.promo)
       IS DISTINCT FROM
       (OLD.name, OLD.description, OLD.category, OLD.price, OLD.stock_status, OLD.promo) THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_product_embedding() FROM PUBLIC, anon, authenticated;
