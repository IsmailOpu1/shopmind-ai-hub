-- Where and when the store's embed widget last loaded, so the dashboard
-- can tell the owner the code is installed. Written by the chat function.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS widget_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS widget_seen_origin text;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_widget_seen_origin_len;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_widget_seen_origin_len
  CHECK (widget_seen_origin IS NULL OR char_length(widget_seen_origin) <= 200);
