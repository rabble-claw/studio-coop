# Comp Classes & Coupons — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let studios gift free classes to members and create discount codes for promotions.

**Architecture:** Comp classes are credit grants checked during booking (priority 1 in credit system). Coupons are validated at checkout time and applied to Stripe payments.

**Tech Stack:** Hono, Stripe (coupon application), Supabase

**Depends on:** Plan 1, 2, 4 (credit system), 5 (booking)

---

### Task 1: Comp class API

Create `packages/api/src/routes/comps.ts`:

- `POST /api/studios/:studioId/members/:userId/comp` — grant comp classes (staff only)
  Body: `{ classes: number, reason: string, expiresAt?: string }`
  Creates `comp_classes` record.

- `GET /api/studios/:studioId/comps` — list all comp grants (staff only)
  Includes: member name, granted by, reason, remaining/total, expiry

- `GET /api/my/comps` — member sees their comp credits
  Includes: remaining classes, expiry dates, which studio

- `DELETE /api/studios/:studioId/comps/:compId` — revoke (staff only, sets remaining to 0)

Integration with credit system: `checkBookingCredits` already checks comp_classes first (Plan 4, Task 6). On booking, `deductCredit` decrements `remaining_classes`.

**Tests:** Grant flow, deduction on booking, expiry enforcement, revocation.

---

### Task 2: Coupon CRUD

Create `packages/api/src/routes/coupons.ts`:

- `POST /api/studios/:studioId/coupons` — create coupon (admin/owner only)
  Validates: code uniqueness (per studio), value ranges, date logic
- `GET /api/studios/:studioId/coupons` — list all coupons (staff)
- `PUT /api/studios/:studioId/coupons/:couponId` — update
- `DELETE /api/studios/:studioId/coupons/:couponId` — deactivate

**Tests:** CRUD, code uniqueness, validation of value constraints.

---

### Task 3: Coupon validation

`POST /api/studios/:studioId/coupons/validate`
Body: `{ code: string, planId?: string }`

Returns: `{ valid: boolean, discount: { type, value, description }, reason?: string }`

Validation checks:
- Code exists and is active
- Within valid_from / valid_until window
- Under max_redemptions
- Applies to the given plan type (if `applies_to = 'plan'`, check plan_ids)
- `new_member` check: user has no prior subscription/purchase at this studio

**Tests:** All validation scenarios — expired, maxed out, wrong plan type, not new member.

---

### Task 4: Coupon redemption

Integrate into checkout flows (Plan 4):
- When creating Stripe Checkout Session, apply coupon discount:
  - `percent_off` → Stripe Coupon with percentage
  - `amount_off` → reduce amount directly
  - `free_classes` → add to comp_classes instead of Stripe discount
- Record in `coupon_redemptions` table
- Increment `current_redemptions` on coupon

**Tests:** Stripe discount application, redemption recording, counter increment.

---

### Task 5: Web UI — comp & coupon management

Add to dashboard:
- `apps/web/src/app/dashboard/members/[id]/page.tsx` — member detail with "Grant Comp Classes" button
- `apps/web/src/app/dashboard/coupons/page.tsx` — coupon list + create form
- Coupon card: code, discount description, redemptions count, status, dates

---

### Task 6: Member-facing coupon input

- Checkout flow: "Have a coupon code?" expandable field
- Validates in real-time via the validate endpoint
- Shows discount preview before payment
- Mobile: same flow in the subscription/pack purchase screens
