-- Studio Co-op: Migration 023 — Manual Subscription Payments
-- Purpose:
--   1) Allow admin/owner staff to record off-platform/manual payments (cash, bank transfer, etc).
--   2) Keep an audit trail of who marked a member as paid, for which plan, and through what date.
--   3) Support reconciliation reporting and member-level payment history.

-- ============================================================
-- TABLE: manual_subscription_payments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.manual_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  paid_through_date date NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'invoice', 'card_terminal', 'other')),
  reference text,
  notes text,
  marked_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  marked_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_subscription_payments_currency_len CHECK (char_length(currency) BETWEEN 3 AND 8)
);

CREATE INDEX IF NOT EXISTS idx_manual_sub_payments_studio_user_paid_through
  ON public.manual_subscription_payments (studio_id, user_id, paid_through_date DESC);

CREATE INDEX IF NOT EXISTS idx_manual_sub_payments_studio_marked_at
  ON public.manual_subscription_payments (studio_id, marked_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_sub_payments_studio_paid_through
  ON public.manual_subscription_payments (studio_id, paid_through_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.manual_subscription_payments ENABLE ROW LEVEL SECURITY;

-- Members can view their own manual payment records.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_subscription_payments'
      AND policyname = 'Users can view own manual subscription payments'
  ) THEN
    CREATE POLICY "Users can view own manual subscription payments"
      ON public.manual_subscription_payments FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Staff can view all records for their studio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_subscription_payments'
      AND policyname = 'Staff can view studio manual subscription payments'
  ) THEN
    CREATE POLICY "Staff can view studio manual subscription payments"
      ON public.manual_subscription_payments FOR SELECT
      USING (public.is_studio_staff(studio_id));
  END IF;
END $$;

-- Staff can insert records for their studio; actor must match marked_by.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_subscription_payments'
      AND policyname = 'Staff can create studio manual subscription payments'
  ) THEN
    CREATE POLICY "Staff can create studio manual subscription payments"
      ON public.manual_subscription_payments FOR INSERT
      WITH CHECK (
        public.is_studio_staff(studio_id)
        AND marked_by = auth.uid()
      );
  END IF;
END $$;

-- Staff can update records for their studio (for voiding/corrections).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manual_subscription_payments'
      AND policyname = 'Staff can update studio manual subscription payments'
  ) THEN
    CREATE POLICY "Staff can update studio manual subscription payments"
      ON public.manual_subscription_payments FOR UPDATE
      USING (public.is_studio_staff(studio_id));
  END IF;
END $$;
