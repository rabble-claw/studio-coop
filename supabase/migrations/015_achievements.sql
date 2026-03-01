-- Studio Co-op: Achievements Migration
-- Adds achievements table for member skill/milestone tracking

-- ============================================================
-- ACHIEVEMENTS TABLE
-- ============================================================

CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('skill', 'milestone', 'personal', 'general')),
  icon text DEFAULT '🏆',
  earned_at timestamptz DEFAULT now(),
  feed_post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_achievements_user ON public.achievements(user_id, studio_id);
CREATE INDEX idx_achievements_studio ON public.achievements(studio_id, earned_at DESC);

-- ============================================================
-- Make feed_posts.class_instance_id nullable for studio-wide posts
-- ============================================================

ALTER TABLE public.feed_posts ALTER COLUMN class_instance_id DROP NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Members can view achievements in their studio
CREATE POLICY "Members can view studio achievements"
  ON public.achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.studio_id = achievements.studio_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- Users can create their own achievements
CREATE POLICY "Users can create own achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own achievements
CREATE POLICY "Users can delete own achievements"
  ON public.achievements FOR DELETE
  USING (user_id = auth.uid());

-- Staff can delete any achievement in their studio
CREATE POLICY "Staff can delete studio achievements"
  ON public.achievements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.studio_id = achievements.studio_id
        AND m.user_id = auth.uid()
        AND m.role IN ('teacher', 'admin', 'owner')
        AND m.status = 'active'
    )
  );

-- Staff can create achievements for any member in their studio
CREATE POLICY "Staff can create achievements for members"
  ON public.achievements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.studio_id = achievements.studio_id
        AND m.user_id = auth.uid()
        AND m.role IN ('teacher', 'admin', 'owner')
        AND m.status = 'active'
    )
  );
