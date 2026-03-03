-- Studio Co-op: Migration 022 — Tighten users table RLS
-- The original policy allowed ANY authenticated user to read ANY user profile.
-- Replace with scoped policies: own profile + studio co-members.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users are viewable by authenticated users" ON public.users;

-- Users can always see their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can see co-members (people in the same studio)
CREATE POLICY "Users can view studio co-members"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m1
      JOIN public.memberships m2 ON m1.studio_id = m2.studio_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = public.users.id
        AND m1.status = 'active'
        AND m2.status IN ('active', 'suspended')
    )
  );
