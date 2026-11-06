-- Photo upload uses upsert, and Supabase Storage needs SELECT on the object for that (on top of INSERT /
-- UPDATE). The bucket is public, so anyone can already view a photo by its URL; this only lets a rider list and
-- overwrite what is in their own folder.
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
