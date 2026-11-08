-- In the subquery, bare "name" meant businesses.name, not the file path.
-- A helper keeps the four policies identical and the path unambiguous.
CREATE FUNCTION public.owns_avatar_path(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.owner_id = (SELECT auth.uid())
      AND b.id::text = (storage.foldername(p_path))[1]
  );
$$;
REVOKE ALL ON FUNCTION public.owns_avatar_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_avatar_path(text) TO authenticated;

DROP POLICY "bot avatars: owner insert" ON storage.objects;
DROP POLICY "bot avatars: owner update" ON storage.objects;
DROP POLICY "bot avatars: owner delete" ON storage.objects;
DROP POLICY "bot avatars: owner select" ON storage.objects;

CREATE POLICY "bot avatars: owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bot-avatars' AND public.owns_avatar_path(objects.name));
CREATE POLICY "bot avatars: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bot-avatars' AND public.owns_avatar_path(objects.name))
  WITH CHECK (bucket_id = 'bot-avatars' AND public.owns_avatar_path(objects.name));
CREATE POLICY "bot avatars: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bot-avatars' AND public.owns_avatar_path(objects.name));
CREATE POLICY "bot avatars: owner select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bot-avatars' AND public.owns_avatar_path(objects.name));
