-- Studio Co-op: Migration 002 — Payments & Features
-- Adds payment tables, comp classes, coupons, studio networks, private bookings, migration tracking


-- ============================================================
-- PAYMENT TABLES
-- ============================================================

-- Membership Plans (what a studio offers for sale)
create table public.membership_plans (
  id uuid primary key default uuid_generate_v4(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  description text,
  type text not null check (type in ('unlimited','limited','class_pack','drop_in','intro')),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  interval text not null check (interval in ('month','year','once')),
  class_limit integer,     -- for limited/class_pack types (null = unlimited)
  validity_days integer,   -- how long a class pack is valid after purchase
  stripe_price_id text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Subscriptions (recurring memberships)
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id),
  stripe_subscription_id text,
  stripe_customer_id text,
  status text not null default 'active' check (status in ('active','past_due','cancelled','paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  classes_used_this_period integer not null default 0,
  cancelled_at timestamptz,
  created_at timestamptz default now()
);

-- Class Passes (pre-purchased class packs / drop-ins)
create table public.class_passes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  plan_id uuid references public.membership_plans(id),
  total_classes integer not null check (total_classes > 0),
  remaining_classes integer not null check (remaining_classes >= 0),
  purchased_at timestamptz default now(),
  expires_at timestamptz,
  stripe_payment_intent_id text
);

-- Payments (record of every financial transaction)
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  type text not null check (type in ('subscription','class_pack','drop_in','private_booking')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  stripe_payment_intent_id text,
  refunded boolean not null default false,
  refund_amount_cents integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- COMP CLASSES & COUPONS
-- ============================================================

-- Comp Classes (complimentary classes granted to members by staff)
create table public.comp_classes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  granted_by uuid references public.users(id),
  reason text,
  total_classes integer not null check (total_classes > 0),
  remaining_classes integer not null check (remaining_classes >= 0),
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Coupons (discount codes)
create table public.coupons (
  id uuid primary key default uuid_generate_v4(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  code text not null,
  type text not null check (type in ('percent_off','amount_off','free_classes')),
  value integer not null check (value > 0),
  applies_to text not null default 'any' check (applies_to in ('any','plan','drop_in','new_member')),
  plan_ids uuid[] default '{}',
  max_redemptions integer,  -- null = unlimited
  current_redemptions integer not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz default now(),
  unique(studio_id, code)
);

-- Coupon Redemptions (audit trail of coupon usage)
create table public.coupon_redemptions (
  id uuid primary key default uuid_generate_v4(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  applied_to_type text,
  applied_to_id uuid,
  discount_amount_cents integer not null default 0,
  redeemed_at timestamptz not null default now()
);
