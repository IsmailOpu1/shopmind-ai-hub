WITH ranked_businesses AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC, id ASC) AS row_num
  FROM public.businesses
)
DELETE FROM public.businesses b
USING ranked_businesses rb
WHERE b.id = rb.id
  AND rb.row_num > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'businesses_owner_id_key'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_owner_id_key UNIQUE (owner_id);
  END IF;
END $$;