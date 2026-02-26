# Membership Plans & Subscriptions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable studios to create membership plans and let members purchase subscriptions, class packs, and drop-ins.

**Architecture:** CRUD API for plans (syncs with Stripe Prices). Subscription lifecycle managed via Stripe Checkout + webhooks. Class packs tracked locally with credit deduction on booking.

**Tech Stack:** Hono, Stripe, Supabase, Zod

**Depends on:** Plan 1 (API Layer), Plan 2 (Schema v2), Plan 3 (Stripe Connect)

---

### Task 1: Membership plan CRUD routes

Create `packages/api/src/routes/plans.ts`:

- `GET /api/studios/:studioId/plans` — list active plans (public, no auth needed)
- `POST /api/studios/:studioId/plans` — create plan (owner/admin only)
- `PUT /api/studios/:studioId/plans/:planId` — update plan
- `DELETE /api/studios/:studioId/plans/:planId` — soft delete (set active=false)

On create/update: sync with Stripe by creating/updating a Stripe Price on the studio's connected account. Store `stripe_price_id` on the plan.

Validation via `createMembershipPlanSchema` from shared package.

**Tests:** CRUD operations, role enforcement, Stripe Price sync.

---

### Task 2: Subscribe to a plan

API endpoint: `POST /api/studios/:studioId/plans/:planId/subscribe`

Flow:
1. Validate user is a member of the studio
2. Check no existing active subscription to same studio
3. Check for coupon code (optional) — validate and calculate discount
4. Create Stripe Checkout Session with the plan's `stripe_price_id`
5. Return checkout URL

Stripe webhook (`checkout.session.completed`) then:
1. Creates `subscriptions` record
2. Creates `payments` record
3. If limited plan, sets `classes_used_this_period = 0`

**Tests:** Happy path, duplicate subscription check, coupon application, webhook processing.

---

### Task 3: Purchase class pack

API endpoint: `POST /api/studios/:studioId/plans/:planId/purchase`

Only for plans with `type = 'class_pack'`:
1. Create Stripe PaymentIntent (one-time charge)
2. Return client secret for frontend to complete payment
3. On `payment_intent.succeeded` webhook: create `class_passes` record with `remaining_classes = plan.class_limit`

**Tests:** Pack creation, remaining classes set correctly, expiry date calculated.

---

### Task 4: Drop-in purchase

API endpoint: `POST /api/studios/:studioId/classes/:classId/drop-in`

1. Check class has capacity
2. Create PaymentIntent for drop-in price
3. On success: create booking + payment record

**Tests:** Capacity check, payment flow.

---

### Task 5: Subscription lifecycle management

API endpoints:
- `POST /api/subscriptions/:subscriptionId/cancel` — cancel at period end
- `POST /api/subscriptions/:subscriptionId/pause` — pause (if studio allows)
- `GET /api/studios/:studioId/my-subscription` — get current subscription + usage

Webhook handlers:
- `invoice.payment_succeeded` → reset `classes_used_this_period`, update period dates
- `customer.subscription.deleted` → mark cancelled
- `customer.subscription.updated` → sync status

**Tests:** Cancel flow, pause/resume, usage reset on renewal.

---

### Task 6: Credit check helpers

Create `packages/api/src/lib/credits.ts`:

```typescript
interface CreditCheck {
  hasCredits: boolean
  source: 'subscription_unlimited' | 'subscription_limited' | 'class_pack' | 'comp_class' | 'none'
  sourceId?: string
  remainingAfter?: number
}

async function checkBookingCredits(userId: string, studioId: string): Promise<CreditCheck>
async function deductCredit(creditCheck: CreditCheck): Promise<void>
async function refundCredit(creditCheck: CreditCheck): Promise<void>
```

Priority order for deduction:
1. Comp classes (use free credits first)
2. Subscription (unlimited or limited with remaining)
3. Class packs (oldest first, check expiry)
4. None → needs drop-in purchase

**Tests:** Priority ordering, expiry checking, deduction + refund.

---

### Task 7: Public plan display page

Update `apps/web/src/app/[slug]/page.tsx`:
- Fetch plans from API (or demo data)
- Display pricing cards below the schedule
- "Sign up" button → login → checkout flow

Update demo data with sample plans for Empire Aerial Arts.

**Tests:** Plans render, correct formatting of prices and intervals.
