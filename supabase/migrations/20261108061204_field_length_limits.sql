-- Size limits on free-text fields (existing data is far below them).
ALTER TABLE public.products
  ADD CONSTRAINT products_text_lengths CHECK (
    char_length(name) <= 300
    AND (description IS NULL OR char_length(description) <= 5000)
    AND (category IS NULL OR char_length(category) <= 100)
    AND (promo IS NULL OR char_length(promo) <= 200)
    AND (product_url IS NULL OR char_length(product_url) <= 1000)
  );
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_name_length CHECK (char_length(name) <= 100);

-- Same-site cart paths may not start with "//" or "/\" (those reach other sites).
ALTER TABLE public.businesses DROP CONSTRAINT businesses_cart_url_template_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_cart_url_template_check CHECK (
  cart_url_template IS NULL OR (
    char_length(cart_url_template) <= 500
    AND cart_url_template ~ '^(https?://|/)'
    AND cart_url_template !~ '^/[/\\]'
  )
);
