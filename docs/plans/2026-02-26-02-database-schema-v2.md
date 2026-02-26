# Database Schema v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add all new tables needed for payments, memberships, coupons, comp classes, multi-studio networks, private bookings, and migration tracking.

**Architecture:** Single SQL migration file (`002_payments_and_features.sql`) adds all new tables with RLS policies. Drizzle ORM schema and Zod validation schemas updated to match.

**Tech Stack:** PostgreSQL (Supabase), Drizzle ORM, Zod

---

### Task 1: Write migration SQL — payment tables

**Files:**
- Create: `supabase/migrations/002_payments_and_features.sql`

Create tables: `membership_plans`, `subscriptions`, `class_passes`, `payments`

All tables need:
- UUID primary keys with `uuid_generate_v4()`
- Foreign keys to `studios` and `users`
- `created_at timestamptz default now()`
- Appropriate CHECK constraints on enums and numeric fields

`membership_plans`: id, studio_id, name, description, type (enum: unlimited/limited/class_pack/drop_in/intro), price_cents int, currency text, interval (month/year/once), class_limit int, validity_days int, stripe_price_id text, active boolean, sort_order int, created_at

`subscriptions`: id, user_id, studio_id, plan_id (references membership_plans), stripe_subscription_id, stripe_customer_id, status (active/past_due/cancelled/paused), current_period_start timestamptz, current_period_end timestamptz, classes_used_this_period int default 0, cancelled_at timestamptz, created_at

`class_passes`: id, user_id, studio_id, plan_id, total_classes int, remaining_classes int, purchased_at timestamptz, expires_at timestamptz, stripe_payment_intent_id text

`payments`: id, user_id, studio_id, type (subscription/class_pack/drop_in/private_booking), amount_cents int, currency text, stripe_payment_intent_id text, refunded boolean default false, refund_amount_cents int default 0, metadata jsonb default '{}', created_at

**Commit:** `feat(db): migration 002 — payment tables`

---

### Task 2: Write migration SQL — comp classes & coupons

Add to same migration file:

`comp_classes`: id, user_id, studio_id, granted_by uuid references users, reason text, total_classes int, remaining_classes int, expires_at timestamptz, created_at

`coupons`: id, studio_id, code text unique, type (percent_off/amount_off/free_classes), value int, applies_to (any/plan/drop_in/new_member), plan_ids uuid[], max_redemptions int, current_redemptions int default 0, valid_from timestamptz, valid_until timestamptz, active boolean default true, created_at

`coupon_redemptions`: id, coupon_id, user_id, studio_id, applied_to_type text, applied_to_id uuid, discount_amount_cents int, redeemed_at timestamptz default now()

**Commit:** `feat(db): migration 002 — comp classes & coupon tables`

---

### Task 3: Write migration SQL — studio networks & private bookings

`studio_networks`: id, name text, description text, created_at

`studio_network_members`: id, network_id references studio_networks, studio_id references studios, cross_booking_policy (full_price/discounted/included), discount_percent int, joined_at timestamptz default now(). UNIQUE(network_id, studio_id)

`private_bookings`: id, studio_id, user_id, type (party/private_tuition/group), title text, description text, notes text, date date, start_time time, end_time time, attendee_count int, price_cents int, deposit_cents int, deposit_paid boolean default false, status (requested/confirmed/completed/cancelled), stripe_payment_intent_id text, created_at

`migration_imports`: id, studio_id, source (mindbody/vagaro/csv), file_name text, status (pending/processing/completed/failed), imported_counts jsonb default '{}', errors jsonb default '[]', started_at timestamptz, completed_at timestamptz, created_at

**Commit:** `feat(db): migration 002 — networks, private bookings, migration tracking`

---

### Task 4: Write migration SQL — indexes

Add indexes for all new tables following the same patterns as 001:

- `idx_membership_plans_studio` on membership_plans(studio_id)
- `idx_membership_plans_studio_active` on membership_plans(studio_id) WHERE active = true
- `idx_subscriptions_user` on subscriptions(user_id)
- `idx_subscriptions_studio` on subscriptions(studio_id)
- `idx_subscriptions_stripe` on subscriptions(stripe_subscription_id)
- `idx_subscriptions_status` on subscriptions(studio_id, status)
- `idx_class_passes_user` on class_passes(user_id)
- `idx_class_passes_studio` on class_passes(studio_id)
- `idx_class_passes_remaining` on class_passes(user_id) WHERE remaining_classes > 0
- `idx_payments_user` on payments(user_id)
- `idx_payments_studio` on payments(studio_id)
- `idx_payments_stripe` on payments(stripe_payment_intent_id)
- `idx_comp_classes_user` on comp_classes(user_id)
- `idx_comp_classes_remaining` on comp_classes(user_id) WHERE remaining_classes > 0
- `idx_coupons_studio` on coupons(studio_id)
- `idx_coupons_code` on coupons(code) — already unique but explicit
- `idx_coupon_redemptions_coupon` on coupon_redemptions(coupon_id)
- `idx_coupon_redemptions_user` on coupon_redemptions(user_id)
- `idx_private_bookings_studio` on private_bookings(studio_id)
- `idx_private_bookings_user` on private_bookings(user_id)
- `idx_private_bookings_date` on private_bookings(studio_id, date)

**Commit:** `feat(db): migration 002 — indexes`

---

### Task 5: Write migration SQL — RLS policies

Enable RLS on all new tables. Key policies:

**membership_plans:** Public read (for studio pages). Staff can manage (insert/update/delete).

**subscriptions:** Users can view own. Staff can view all in studio. System/staff can insert/update.

**class_passes:** Users can view own. Staff can view all in studio.

**payments:** Users can view own. Staff can view all in studio.

**comp_classes:** Users can view own. Staff can manage (grant, view all in studio).

**coupons:** Public read for active coupons (needed for code validation). Staff can manage.

**coupon_redemptions:** Users can view own. Staff can view all in studio.

**studio_networks / studio_network_members:** Public read. Owners can manage their studio's membership.

**private_bookings:** Users can view own. Staff can manage all in studio. Authenticated users can insert (request).

**migration_imports:** Owner only (view, create).

**Commit:** `feat(db): migration 002 — RLS policies`

---

### Task 6: Update Drizzle ORM schema

**Files:**
- Modify: `packages/db/src/schema.ts`

Add all new table definitions using Drizzle's `pgTable` matching the SQL migration exactly. Follow existing patterns in the file.

**Commit:** `feat(db): drizzle schema for v2 tables`

---

### Task 7: Update Zod schemas

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/types.ts`

Add validation schemas for:
- `createMembershipPlanSchema`
- `createSubscriptionSchema`
- `purchaseClassPackSchema`
- `createCouponSchema`
- `redeemCouponSchema`
- `grantCompClassSchema`
- `createPrivateBookingSchema`
- `startMigrationImportSchema`

Add TypeScript interfaces for all new entities.

**Commit:** `feat(shared): zod schemas + types for v2 entities`

---

### Task 8: Update seed data

**Files:**
- Modify: `supabase/seed.sql`

Add demo data for Empire Aerial Arts:
- 3 membership plans (Unlimited $180/mo, 8-Class Pack $160, Drop-in $25)
- 2 sample coupons (WELCOME20 = 20% off first month, BRINGAFRIEND = 1 free class)
- A few sample comp classes
- Keep existing seed data intact

Also update `apps/web/src/lib/demo-data.ts` with matching demo plan/coupon data.

**Commit:** `feat(db): seed data for v2 entities`
