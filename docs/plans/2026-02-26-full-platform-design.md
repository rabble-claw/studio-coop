# Studio Co-op — Full Platform Design

**Date:** 2026-02-26
**Status:** Approved by Rabble
**Launch customer:** Emma @ Empire Aerial Arts (Wellington, currently on Mindbody)

---

## Context

Studio Co-op is a community-first studio management platform — booking, check-in, class community feeds. Built to replace Mindbody at a fraction of the cost, with social features no competitor offers. Structured as a platform cooperative.

Emma runs Empire Aerial Arts, a queer-owned boutique pole/aerial studio on Cuba Street, Wellington. She's excited to switch from Mindbody and can bring other Wellington studio owners. Her studio runs:
- Drop-in class passes (prepaid packs)
- Monthly memberships
- Private tuition / parties / group bookings
- Open timetable (no terms — attend any class anytime)
- Level system for pole (1-5), Movement & Cirque, Fitness & Development

**Build philosophy:** Build it right, build it complete, then migrate. Migration is a one-shot event — everything needs to work before flipping the switch.

---

## Architecture

### Three Apps, One API

- **`apps/web`** — Studio dashboard (owners/teachers manage everything) — Next.js 15
- **`apps/mobile`** — Member + teacher app — Expo / React Native
- **`apps/admin`** — Platform super-admin (co-op management) — Next.js 15
- **`packages/api`** — Hono API layer — the single source of truth

**Principle:** No client ever talks to Supabase directly. All business logic lives in the API layer. Clients are display layers.

### Existing Infrastructure (already built)
- Monorepo scaffold (Turborepo + pnpm)
- Supabase migration: core tables, indexes, RLS policies, helper functions
- Drizzle ORM schema + Zod validation schemas + shared TypeScript types
- Web: landing page, login, dashboard (demo mode), schedule, members, class detail, public studio page
- Mobile: Expo Router scaffold, auth screens, home/studio/class/profile tabs
- 42 tests (Vitest)
- Docs: architecture, user stories, competitor research, pitch deck, marketing site

### New Tables Needed

```sql
-- Membership plans defined by each studio
membership_plans (
  id, studio_id, name, description, type ['unlimited','limited','class_pack','drop_in','intro'],
  price_cents, currency, interval ['month','year','once'],
  class_limit,          -- null for unlimited, N for limited/packs
  validity_days,        -- null for no expiry, N for pack expiry
  stripe_price_id,
  active, sort_order, created_at
)

-- Active subscriptions (recurring plans)
subscriptions (
  id, user_id, studio_id, plan_id,
  stripe_subscription_id, stripe_customer_id,
  status ['active','past_due','cancelled','paused'],
  current_period_start, current_period_end,
  classes_used_this_period,  -- for limited plans
  cancelled_at, created_at
)

-- Class pass balances (punch cards)
class_passes (
  id, user_id, studio_id, plan_id,
  total_classes, remaining_classes,
  purchased_at, expires_at,
  stripe_payment_intent_id
)

-- Transaction log
payments (
  id, user_id, studio_id,
  type ['subscription','class_pack','drop_in','private_booking'],
  amount_cents, currency,
  stripe_payment_intent_id,
  refunded, refund_amount_cents,
  metadata jsonb, created_at
)

-- Comp classes (gifted free classes)
comp_classes (
  id, user_id, studio_id,
  granted_by uuid REFERENCES users,
  reason text,
  total_classes, remaining_classes,
  expires_at, created_at
)

-- Discount coupons
coupons (
  id, studio_id, code text UNIQUE,
  type ['percent_off','amount_off','free_classes'],
  value,                    -- percent (0-100), cents, or class count
  applies_to ['any','plan','drop_in','new_member'],
  plan_ids uuid[],          -- if applies_to = 'plan'
  max_redemptions, current_redemptions,
  valid_from, valid_until,
  active, created_at
)

-- Coupon redemption log
coupon_redemptions (
  id, coupon_id, user_id, studio_id,
  applied_to_type, applied_to_id,
  discount_amount_cents, redeemed_at
)

-- Studio network (cross-booking)
studio_networks (
  id, name, description, created_at
)

studio_network_members (
  id, network_id, studio_id,
  cross_booking_policy ['full_price','discounted','included'],
  discount_percent,
  joined_at
)

-- Private bookings (parties, tuition)
private_bookings (
  id, studio_id, user_id,
  type ['party','private_tuition','group'],
  title, description, notes,
  date, start_time, end_time,
  attendee_count, price_cents,
  deposit_cents, deposit_paid boolean,
  status ['requested','confirmed','completed','cancelled'],
  stripe_payment_intent_id,
  created_at
)

-- Migration imports tracking
migration_imports (
  id, studio_id, source ['mindbody','vagaro','csv'],
  file_name, status ['pending','processing','completed','failed'],
  imported_counts jsonb,   -- { members: N, classes: N, ... }
  errors jsonb,
  started_at, completed_at, created_at
)
```

