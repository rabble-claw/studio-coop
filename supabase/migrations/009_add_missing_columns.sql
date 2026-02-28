-- Studio Co-op: Migration 009 — Add missing columns referenced in API code
-- Adds stripe_customer_id to users and memberships, status to payments,
-- free_classes and stripe_coupon_id to coupons, and the increment_coupon_redemptions RPC.

-- ============================================================
-- USERS: stripe_customer_id for platform-level Stripe customer
-- ============================================================
alter table public.users
  add column if not exists stripe_customer_id text;

-- ============================================================
-- MEMBERSHIPS: stripe_customer_id for connected-account customer
-- ============================================================
alter table public.memberships
  add column if not exists stripe_customer_id text;

-- ============================================================
-- PAYMENTS: status column (previously only had refunded boolean)
-- ============================================================
alter table public.payments
  add column if not exists status text not null default 'succeeded'
    check (status in ('succeeded', 'pending', 'failed', 'refunded', 'partially_refunded'));

-- ============================================================
-- COUPONS: free_classes count and stripe_coupon_id
-- ============================================================
alter table public.coupons
  add column if not exists free_classes integer;

alter table public.coupons
  add column if not exists stripe_coupon_id text;

-- ============================================================
-- RPC: increment_coupon_redemptions
-- Atomically increments current_redemptions by 1 for a given coupon.
-- ============================================================
create or replace function public.increment_coupon_redemptions(coupon_id uuid)
returns void as $$
begin
  update public.coupons
  set current_redemptions = current_redemptions + 1
  where id = coupon_id;
end;
$$ language plpgsql security definer;
