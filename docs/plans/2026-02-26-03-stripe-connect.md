# Stripe Connect Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Stripe Connect Express so each studio has its own payment account, with the platform handling onboarding and webhook processing.

**Architecture:** Stripe SDK in the API layer. Express account onboarding flow creates accounts and returns OAuth links. Webhooks process payment/subscription events and update local DB. Platform takes a configurable application fee.

**Tech Stack:** Stripe SDK (`stripe`), Hono webhooks, Supabase

---

### Task 1: Add Stripe SDK to API package

Add `stripe` package. Create `packages/api/src/lib/stripe.ts` with:
- Stripe client factory (using `STRIPE_SECRET_KEY`)
- Platform fee config (`STRIPE_PLATFORM_FEE_PERCENT`, default 2.5%)
- Helper: `getOrCreateStripeCustomer(userId, email)` — looks up or creates Stripe customer

**Tests:** Verify factory function exports, fee config defaults.

---

### Task 2: Studio onboarding — create Connect account

API endpoint: `POST /api/studios/:studioId/stripe/onboard`

Flow:
1. Verify user is studio owner
2. If studio already has `stripe_account_id`, skip creation
3. Create Stripe Connect Express account with studio metadata
4. Generate account link (onboarding URL)
5. Return URL to frontend

**Tests:** Mock Stripe, verify account creation params, verify owner-only access.

---

### Task 3: Studio onboarding — return URL + refresh

API endpoints:
- `GET /api/studios/:studioId/stripe/status` — check if onboarding complete
- `POST /api/studios/:studioId/stripe/refresh-link` — generate new onboarding link if expired

Check `account.charges_enabled` and `account.details_submitted` to determine status.

**Tests:** Mock Stripe account retrieval, test status states.

---

### Task 4: Stripe dashboard link

API endpoint: `GET /api/studios/:studioId/stripe/dashboard`

Generate a Stripe login link so owners can access their Express dashboard.

**Tests:** Verify owner-only, mock link generation.

---

### Task 5: Webhook endpoint

API endpoint: `POST /api/webhooks/stripe` (no auth — uses Stripe signature verification)

Create `packages/api/src/routes/webhooks.ts`:
1. Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
2. Route by event type to handlers
3. Return 200 immediately, process async

Events to handle:
- `account.updated` — update studio's Stripe status
- `checkout.session.completed` — process successful payment
- `customer.subscription.created` — create local subscription record
- `customer.subscription.updated` — sync status changes
- `customer.subscription.deleted` — mark cancelled
- `invoice.payment_succeeded` — reset `classes_used_this_period` on renewal
- `invoice.payment_failed` — mark subscription `past_due`
- `payment_intent.succeeded` — record payment for class packs / drop-ins

**Tests:** Mock signature verification, test each event handler updates DB correctly.

---

### Task 6: Payment processing helpers

Create `packages/api/src/lib/payments.ts`:
- `createCheckoutSession(studioId, userId, planId, couponCode?)` — creates Stripe Checkout for subscriptions
- `createPaymentIntent(studioId, userId, amountCents, metadata)` — for one-off payments (class packs, drop-ins)
- `processRefund(paymentId, amountCents?)` — partial or full refund
- `calculateApplicationFee(amountCents)` — platform fee calculation

All payment helpers must:
- Use the studio's connected account (`stripe_account_id`)
- Apply `application_fee_amount` for platform revenue
- Record in `payments` table

**Tests:** Mock Stripe API, verify fee calculations, verify DB records created.

---

### Task 7: Environment config

Document required env vars:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_FEE_PERCENT=2.5
```

Create `packages/api/src/lib/config.ts` with validated env config (using Zod):
```typescript
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(2.5),
  WEB_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})
```

**Tests:** Verify validation catches missing required vars.
