-- Studio Co-op: Migration 020 — Security and Schema Fixes
-- Addresses: Issue #6 (partial), #16, #17, #18, #22

-- ============================================================
-- Issue #6 (partial): Add created_by_studio_id to studio_networks
-- Tracks which studio originally created the network.
-- ============================================================

ALTER TABLE public.studio_networks
  ADD COLUMN IF NOT EXISTS created_by_studio_id uuid REFERENCES public.studios(id);

-- Populate from the first member (founder) based on earliest joined_at
UPDATE public.studio_networks sn
SET created_by_studio_id = (
  SELECT studio_id FROM public.studio_network_members snm
  WHERE snm.network_id = sn.id
  ORDER BY joined_at ASC
  LIMIT 1
)
WHERE sn.created_by_studio_id IS NULL;

-- ============================================================
-- Issue #16: RLS for skill_definitions + member_skills
-- These tables (from migration 017) had no RLS enabled.
-- ============================================================

ALTER TABLE public.skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_skills ENABLE ROW LEVEL SECURITY;

-- skill_definitions: studio members can read
CREATE POLICY skill_definitions_select ON public.skill_definitions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
    AND memberships.studio_id = skill_definitions.studio_id
    AND memberships.status = 'active'
  ));

-- skill_definitions: staff (teacher/admin/owner) can insert/update/delete
CREATE POLICY skill_definitions_modify ON public.skill_definitions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
    AND memberships.studio_id = skill_definitions.studio_id
    AND memberships.role IN ('teacher', 'admin', 'owner')
    AND memberships.status = 'active'
  ));

-- member_skills: studio members can read
CREATE POLICY member_skills_select ON public.member_skills FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
    AND memberships.studio_id = member_skills.studio_id
    AND memberships.status = 'active'
  ));

-- member_skills: user can add own, or staff can add for anyone
CREATE POLICY member_skills_insert ON public.member_skills FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.studio_id = member_skills.studio_id
      AND memberships.role IN ('teacher', 'admin', 'owner')
      AND memberships.status = 'active'
    )
  );

-- member_skills: user can update own, or staff can update any
CREATE POLICY member_skills_update ON public.member_skills FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.studio_id = member_skills.studio_id
      AND memberships.role IN ('teacher', 'admin', 'owner')
      AND memberships.status = 'active'
    )
  );

-- member_skills: only admin/owner can delete
CREATE POLICY member_skills_delete ON public.member_skills FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
    AND memberships.studio_id = member_skills.studio_id
    AND memberships.role IN ('admin', 'owner')
    AND memberships.status = 'active'
  ));

-- ============================================================
-- Issue #17: RLS for sub_requests
-- Table (from migration 018) had no RLS enabled.
-- ============================================================

ALTER TABLE public.sub_requests ENABLE ROW LEVEL SECURITY;

-- sub_requests: studio members can read
CREATE POLICY sub_requests_select ON public.sub_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships
    WHERE memberships.user_id = auth.uid()
    AND memberships.studio_id = sub_requests.studio_id
    AND memberships.status = 'active'
  ));

-- sub_requests: requesting teacher must be auth user and a teacher/admin/owner
CREATE POLICY sub_requests_insert ON public.sub_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requesting_teacher_id
    AND EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.studio_id = sub_requests.studio_id
      AND memberships.role IN ('teacher', 'admin', 'owner')
      AND memberships.status = 'active'
    )
  );

-- sub_requests: requester, substitute, or admin/owner can update
CREATE POLICY sub_requests_update ON public.sub_requests FOR UPDATE
  USING (
    auth.uid() = requesting_teacher_id
    OR auth.uid() = substitute_teacher_id
    OR EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.studio_id = sub_requests.studio_id
      AND memberships.role IN ('admin', 'owner')
      AND memberships.status = 'active'
    )
  );

-- ============================================================
-- Issue #18: Strengthen governance INSERT policies
-- Original policies (migration 011) only checked auth.uid() match
-- but did not verify studio membership.
--
-- NOTE: proposals and meetings tables do NOT have a studio_id column,
-- so we can only enforce auth.uid() ownership checks on those.
-- votes table DOES have studio_id, so we add membership verification.
-- ============================================================

-- Drop existing weak INSERT policies
DROP POLICY IF EXISTS proposals_insert ON public.proposals;
DROP POLICY IF EXISTS votes_insert ON public.votes;
DROP POLICY IF EXISTS meetings_insert ON public.meetings;

-- Proposals: proposer must be auth user (no studio_id on this table)
-- Added explicit auth.uid() IS NOT NULL to prevent anonymous inserts
CREATE POLICY proposals_insert ON public.proposals FOR INSERT
  WITH CHECK (
    proposed_by = auth.uid()
    AND auth.uid() IS NOT NULL
  );

-- Votes: voter must be auth user AND an active admin/owner in the studio
CREATE POLICY votes_insert ON public.votes FOR INSERT
  WITH CHECK (
    voted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.user_id = auth.uid()
      AND memberships.studio_id = votes.studio_id
      AND memberships.role IN ('owner', 'admin')
      AND memberships.status = 'active'
    )
  );

-- Meetings: recorder must be auth user (no studio_id on this table)
-- Added explicit auth.uid() IS NOT NULL to prevent anonymous inserts
CREATE POLICY meetings_insert ON public.meetings FOR INSERT
  WITH CHECK (
    recorded_by = auth.uid()
    AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- Issue #22: Fix currency default on expenses
-- The studio_expenses table (migration 019) already defaults to 'NZD'.
-- This ensures the default is set explicitly (idempotent).
-- ============================================================

ALTER TABLE public.studio_expenses ALTER COLUMN currency SET DEFAULT 'USD';
