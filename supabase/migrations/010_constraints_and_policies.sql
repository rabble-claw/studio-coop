-- Studio Co-op: Migration 010 — Constraints & Security Policies
-- L14: attendance unique constraint
-- L15: subscriptions active uniqueness
-- L16: DELETE policies for memberships and notifications

-- ============================================================
-- L14: Attendance — prevent duplicate check-ins
-- ============================================================
-- A user can only have one attendance record per class instance.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_class_instance_user_unique'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_class_instance_user_unique UNIQUE (class_instance_id, user_id);
  END IF;
END $$;

-- ============================================================
-- L15: Subscriptions — only one active subscription per user per studio
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_unique
  ON public.subscriptions (user_id, studio_id)
  WHERE status = 'active';

-- ============================================================
-- L16: Missing DELETE policies
-- ============================================================

-- Admins/owners can delete memberships (e.g. remove a member from the studio)
CREATE POLICY memberships_delete_staff ON public.memberships FOR DELETE
  USING (studio_id IN (
    SELECT studio_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner') AND status = 'active'
  ));

-- Users can delete their own notifications
CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE
  USING (user_id = auth.uid());
