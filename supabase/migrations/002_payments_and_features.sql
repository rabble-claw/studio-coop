-- Studio Co-op: Migration 002 — Payments & Features
-- Adds payment tables, comp classes, coupons, studio networks, private bookings, migration tracking


-- ============================================================
-- PAYMENT TABLES
-- ============================================================

-- Membership Plans (what a studio offers for sale)
create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
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
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  applied_to_type text,
  applied_to_id uuid,
  discount_amount_cents integer not null default 0,
  redeemed_at timestamptz not null default now()
);

-- ============================================================
-- STUDIO NETWORKS, PRIVATE BOOKINGS & MIGRATION TRACKING
-- ============================================================

-- Studio Networks (groups of studios with cross-booking agreements)
create table public.studio_networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Studio Network Members (which studios belong to which network)
create table public.studio_network_members (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.studio_networks(id) on delete cascade,
  studio_id uuid not null references public.studios(id) on delete cascade,
  cross_booking_policy text not null default 'full_price' check (cross_booking_policy in ('full_price','discounted','included')),
  discount_percent integer check (discount_percent between 0 and 100),
  joined_at timestamptz not null default now(),
  unique(network_id, studio_id)
);

-- Private Bookings (parties, private tuition, group events)
create table public.private_bookings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('party','private_tuition','group')),
  title text not null,
  description text,
  notes text,
  date date not null,
  start_time time not null,
  end_time time not null,
  attendee_count integer check (attendee_count > 0),
  price_cents integer check (price_cents >= 0),
  deposit_cents integer check (deposit_cents >= 0),
  deposit_paid boolean not null default false,
  status text not null default 'requested' check (status in ('requested','confirmed','completed','cancelled')),
  stripe_payment_intent_id text,
  created_at timestamptz default now()
);

