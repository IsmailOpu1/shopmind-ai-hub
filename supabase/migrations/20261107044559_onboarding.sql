-- Onboarding checklist (PRD v2 §3). Most steps are derived from data
-- (products, embeddings, conversations); this stores the owner actions that
-- leave no other trace: {"customized_at", "tested_at", "embed_copied_at"}.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_onboarding_shape;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_onboarding_shape
  CHECK (jsonb_typeof(onboarding) = 'object' AND pg_column_size(onboarding) < 1024);

GRANT UPDATE (onboarding) ON public.businesses TO authenticated;
