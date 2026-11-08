-- Bot personality (PRD v1.0 Phase 3): reply tone and a logo/avatar for the widget.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS tone text NOT NULL DEFAULT 'friendly';
ALTER TABLE public.businesses ADD CONSTRAINT businesses_tone_check
  CHECK (tone IN ('friendly', 'professional', 'playful', 'luxury'));

-- Public URL of an image in the bot-avatars bucket (set by the dashboard).
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_avatar_url_check
  CHECK (avatar_url IS NULL OR (avatar_url ~ '^https://' AND char_length(avatar_url) <= 500));

GRANT UPDATE (tone, avatar_url) ON public.businesses TO authenticated;

-- Logos are public (the widget shows them on store sites), small, and raster
-- only: no SVG, which can carry scripts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bot-avatars', 'bot-avatars', true, 524288, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Owners write only inside their own business's folder: bot-avatars/<business_id>/...
CREATE POLICY "bot avatars: owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bot-avatars'
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.owner_id = (SELECT auth.uid()) AND b.id::text = (storage.foldername(name))[1]
    )
  );
CREATE POLICY "bot avatars: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bot-avatars'
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.owner_id = (SELECT auth.uid()) AND b.id::text = (storage.foldername(name))[1]
    )
  );
CREATE POLICY "bot avatars: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bot-avatars'
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.owner_id = (SELECT auth.uid()) AND b.id::text = (storage.foldername(name))[1]
    )
  );
-- Owners can list their own files (public URLs need no SELECT policy).
CREATE POLICY "bot avatars: owner select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bot-avatars'
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.owner_id = (SELECT auth.uid()) AND b.id::text = (storage.foldername(name))[1]
    )
  );