---

## Feature Areas

### 1. Payments & Membership Plans (Stripe Connect)

Each studio gets a Stripe Connect Express account. Money flows directly to them.

**Plan types a studio can create:**
- Unlimited membership — flat monthly fee, unlimited classes
- Limited membership — X classes per month
- Class packs — buy N, use whenever (configurable expiry)
- Drop-in — single class purchase
- Intro offers — "3 classes for $30" new-member specials

**Comp classes:** Owner/teacher can gift N free classes to a member. Tracks who comped it and why.

**Coupons:** Studio creates discount codes — percentage off, flat discount, or free classes. Can be limited to new members, specific plans, or date-bounded.

### 2. Booking & Waitlist

1. Member opens schedule → sees classes with spots available
2. Books a class → deducts from pack/membership or charges drop-in
3. Gets confirmation + calendar invite
4. 24h before: push notification "Still coming?"
5. Member confirms or cancels → if cancel, waitlist auto-promotes next person
6. Teacher opens check-in → photo grid → tap to mark present
7. After class → feed unlocks for attendees

Waitlist rules (configurable per studio): auto-promote window, max waitlist size, notification timing.

### 3. Class Instance Generation

Templates define recurring patterns. A scheduled job generates instances 2-4 weeks ahead. Owners can modify individual instances (sub teacher, cancel, change capacity, add notes).

### 4. Community Feed

Per-class-instance feeds, only visible to checked-in attendees + staff. Members post text, photos, short video. Teachers post instructor notes. Reactions (❤️ 🔥 👏).

### 5. Multi-Studio Network

- One account, multiple studio memberships
- Studios opt into networks (e.g., "Wellington Aerial Network")
- Cross-booking with studio-configurable rules (full price, discount, or included)
- Each studio independent: own Stripe account, own data, own branding

### 6. Admin Panel (apps/admin)

- View all studios, approve signups
- Platform analytics
- Co-op management: tiers, billing, feature flags
- Support tools: impersonate studio view, audit logs

### 7. Mindbody Migration Tool

CSV-based wizard in web dashboard:
- Members (name, email, phone, membership status)
- Class schedule (templates, recurring patterns)
- Membership plans (map to Studio Co-op plans)
- Attendance history
- Payment method re-collection guide (can't migrate card tokens)
- Validation + dry-run mode

### 8. Private Bookings

Parties, private tuition, group bookings:
- Studio defines session types + pricing
- Request form (public or members-only)
- Owner confirms → creates one-off class instance
- Payment: deposit + balance

### 9. Notifications

- Push (Expo Notifications) — reminders, confirmations, waitlist
- Email (Resend or Supabase) — receipts, re-engagement
- In-app notification center
- Configurable per studio

### 10. Mobile App Screens

- Home: upcoming classes, quick book, studio feed
- Schedule: browse by day, filter by type/teacher/level
- Class detail: book/cancel, class info
- Check-in (teacher mode): photo grid, tap to mark, walk-ins
- Feed: per-class posts, reactions
- Profile: memberships, history, packs, settings
- Multi-studio: switch studios, discover network

---

## Implementation Order

Planned as separate implementation plans, roughly in dependency order:

1. **API Layer Foundation** — Hono setup, auth middleware, Supabase server client, error handling, testing scaffold
2. **Database Schema v2** — New tables (plans, subscriptions, passes, payments, coupons, comps, networks, private bookings, migrations)
3. **Stripe Connect Integration** — Onboarding flow, webhook handling, payment processing
4. **Membership Plans & Subscriptions** — CRUD for plans, subscription lifecycle, class pack purchases
5. **Booking & Waitlist Engine** — The core booking flow with credit deduction, waitlist, confirmations
6. **Class Instance Generation** — Cron/scheduled job to generate instances from templates
7. **Check-in & Attendance** — Teacher check-in UI (web + mobile), walk-ins, photo grid
8. **Community Feed** — Post creation, media upload, reactions, privacy enforcement
9. **Comp Classes & Coupons** — Gifting flow, coupon CRUD, redemption logic
10. **Notifications** — Push + email infrastructure, reminder scheduling, templates
11. **Web Dashboard Completion** — All remaining pages: plan management, reports, settings, coupon admin
12. **Mobile App Completion** — All screens with real API integration
13. **Multi-Studio Network** — Network creation, cross-booking, discovery
14. **Admin Panel** — Platform management app
15. **Mindbody Migration Tool** — CSV import wizard
16. **Private Bookings** — Request flow, scheduling, payments

---

## Open Questions (for Emma interview)

- Exact pricing tiers she currently offers (monthly amounts, pack sizes)
- How she handles cancellations/no-shows today (penalties? bans?)
- Does she want member-to-member messaging or just feed?
- Private booking flow: does she take deposits? How far in advance?
- Which Wellington studios might join the network?
- Any Mindbody features she'd miss vs. ones she hates?