-- Migration Imports (tracking imports from other platforms)
create table public.migration_imports (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  source text not null check (source in ('mindbody','vagaro','csv')),
  file_name text,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  imported_counts jsonb not null default '{}',
  errors jsonb not null default '[]',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Membership Plans
create index idx_membership_plans_studio on public.membership_plans(studio_id);
create index idx_membership_plans_studio_active on public.membership_plans(studio_id) where active = true;

-- Subscriptions
create index idx_subscriptions_user on public.subscriptions(user_id);
create index idx_subscriptions_studio on public.subscriptions(studio_id);
create index idx_subscriptions_stripe on public.subscriptions(stripe_subscription_id);
create index idx_subscriptions_status on public.subscriptions(studio_id, status);

-- Class Passes
create index idx_class_passes_user on public.class_passes(user_id);
create index idx_class_passes_studio on public.class_passes(studio_id);
create index idx_class_passes_remaining on public.class_passes(user_id) where remaining_classes > 0;

-- Payments
create index idx_payments_user on public.payments(user_id);
create index idx_payments_studio on public.payments(studio_id);
create index idx_payments_stripe on public.payments(stripe_payment_intent_id);

-- Comp Classes
create index idx_comp_classes_user on public.comp_classes(user_id);
create index idx_comp_classes_remaining on public.comp_classes(user_id) where remaining_classes > 0;

-- Coupons
create index idx_coupons_studio on public.coupons(studio_id);
create index idx_coupons_code on public.coupons(code);

-- Coupon Redemptions
create index idx_coupon_redemptions_coupon on public.coupon_redemptions(coupon_id);
create index idx_coupon_redemptions_user on public.coupon_redemptions(user_id);

-- Private Bookings
create index idx_private_bookings_studio on public.private_bookings(studio_id);
create index idx_private_bookings_user on public.private_bookings(user_id);
create index idx_private_bookings_date on public.private_bookings(studio_id, date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.membership_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.class_passes enable row level security;
alter table public.payments enable row level security;
alter table public.comp_classes enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.studio_networks enable row level security;
alter table public.studio_network_members enable row level security;
alter table public.private_bookings enable row level security;
alter table public.migration_imports enable row level security;

-- ---------- Membership Plans ----------
-- Public read (studio pages show plans to potential members)
create policy "Membership plans are publicly viewable"
  on public.membership_plans for select
  using (true);

-- Staff can insert plans
create policy "Staff can create membership plans"
  on public.membership_plans for insert
  with check (public.is_studio_staff(studio_id));

-- Staff can update plans
create policy "Staff can update membership plans"
  on public.membership_plans for update
  using (public.is_studio_staff(studio_id));

-- Staff can delete plans
create policy "Staff can delete membership plans"
  on public.membership_plans for delete
  using (public.is_studio_staff(studio_id));

-- ---------- Subscriptions ----------
-- Users can view their own subscriptions
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (user_id = auth.uid());

-- Staff can view all subscriptions in their studio
create policy "Staff can view studio subscriptions"
  on public.subscriptions for select
  using (public.is_studio_staff(studio_id));

-- Staff (and system via service role) can insert subscriptions
create policy "Staff can create subscriptions"
  on public.subscriptions for insert
  with check (public.is_studio_staff(studio_id));

-- Staff can update subscriptions (e.g. pause, cancel)
create policy "Staff can update subscriptions"
  on public.subscriptions for update
  using (public.is_studio_staff(studio_id));

-- ---------- Class Passes ----------
-- Users can view their own class passes
create policy "Users can view own class passes"
  on public.class_passes for select
  using (user_id = auth.uid());

-- Staff can view all class passes in their studio
create policy "Staff can view studio class passes"
  on public.class_passes for select
  using (public.is_studio_staff(studio_id));

-- Staff can insert class passes (e.g. comp passes, manual entry)
create policy "Staff can create class passes"
  on public.class_passes for insert
  with check (public.is_studio_staff(studio_id));

-- Staff can update class passes (e.g. adjust remaining classes)
create policy "Staff can update class passes"
  on public.class_passes for update
  using (public.is_studio_staff(studio_id));

-- ---------- Payments ----------
-- Users can view their own payment records
create policy "Users can view own payments"
  on public.payments for select
  using (user_id = auth.uid());

-- Staff can view all payments in their studio
create policy "Staff can view studio payments"
  on public.payments for select
  using (public.is_studio_staff(studio_id));

-- Staff can insert payment records
create policy "Staff can create payments"
  on public.payments for insert
  with check (public.is_studio_staff(studio_id));

-- ---------- Comp Classes ----------
-- Users can view their own comp classes
create policy "Users can view own comp classes"
  on public.comp_classes for select
  using (user_id = auth.uid());

-- Staff can view all comp classes in their studio
create policy "Staff can view studio comp classes"
  on public.comp_classes for select
  using (public.is_studio_staff(studio_id));

-- Staff can grant comp classes
create policy "Staff can create comp classes"
  on public.comp_classes for insert
  with check (public.is_studio_staff(studio_id));

-- Staff can update comp classes (e.g. adjust remaining)
create policy "Staff can update comp classes"
  on public.comp_classes for update
  using (public.is_studio_staff(studio_id));

-- ---------- Coupons ----------
-- Public read for active coupons (needed for code validation)
create policy "Active coupons are publicly viewable"
  on public.coupons for select
  using (active = true);

-- Staff can view all coupons (including inactive)
create policy "Staff can view all studio coupons"
  on public.coupons for select
  using (public.is_studio_staff(studio_id));

-- Staff can create coupons
create policy "Staff can create coupons"
  on public.coupons for insert
  with check (public.is_studio_staff(studio_id));

-- Staff can update coupons
create policy "Staff can update coupons"
  on public.coupons for update
  using (public.is_studio_staff(studio_id));

-- Staff can delete coupons
create policy "Staff can delete coupons"
  on public.coupons for delete
  using (public.is_studio_staff(studio_id));

-- ---------- Coupon Redemptions ----------
-- Users can view their own redemptions
create policy "Users can view own coupon redemptions"
  on public.coupon_redemptions for select
  using (user_id = auth.uid());

-- Staff can view all redemptions in their studio
create policy "Staff can view studio coupon redemptions"
  on public.coupon_redemptions for select
  using (public.is_studio_staff(studio_id));

-- Authenticated users can redeem coupons
create policy "Authenticated users can redeem coupons"
  on public.coupon_redemptions for insert
  with check (user_id = auth.uid());

-- ---------- Studio Networks ----------
-- Public read
create policy "Studio networks are publicly viewable"
  on public.studio_networks for select
  using (true);

-- ---------- Studio Network Members ----------
-- Public read
create policy "Studio network members are publicly viewable"
  on public.studio_network_members for select
  using (true);

-- Studio owners can manage their studio's network memberships
create policy "Owners can manage studio network membership"
  on public.studio_network_members for insert
  with check (public.is_studio_staff(studio_id));

create policy "Owners can update studio network membership"
  on public.studio_network_members for update
  using (public.is_studio_staff(studio_id));

create policy "Owners can remove studio from network"
  on public.studio_network_members for delete
  using (public.is_studio_staff(studio_id));

-- ---------- Private Bookings ----------
-- Users can view their own private bookings
create policy "Users can view own private bookings"
  on public.private_bookings for select
  using (user_id = auth.uid());

-- Staff can view all private bookings in their studio
create policy "Staff can view studio private bookings"
  on public.private_bookings for select
  using (public.is_studio_staff(studio_id));

-- Authenticated users can request private bookings
create policy "Authenticated users can request private bookings"
  on public.private_bookings for insert
  with check (user_id = auth.uid());

-- Staff can update private bookings (confirm, complete, cancel)
create policy "Staff can update private bookings"
  on public.private_bookings for update
  using (public.is_studio_staff(studio_id));

-- ---------- Migration Imports ----------
-- Owners can view their own migration imports
create policy "Owners can view migration imports"
  on public.migration_imports for select
  using (public.is_studio_staff(studio_id));

-- Owners can create migration imports
create policy "Owners can create migration imports"
  on public.migration_imports for insert
  with check (public.is_studio_staff(studio_id));

-- Owners can update migration imports (e.g. status updates)
create policy "Owners can update migration imports"
  on public.migration_imports for update
  using (public.is_studio_staff(studio_id));
