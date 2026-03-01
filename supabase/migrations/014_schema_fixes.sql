-- Studio Co-op: Migration 014 — Schema Fixes
-- Addresses column/index/policy mismatches found between API code and DB schema.

-- ============================================================
-- 1. SUBSCRIPTIONS: cancel_at_period_end, paused_at
-- Used by: routes/subscriptions.ts (cancel, pause endpoints)
--          routes/webhooks.ts (customer.subscription.updated)
-- ============================================================
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- ============================================================
-- 2. STUDIO_NETWORK_MEMBERS: status column
-- Used by: routes/networks.ts (accept/decline invitation flow)
-- The table originally only had joined_at; the API writes
-- status = 'pending' | 'active' | 'declined'.
-- ============================================================
ALTER TABLE public.studio_network_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'studio_network_members_status_check'
  ) THEN
    ALTER TABLE public.studio_network_members
      ADD CONSTRAINT studio_network_members_status_check
      CHECK (status IN ('pending', 'active', 'declined'));
  END IF;
END $$;

-- ============================================================
-- 3. STUDIOS: Stripe onboarding status booleans
-- Used by: routes/webhooks.ts (account.updated event handler)
-- ============================================================
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false;

-- ============================================================
-- 4. CLASS_INSTANCES: booked_count counter
-- Used by: routes/reports.ts (attendance rate calculation)
-- ============================================================
ALTER TABLE public.class_instances
  ADD COLUMN IF NOT EXISTS booked_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- 5. INDEXES for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_user_status
  ON public.bookings (user_id, status);

CREATE INDEX IF NOT EXISTS idx_memberships_studio_status
  ON public.memberships (studio_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_class_passes_studio_user
  ON public.class_passes (studio_id, user_id);

-- ============================================================
-- 6. RLS: feature_flags table
-- Migration 012 created the table but never enabled RLS or
-- added policies. Staff need full CRUD access.
-- ============================================================
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read feature flags
CREATE POLICY feature_flags_select ON public.feature_flags FOR SELECT
  USING (true);

-- Staff can manage studio-scoped flags; only service role manages global flags
CREATE POLICY feature_flags_insert_staff ON public.feature_flags FOR INSERT
  WITH CHECK (
    studio_id IS NOT NULL AND public.is_studio_staff(studio_id)
  );

CREATE POLICY feature_flags_update_staff ON public.feature_flags FOR UPDATE
  USING (
    studio_id IS NOT NULL AND public.is_studio_staff(studio_id)
  );

CREATE POLICY feature_flags_delete_staff ON public.feature_flags FOR DELETE
  USING (
    studio_id IS NOT NULL AND public.is_studio_staff(studio_id)
  );

-- ============================================================
-- 7. RLS: governance DELETE policies
-- Migration 011 only had SELECT/INSERT/UPDATE — staff need
-- to be able to delete agenda items and meeting records.
-- ============================================================

-- Meeting agenda items: staff who recorded the meeting can delete items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'agenda_items_delete_staff'
  ) THEN
    CREATE POLICY agenda_items_delete_staff ON public.meeting_agenda_items FOR DELETE
      USING (
        meeting_id IN (
          SELECT m.id FROM public.meetings m
          WHERE m.recorded_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Meetings: the recorder can delete their own meetings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'meetings_delete_own'
  ) THEN
    CREATE POLICY meetings_delete_own ON public.meetings FOR DELETE
      USING (recorded_by = auth.uid());
  END IF;
END $$;

-- Proposals: proposer can delete their own drafts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'proposals_delete_own_draft'
  ) THEN
    CREATE POLICY proposals_delete_own_draft ON public.proposals FOR DELETE
      USING (proposed_by = auth.uid() AND status = 'draft');
  END IF;
END $$;

-- ============================================================
-- 8. RPCs: increment/decrement classes_used_this_period
-- Used by: lib/credits.ts (deductCredit, refundCredit)
-- These RPCs run as SECURITY DEFINER to bypass RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_classes_used(subscription_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET classes_used_this_period = classes_used_this_period + 1
  WHERE id = subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_classes_used(subscription_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET classes_used_this_period = GREATEST(classes_used_this_period - 1, 0)
  WHERE id = subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. RPC: atomic credit deduction to prevent race conditions
-- Instead of read-then-write in app code, this function
-- atomically decrements remaining_classes and returns success.
-- ============================================================

-- Atomic deduction for comp_classes
CREATE OR REPLACE FUNCTION public.deduct_comp_credit(comp_id uuid)
RETURNS integer AS $$
DECLARE
  new_remaining integer;
BEGIN
  UPDATE public.comp_classes
  SET remaining_classes = remaining_classes - 1
  WHERE id = comp_id
    AND remaining_classes > 0
  RETURNING remaining_classes INTO new_remaining;

  IF NOT FOUND THEN
    RETURN -1; -- no credit available
  END IF;

  RETURN new_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic deduction for class_passes
CREATE OR REPLACE FUNCTION public.deduct_class_pass_credit(pass_id uuid)
RETURNS integer AS $$
DECLARE
  new_remaining integer;
BEGIN
  UPDATE public.class_passes
  SET remaining_classes = remaining_classes - 1
  WHERE id = pass_id
    AND remaining_classes > 0
  RETURNING remaining_classes INTO new_remaining;

  IF NOT FOUND THEN
    RETURN -1; -- no credit available
  END IF;

  RETURN new_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
