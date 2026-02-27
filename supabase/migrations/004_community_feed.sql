-- Studio Co-op: Community Feed Migration
-- Adds feed_reactions table and Supabase Storage bucket config for media uploads

-- ============================================================
-- FEED REACTIONS TABLE
-- ============================================================

create table public.feed_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '👏')),
  created_at timestamptz default now(),
  unique(post_id, user_id, emoji)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_feed_reactions_post on public.feed_reactions(post_id);
create index idx_feed_reactions_user on public.feed_reactions(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.feed_reactions enable row level security;

-- Attendees can view reactions on posts they can see
create policy "Attendees can view reactions"
  on public.feed_reactions for select
  using (
    exists (
      select 1 from public.feed_posts fp
      where fp.id = post_id
        and (
          public.is_class_attendee(fp.class_instance_id)
          or exists (
            select 1 from public.class_instances ci
            where ci.id = fp.class_instance_id
              and public.is_studio_staff(ci.studio_id)
          )
        )
    )
  );

-- Staff can view all reactions in their studio's classes
create policy "Staff can view reactions"
  on public.feed_reactions for select
  using (
    exists (
      select 1 from public.feed_posts fp
      join public.class_instances ci on ci.id = fp.class_instance_id
      where fp.id = post_id
        and public.is_studio_staff(ci.studio_id)
    )
  );

-- Attendees and staff can add reactions
create policy "Attendees can create reactions"
  on public.feed_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.feed_posts fp
      where fp.id = post_id
        and (
          public.is_class_attendee(fp.class_instance_id)
          or exists (
            select 1 from public.class_instances ci
            where ci.id = fp.class_instance_id
              and public.is_studio_staff(ci.studio_id)
          )
        )
    )
  );

-- Users can remove their own reactions
create policy "Users can delete own reactions"
  on public.feed_reactions for delete
  using (user_id = auth.uid());

-- ============================================================
-- STORAGE BUCKET NOTE
-- ============================================================

-- The 'feed-media' bucket should be created via Supabase dashboard or CLI:
--   supabase storage create feed-media --public
-- With policies:
--   - Public read (URLs are unguessable UUIDs)
--   - Authenticated users can upload to feed/{studioId}/{classId}/{userId}/{uuid}.{ext}
--   - Max file size: 10MB
--   - Allowed MIME types: image/jpeg, image/png, image/webp, video/mp4
