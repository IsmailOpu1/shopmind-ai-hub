ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS fab_position text DEFAULT 'bottom-right',
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#1E40AF';