# Manual Billing Mode Spec (March 2026)

## Goal

Allow studio admins/owners to mark members as paid for a plan when payment happens off-platform (cash, transfer, invoice), while preserving:

1. Audit trail.
2. Plan-linked access.
3. Auto-expiry at paid-through date.
4. Reconciliation visibility.

## DB Schema

Migration: [023_manual_subscription_payments.sql](/Users/rabble/code/personal/studio-coop/supabase/migrations/023_manual_subscription_payments.sql)

Table: `public.manual_subscription_payments`

Key fields:

1. `studio_id`, `user_id`, `plan_id`
2. `paid_through_date`
3. `amount_cents`, `currency`
4. `payment_method` (`cash|bank_transfer|invoice|card_terminal|other`)
5. `reference`, `notes`
6. `marked_by`, `marked_at`
7. `voided_at`, `voided_by`

RLS:

1. Members can read their own records.
2. Studio staff can read studio records.
3. Studio staff can insert/update records (with `marked_by = auth.uid()` on insert).

## API

Route file: [manual-billing.ts](/Users/rabble/code/personal/studio-coop/packages/api/src/routes/manual-billing.ts)

Mounted under `/api/studios`.

1. `GET /:studioId/members/:memberId/manual-billing`
- Staff view.
- Returns `today`, `activeRecord`, `records`.

2. `POST /:studioId/members/:memberId/manual-billing`
- Admin/owner only.
- Validates plan + member.
- Inserts ledger record in `manual_subscription_payments`.
- Syncs/creates non-Stripe row in `subscriptions` so booking logic works with plan type.
- Blocks switching when there is an active Stripe-managed subscription.
- Returns updated manual billing payload and synced subscription.

3. `GET /:studioId/manual-billing/reconciliation`
- Admin/owner only.
- Returns `active`, `due_soon`, `overdue` lists + totals.

## Access Expiry Rule

File: [credits.ts](/Users/rabble/code/personal/studio-coop/packages/api/src/lib/credits.ts)

When checking subscription credits, if `current_period_end < now`, the subscription is ignored.
This makes manual-paid access stop automatically once the paid-through date passes.

## Web Admin UI Flow

File: [page.tsx](/Users/rabble/code/personal/studio-coop/apps/web/src/app/dashboard/members/[id]/page.tsx)

On member detail page:

1. Staff can view `Manual Billing` card and history.
2. Admin/owner sees `Mark Paid` form:
- Select plan
- Paid-through date
- Amount + currency
- Payment method
- Reference + notes
3. Submit calls `POST /manual-billing`.
4. UI refreshes active manual status + recent records.

## Reconciliation Workflow

Use `GET /:studioId/manual-billing/reconciliation` weekly:

1. Follow up `overdue`.
2. Contact `due_soon` before expiry.
3. Keep `active` stable.
