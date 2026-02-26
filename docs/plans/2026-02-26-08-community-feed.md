# Community Feed — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Per-class social feeds where attendees share photos, celebrate achievements, and build community. The feature no competitor has.

**Architecture:** Feed posts stored in DB, media in Supabase Storage. Privacy enforced at API level (only checked-in attendees + staff). Reactions stored as a join table.

**Tech Stack:** Hono, Supabase Storage, React, React Native

**Depends on:** Plan 1, 2, 7 (check-in unlocks feed)

---

### Task 1: Feed API routes

Create `packages/api/src/routes/feed.ts`:

- `GET /api/classes/:classId/feed` — get posts (attendees + staff only)
- `POST /api/classes/:classId/feed` — create post (attendees + staff only)
- `DELETE /api/feed/:postId` — delete own post (or staff can delete any)
- `POST /api/feed/:postId/react` — add reaction
- `DELETE /api/feed/:postId/react` — remove reaction

Privacy check: before any read/write, verify `is_class_attendee(classId)` or `is_studio_staff(studioId)`.

Post response includes: author (name, avatar), content, media URLs, reactions summary, timestamp.

**Tests:** Privacy enforcement (non-attendee blocked), CRUD operations, reaction toggle.

---

### Task 2: Add reactions table

If not already in schema v2, add:

```sql
feed_reactions (
  id uuid primary key,
  post_id uuid references feed_posts on delete cascade,
  user_id uuid references users on delete cascade,
  emoji text not null,  -- '❤️', '🔥', '👏'
  created_at timestamptz default now(),
  UNIQUE(post_id, user_id, emoji)
)
```

RLS: users can manage own reactions. Attendees + staff can view.

**Tests:** Unique constraint, reaction counts in feed response.

---

### Task 3: Media upload

Create `packages/api/src/routes/upload.ts`:

`POST /api/upload` — upload media to Supabase Storage

Flow:
1. Authenticate user
2. Accept file (multipart/form-data)
3. Validate: max 10MB, allowed types (image/jpeg, image/png, image/webp, video/mp4)
4. Generate unique path: `feed/{studioId}/{classId}/{userId}/{uuid}.{ext}`
5. Upload to Supabase Storage bucket `feed-media`
6. Return public URL

Configure Supabase Storage bucket:
- Public read (URLs are unguessable)
- Auth required for upload
- Max file size: 10MB
- Allowed MIME types

**Tests:** Upload validation, path generation, size limits.

---

### Task 4: Web feed UI

Add feed component to `apps/web/src/app/dashboard/classes/[id]/page.tsx`:

- Post list with avatar, name, content, media grid, reactions, timestamp
- "Write a post" composer at top (text + image upload)
- Reaction buttons (tap to react/unreact)
- Only visible if user has attendance record for this class

Also add a studio-wide feed view at `apps/web/src/app/dashboard/feed/page.tsx`:
- Aggregates recent posts across all classes at the studio
- Staff can see all; members see only their attended classes

---

### Task 5: Mobile feed UI

Feed tab in class detail: `apps/mobile/src/app/(tabs)/class/[id].tsx` (add feed section)

Also home screen feed: `apps/mobile/src/app/(tabs)/index.tsx` — recent posts from attended classes across all studios.

- Pull to refresh
- Image viewer (tap to expand)
- Camera integration for posting photos directly
- Reactions with haptic feedback

---

### Task 6: Auto-posts

System-generated posts for milestones:
- "🎉 [Member] just completed their 10th class!"
- "🔥 [Member] has a 4-week attendance streak!"
- "⭐ [Member] attended their first class at [Studio]!"

Create `packages/api/src/lib/milestones.ts`:
- Check milestones after each check-in
- Auto-create feed posts with `post_type = 'milestone'`
- Configurable per studio (`settings.autoMilestones: boolean`)

**Tests:** Milestone detection (10th class, streaks, first class), post creation.
