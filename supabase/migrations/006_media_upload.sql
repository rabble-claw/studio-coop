-- Studio Co-op: Feed Media Storage
-- Creates feed-media bucket in Supabase Storage for class feed photos/videos

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feed-media',
  'feed-media',
  true,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
) on conflict (id) do nothing;

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Public read: anyone can view feed media (URLs are unguessable UUIDs)
create policy "feed_media_public_read"
  on storage.objects for select
  using (bucket_id = 'feed-media');

-- Authenticated upload: any authenticated user can upload
create policy "feed_media_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'feed-media'
    and auth.uid() is not null
  );

-- Owner delete: users can only delete their own uploads
create policy "feed_media_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'feed-media'
    and owner = auth.uid()
  );
