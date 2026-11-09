-- Preview then Connect can come quickly one after the other: 2 s minimum gap.
CREATE OR REPLACE FUNCTION public.claim_catalog_request(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_ok boolean;
BEGIN
  UPDATE public.businesses b
  SET catalog_requests_window_start = CASE
        WHEN b.catalog_requests_window_start IS NULL
          OR b.catalog_requests_window_start < v_now - interval '1 hour' THEN v_now
        ELSE b.catalog_requests_window_start END,
      catalog_requests_count = CASE
        WHEN b.catalog_requests_window_start IS NULL
          OR b.catalog_requests_window_start < v_now - interval '1 hour' THEN 1
        ELSE b.catalog_requests_count + 1 END,
      catalog_last_request_at = v_now
  WHERE b.id = p_business_id
    AND (b.catalog_last_request_at IS NULL OR b.catalog_last_request_at < v_now - interval '2 seconds')
    AND (b.catalog_requests_window_start IS NULL
         OR b.catalog_requests_window_start < v_now - interval '1 hour'
         OR b.catalog_requests_count < 30)
  RETURNING true INTO v_ok;

  IF v_ok THEN RETURN 'ok'; END IF;
  IF EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id
             AND b.catalog_last_request_at >= v_now - interval '2 seconds') THEN
    RETURN 'too_fast';
  END IF;
  RETURN 'hourly_limit';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_catalog_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_catalog_request(uuid) TO service_role;
