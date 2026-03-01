-- 016: Add privacy settings to users table
-- Allows members to control visibility of their profile data to other members

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_settings jsonb DEFAULT '{}';

COMMENT ON COLUMN public.users.privacy_settings IS 'Member privacy preferences: profile_visibility, show_attendance, show_email, show_phone, show_achievements, feed_posts_visible';
