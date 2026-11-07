-- Analytics dashboard (PRD v2 §5).
--
-- 1. Each shopper question records how the product search went, so the
--    dashboard can list catalog gaps: questions nothing in the store answered.
--    NULL for older rows and for messages saved before this column existed.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS search_status text
  CHECK (search_status IN ('skipped', 'matched', 'no_match', 'no_budget_match'));

COMMENT ON COLUMN public.messages.search_status IS
  'User messages only: skipped (small talk), matched (products shown), no_match (nothing shown), no_budget_match (nothing in the asked budget).';

-- 2. One call returns everything the analytics page shows. SECURITY INVOKER:
--    row level security limits every table to the caller's own store, so an
--    owner passing another store's id just gets zeros.
--    Dashboard previews (dash-) and automated tests (e2e-test-) are excluded.
CREATE OR REPLACE FUNCTION public.store_analytics(
  p_business_id uuid,
  p_days integer DEFAULT 30,
  p_tz text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH params AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_days, 30), 1), 365) AS days,
      -- Day boundaries in the owner's time zone.
      ((now() AT TIME ZONE p_tz)::date - (LEAST(GREATEST(COALESCE(p_days, 30), 1), 365) - 1)) AS first_day
  ),
  since AS (
    SELECT (first_day::timestamp AT TIME ZONE p_tz) AS ts, first_day, days FROM params
  ),
  convs AS (
    SELECT c.id, c.created_at
    FROM public.conversations c
    WHERE c.business_id = p_business_id
      AND c.session_id NOT LIKE 'dash-%'
      AND c.session_id NOT LIKE 'e2e-test-%'
  ),
  msgs AS (
    SELECT m.role, m.content, m.created_at, m.model, m.search_status, m.product_ids
    FROM public.messages m
    JOIN convs c ON c.id = m.conversation_id
    WHERE m.created_at >= (SELECT ts FROM since)
  ),
  events AS (
    SELECT e.type, e.product_id
    FROM public.chat_events e
    WHERE e.business_id = p_business_id
      AND e.created_at >= (SELECT ts FROM since)
      AND e.session_id NOT LIKE 'dash-%'
      AND e.session_id NOT LIKE 'e2e-test-%'
  ),
  days AS (
    SELECT generate_series(s.first_day, s.first_day + (s.days - 1), interval '1 day')::date AS day
    FROM since s
  ),
  daily AS (
    SELECT d.day,
      (SELECT count(*) FROM convs c
        WHERE (c.created_at AT TIME ZONE p_tz)::date = d.day) AS conversations,
      (SELECT count(*) FROM msgs m
        WHERE m.role = 'user' AND (m.created_at AT TIME ZONE p_tz)::date = d.day) AS messages
    FROM days d
  ),
  questions AS (
    -- Same question asked with different casing/spacing/punctuation counts once.
    SELECT
      lower(regexp_replace(regexp_replace(btrim(content), '\s+', ' ', 'g'), '[?!.。]+$', '')) AS question,
      search_status,
      created_at
    FROM msgs
    WHERE role = 'user' AND COALESCE(search_status, '') <> 'skipped'
  ),
  product_stats AS (
    SELECT e.product_id,
      count(*) FILTER (WHERE e.type = 'card_shown') AS shown,
      count(*) FILTER (WHERE e.type = 'view_click') AS views,
      count(*) FILTER (WHERE e.type = 'cart_click') AS carts
    FROM events e
    GROUP BY e.product_id
  )
  SELECT jsonb_build_object(
    'days', (SELECT days FROM since),
    'totals', jsonb_build_object(
      'conversations', (SELECT count(*) FROM convs WHERE created_at >= (SELECT ts FROM since)),
      'shopper_messages', (SELECT count(*) FROM msgs WHERE role = 'user'),
      'replies', (SELECT count(*) FROM msgs WHERE role = 'assistant'),
      'fallback_replies', (SELECT count(*) FROM msgs WHERE role = 'assistant' AND model = 'openrouter'),
      'cards_shown', (SELECT count(*) FROM events WHERE type = 'card_shown'),
      'view_clicks', (SELECT count(*) FROM events WHERE type = 'view_click'),
      'cart_clicks', (SELECT count(*) FROM events WHERE type = 'cart_click'),
      'gap_questions', (SELECT count(*) FROM questions WHERE search_status IN ('no_match', 'no_budget_match'))
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', day, 'conversations', conversations, 'messages', messages) ORDER BY day)
      FROM daily
    ), '[]'::jsonb),
    'top_questions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('question', question, 'count', n) ORDER BY n DESC, question)
      FROM (
        SELECT question, count(*) AS n FROM questions
        WHERE question <> '' GROUP BY question ORDER BY n DESC, question LIMIT 10
      ) q
    ), '[]'::jsonb),
    'gaps', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('question', question, 'reason', reason, 'count', n, 'last_asked', last_asked)
        ORDER BY n DESC, last_asked DESC)
      FROM (
        SELECT question,
          CASE WHEN bool_or(search_status = 'no_match') THEN 'no_match' ELSE 'no_budget_match' END AS reason,
          count(*) AS n,
          max(created_at) AS last_asked
        FROM questions
        WHERE search_status IN ('no_match', 'no_budget_match') AND question <> ''
        GROUP BY question ORDER BY n DESC, max(created_at) DESC LIMIT 10
      ) g
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'product_id', p.id, 'name', p.name, 'shown', s.shown, 'views', s.views, 'carts', s.carts)
        ORDER BY s.carts DESC, s.views DESC, s.shown DESC, p.name)
      FROM (SELECT * FROM product_stats ORDER BY carts DESC, views DESC, shown DESC LIMIT 10) s
      JOIN public.products p ON p.id = s.product_id
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.store_analytics(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.store_analytics(uuid, integer, text) TO authenticated;
