-- Phase 1: tenant isolation, least-privilege access, signup trigger, rate limits.

-- ---------------------------------------------------------------------------
-- 1. Tenant-scoped product search (service_role only)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.match_products(extensions.vector, double precision, integer);
DROP FUNCTION IF EXISTS public.match_products(extensions.vector, double precision, integer, text);

CREATE FUNCTION public.match_products(
  p_business_id uuid,
  query_embedding extensions.vector,
  match_threshold double precision DEFAULT 0.3,
  match_count integer DEFAULT 10,
  query_text text DEFAULT ''
)
RETURNS TABLE (
  id uuid, business_id uuid, name text, description text, price numeric,
  image_url text, category text, stock_status text, promo text,
  created_at timestamp with time zone, similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH scoped AS (
    SELECT p.*
    FROM public.products p
    WHERE p.business_id = p_business_id
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
    s.image_url, s.category, s.stock_status, s.promo, s.created_at,
    r.similarity
  FROM ranked r
  JOIN scoped s ON s.id = r.id
  ORDER BY r.similarity DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_products(uuid, extensions.vector, double precision, integer, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Data integrity
-- ---------------------------------------------------------------------------
UPDATE public.products
SET stock_status = 'out_of_stock'
WHERE stock_status NOT IN ('in_stock', 'out_of_stock');

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_status_check
    CHECK (stock_status IN ('in_stock', 'out_of_stock'));

ALTER TABLE public.messages
  ADD CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant'));

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_bot_name_check CHECK (char_length(btrim(bot_name)) BETWEEN 1 AND 40),
  ADD CONSTRAINT businesses_greeting_check CHECK (char_length(greeting) <= 300),
  ADD CONSTRAINT businesses_primary_color_check CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT businesses_fab_position_check CHECK (fab_position IN ('bottom-right', 'bottom-left'));

-- One conversation per (business, session); the chat function upserts on this.
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_business_session_key UNIQUE (business_id, session_id);

-- ---------------------------------------------------------------------------
-- 3. Rate-limit support
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN daily_message_limit integer NOT NULL DEFAULT 500
    CHECK (daily_message_limit BETWEEN 0 AND 100000);

-- Salted SHA-256 of the shopper's IP (no raw IP / PII stored).
ALTER TABLE public.conversations
  ADD COLUMN ip_hash text;

CREATE INDEX products_business_id_idx ON public.products (business_id);
CREATE INDEX conversations_ip_hash_created_idx ON public.conversations (ip_hash, created_at);
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX messages_created_user_idx ON public.messages (created_at) WHERE role = 'user';

-- Returns NULL when the message is allowed, otherwise a reason code.
CREATE FUNCTION public.check_chat_rate_limit(
  p_business_id uuid,
  p_session_id text,
  p_ip_hash text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_daily_limit integer;
  v_count integer;
BEGIN
  SELECT b.daily_message_limit INTO v_daily_limit
  FROM public.businesses b
  WHERE b.id = p_business_id;

  IF NOT FOUND THEN
    RETURN 'unknown_business';
  END IF;

  -- Per session: 30 shopper messages.
  SELECT count(*) INTO v_count
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE c.business_id = p_business_id
    AND c.session_id = p_session_id
    AND m.role = 'user';
  IF v_count >= 30 THEN
    RETURN 'session_limit';
  END IF;

  -- Per visitor (IP hash), across sessions and stores: 60 messages / hour.
  IF p_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE c.ip_hash = p_ip_hash
      AND m.role = 'user'
      AND m.created_at > now() - interval '1 hour';
    IF v_count >= 60 THEN
      RETURN 'visitor_limit';
    END IF;
  END IF;

  -- Per store: daily_message_limit shopper messages / 24h.
  SELECT count(*) INTO v_count
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE c.business_id = p_business_id
    AND m.role = 'user'
    AND m.created_at > now() - interval '24 hours';
  IF v_count >= v_daily_limit THEN
    RETURN 'business_limit';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.check_chat_rate_limit(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_chat_rate_limit(uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Create the business row on signup (server-side, no client race)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.businesses (owner_id, name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(left(btrim(NEW.raw_user_meta_data ->> 'business_name'), 100), ''),
      'My Business'
    )
  )
  ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill accounts that signed up without getting a business.
INSERT INTO public.businesses (owner_id, name)
SELECT
  u.id,
  COALESCE(NULLIF(left(btrim(u.raw_user_meta_data ->> 'business_name'), 100), ''), 'My Business')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = u.id);

-- ---------------------------------------------------------------------------
-- 5. Least-privilege grants + faster RLS policies
-- ---------------------------------------------------------------------------
-- Shoppers never touch tables directly (the chat function uses service_role).
REVOKE ALL ON public.businesses, public.products, public.conversations, public.messages FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.businesses, public.products, public.conversations, public.messages FROM authenticated;

-- businesses: created by trigger only; owners read/update their own row.
DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can create their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can delete their own businesses" ON public.businesses;

CREATE POLICY "Owners can view their business" ON public.businesses
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

CREATE POLICY "Owners can update their business" ON public.businesses
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- Owners must not raise their own message quota.
REVOKE INSERT, UPDATE, DELETE ON public.businesses FROM authenticated;
GRANT UPDATE (name, bot_name, greeting, primary_color, fab_position) ON public.businesses TO authenticated;

-- products: full CRUD for the owner.
DROP POLICY IF EXISTS "Owners can view their products" ON public.products;
DROP POLICY IF EXISTS "Owners can insert their products" ON public.products;
DROP POLICY IF EXISTS "Owners can update their products" ON public.products;
DROP POLICY IF EXISTS "Owners can delete their products" ON public.products;

CREATE POLICY "Owners can view their products" ON public.products
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

CREATE POLICY "Owners can insert their products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

CREATE POLICY "Owners can update their products" ON public.products
  FOR UPDATE TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())))
  WITH CHECK (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

CREATE POLICY "Owners can delete their products" ON public.products
  FOR DELETE TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

-- conversations / messages: written by the chat function; owners read and delete.
DROP POLICY IF EXISTS "Owners can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Owners can insert their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Owners can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Owners can delete their conversations" ON public.conversations;

CREATE POLICY "Owners can view their conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

CREATE POLICY "Owners can delete their conversations" ON public.conversations
  FOR DELETE TO authenticated
  USING (business_id IN (SELECT b.id FROM public.businesses b WHERE b.owner_id = (SELECT auth.uid())));

REVOKE INSERT, UPDATE ON public.conversations FROM authenticated;

DROP POLICY IF EXISTS "Owners can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Owners can insert their messages" ON public.messages;
DROP POLICY IF EXISTS "Owners can update their messages" ON public.messages;
DROP POLICY IF EXISTS "Owners can delete their messages" ON public.messages;

CREATE POLICY "Owners can view their messages" ON public.messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT c.id FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
    WHERE b.owner_id = (SELECT auth.uid())
  ));

CREATE POLICY "Owners can delete their messages" ON public.messages
  FOR DELETE TO authenticated
  USING (conversation_id IN (
    SELECT c.id FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
    WHERE b.owner_id = (SELECT auth.uid())
  ));

REVOKE INSERT, UPDATE ON public.messages FROM authenticated;
