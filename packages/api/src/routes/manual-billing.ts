// Manual billing routes — studio-scoped (mounted at /api/studios)
//
// Purpose:
//   - Let admin/owner staff mark members as paid when payments happen outside Stripe.
//   - Keep an auditable ledger for manual payments.
//   - Provide member-level history + studio-level reconciliation views.
//
// Endpoints:
//   GET  /:studioId/members/:memberId/manual-billing
//   POST /:studioId/members/:memberId/manual-billing
//   GET  /:studioId/manual-billing/reconciliation

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'

const manualBilling = new Hono()

const ALLOWED_METHODS = new Set(['cash', 'bank_transfer', 'invoice', 'card_terminal', 'other'])

type ManualPayment = {
  id: string
  studio_id: string
  user_id: string
  plan_id: string
  paid_through_date: string
  amount_cents: number
  currency: string
  payment_method: string
  reference: string | null
  notes: string | null
  marked_by: string
  marked_at: string
  voided_at: string | null
}

function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

function normalizeCurrency(value: unknown, fallback = 'USD'): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toUpperCase()
  if (normalized.length < 3 || normalized.length > 8) return fallback
  return normalized
}

function normalizePaidThroughDate(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('paid_through_date is required (YYYY-MM-DD)')
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw badRequest('paid_through_date must be in YYYY-MM-DD format')
  }
  const parsed = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest('paid_through_date is invalid')
  }
  return trimmed
}

function endOfDayIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999Z`).toISOString()
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function ymdPlusDays(startYmd: string, days: number): string {
  const dt = new Date(`${startYmd}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function daysUntilDue(today: string, due: string): number {
  const start = new Date(`${today}T00:00:00Z`).getTime()
  const end = new Date(`${due}T00:00:00Z`).getTime()
  return Math.floor((end - start) / (1000 * 60 * 60 * 24))
}

async function fetchManualBillingForMember(studioId: string, memberId: string) {
  const supabase = createServiceClient()
  const today = todayYmd()

  const { data: rows, error } = await supabase
    .from('manual_subscription_payments')
    .select('id, studio_id, user_id, plan_id, paid_through_date, amount_cents, currency, payment_method, reference, notes, marked_by, marked_at, voided_at')
    .eq('studio_id', studioId)
    .eq('user_id', memberId)
    .is('voided_at', null)
    .order('marked_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)

  const payments = (rows ?? []) as ManualPayment[]
  if (payments.length === 0) {
    return { today, activeRecord: null, records: [] as Array<Record<string, unknown>> }
  }

  const planIds = Array.from(new Set(payments.map((r) => r.plan_id)))
  const markerIds = Array.from(new Set(payments.map((r) => r.marked_by)))

  const [{ data: plans }, { data: markers }] = await Promise.all([
    supabase
      .from('membership_plans')
      .select('id, name, type, interval, price_cents, currency, active')
      .in('id', planIds),
    supabase
      .from('users')
      .select('id, name, email')
      .in('id', markerIds),
  ])

  const planById = new Map((plans ?? []).map((p) => [p.id, p]))
  const markerById = new Map((markers ?? []).map((u) => [u.id, u]))

  const records = payments.map((row) => ({
    ...row,
    plan: planById.get(row.plan_id) ?? null,
    marker: markerById.get(row.marked_by) ?? null,
    is_expired: row.paid_through_date < today,
  }))

  const activeRecord = records.find((r) => {
    const paidThrough = r.paid_through_date as string
    return paidThrough >= today
  }) ?? null

  return { today, activeRecord, records }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/members/:memberId/manual-billing
// ─────────────────────────────────────────────────────────────────────────────

manualBilling.get('/:studioId/members/:memberId/manual-billing', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status')
    .eq('studio_id', studioId)
    .eq('user_id', memberId)
    .maybeSingle()

  if (!membership) throw notFound('Member')

  const billing = await fetchManualBillingForMember(studioId, memberId)
  return c.json(billing)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/members/:memberId/manual-billing
// Admin/owner marks a member as paid for a plan.
// ─────────────────────────────────────────────────────────────────────────────

manualBilling.post('/:studioId/members/:memberId/manual-billing', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const actor = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const planId = cleanText(body.plan_id, 64)
  const paidThroughDate = normalizePaidThroughDate(body.paid_through_date)
  const paymentMethod = cleanText(body.payment_method, 32)
  const reference = cleanText(body.reference, 120)
  const notes = cleanText(body.notes, 2000)

  if (!planId) throw badRequest('plan_id is required')
  if (!paymentMethod || !ALLOWED_METHODS.has(paymentMethod)) {
    throw badRequest('payment_method must be one of: cash, bank_transfer, invoice, card_terminal, other')
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status')
    .eq('studio_id', studioId)
    .eq('user_id', memberId)
    .maybeSingle()

  if (!membership) throw notFound('Member')
  if (membership.status === 'cancelled') throw badRequest('Cannot mark a cancelled member as paid')

  const { data: plan } = await supabase
    .from('membership_plans')
    .select('id, name, price_cents, currency')
    .eq('id', planId)
    .eq('studio_id', studioId)
    .single()

  if (!plan) throw notFound('Plan')

  const amountCentsRaw = body.amount_cents
  const amountCents = typeof amountCentsRaw === 'number'
    ? Math.max(0, Math.floor(amountCentsRaw))
    : plan.price_cents

  const currency = normalizeCurrency(body.currency, plan.currency ?? 'USD')

  // Keep booking/access behavior aligned by syncing a non-Stripe subscription row.
  // We block this only when there's a currently active Stripe-managed sub.
  const { data: liveSubs, error: liveSubsErr } = await supabase
    .from('subscriptions')
    .select('id, status, stripe_subscription_id, stripe_customer_id')
    .eq('studio_id', studioId)
    .eq('user_id', memberId)
    .in('status', ['active', 'past_due', 'paused'])
    .order('created_at', { ascending: false })

  if (liveSubsErr) throw new Error(liveSubsErr.message)

  const stripeManaged = (liveSubs ?? []).find((s) => Boolean(s.stripe_subscription_id))
  if (stripeManaged) {
    throw badRequest('Member has an active Stripe-managed subscription. Cancel it before switching to manual billing.')
  }

  const nowIso = new Date().toISOString()
  const paidThroughEndIso = endOfDayIso(paidThroughDate)
  const isActiveNow = paidThroughDate >= todayYmd()
  const nextStatus: 'active' | 'past_due' = isActiveNow ? 'active' : 'past_due'

  let syncedSubscription: Record<string, unknown> | null = null
  const targetLiveSub = (liveSubs ?? []).find((s) => !s.stripe_subscription_id) ?? null

  if (targetLiveSub) {
    const { data: updated, error: updateErr } = await supabase
      .from('subscriptions')
      .update({
        plan_id: planId,
        status: nextStatus,
        current_period_start: nowIso,
        current_period_end: paidThroughEndIso,
        classes_used_this_period: 0,
        cancel_at_period_end: false,
        paused_at: null,
        cancelled_at: nextStatus === 'past_due' ? nowIso : null,
      })
      .eq('id', targetLiveSub.id)
      .select('id, status, current_period_start, current_period_end, plan_id, stripe_subscription_id')
      .single()

    if (updateErr) throw new Error(updateErr.message)
    syncedSubscription = updated as Record<string, unknown>
  } else {
    const { data: latestManualSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('studio_id', studioId)
      .eq('user_id', memberId)
      .is('stripe_subscription_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestManualSub) {
      const { data: updated, error: updateErr } = await supabase
        .from('subscriptions')
        .update({
          plan_id: planId,
          status: nextStatus,
          current_period_start: nowIso,
          current_period_end: paidThroughEndIso,
          classes_used_this_period: 0,
          cancel_at_period_end: false,
          paused_at: null,
          cancelled_at: nextStatus === 'past_due' ? nowIso : null,
          stripe_subscription_id: null,
        })
        .eq('id', latestManualSub.id)
        .select('id, status, current_period_start, current_period_end, plan_id, stripe_subscription_id')
        .single()

      if (updateErr) throw new Error(updateErr.message)
      syncedSubscription = updated as Record<string, unknown>
    } else {
      const { data: inserted, error: subInsertErr } = await supabase
        .from('subscriptions')
        .insert({
          user_id: memberId,
          studio_id: studioId,
          plan_id: planId,
          stripe_subscription_id: null,
          stripe_customer_id: null,
          status: nextStatus,
          current_period_start: nowIso,
          current_period_end: paidThroughEndIso,
          classes_used_this_period: 0,
          cancel_at_period_end: false,
        })
        .select('id, status, current_period_start, current_period_end, plan_id, stripe_subscription_id')
        .single()

      if (subInsertErr) throw new Error(subInsertErr.message)
      syncedSubscription = inserted as Record<string, unknown>
    }
  }

  const { error: insertErr } = await supabase
    .from('manual_subscription_payments')
    .insert({
      studio_id: studioId,
      user_id: memberId,
      plan_id: planId,
      paid_through_date: paidThroughDate,
      amount_cents: amountCents,
      currency,
      payment_method: paymentMethod,
      reference,
      notes,
      marked_by: actor.id,
    })

  if (insertErr) throw new Error(insertErr.message)

  const billing = await fetchManualBillingForMember(studioId, memberId)
  return c.json({
    ...billing,
    subscription: syncedSubscription,
  }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/manual-billing/reconciliation
// ─────────────────────────────────────────────────────────────────────────────

manualBilling.get('/:studioId/manual-billing/reconciliation', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()
  const today = todayYmd()
  const dueSoonCutoff = ymdPlusDays(today, 7)

  const { data: rows, error } = await supabase
    .from('manual_subscription_payments')
    .select('id, user_id, plan_id, paid_through_date, amount_cents, currency, payment_method, reference, notes, marked_by, marked_at, voided_at')
    .eq('studio_id', studioId)
    .is('voided_at', null)
    .order('marked_at', { ascending: false })
    .limit(2000)

  if (error) throw new Error(error.message)

  const allRows = (rows ?? []) as Array<ManualPayment>
  if (allRows.length === 0) {
    return c.json({
      as_of: today,
      due_soon_cutoff: dueSoonCutoff,
      totals: { active: 0, due_soon: 0, overdue: 0 },
      active: [],
      due_soon: [],
      overdue: [],
    })
  }

  const latestByUser = new Map<string, ManualPayment>()
  for (const row of allRows) {
    if (!latestByUser.has(row.user_id)) {
      latestByUser.set(row.user_id, row)
    }
  }
  const latest = Array.from(latestByUser.values())

  const userIds = Array.from(new Set(latest.map((r) => r.user_id)))
  const planIds = Array.from(new Set(latest.map((r) => r.plan_id)))
  const markerIds = Array.from(new Set(latest.map((r) => r.marked_by)))

  const [{ data: users }, { data: plans }, { data: markers }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds),
    supabase
      .from('membership_plans')
      .select('id, name, type, interval, price_cents, currency')
      .in('id', planIds),
    supabase
      .from('users')
      .select('id, name, email')
      .in('id', markerIds),
  ])

  const userById = new Map((users ?? []).map((u) => [u.id, u]))
  const planById = new Map((plans ?? []).map((p) => [p.id, p]))
  const markerById = new Map((markers ?? []).map((u) => [u.id, u]))

  const normalized = latest.map((row) => {
    const due = row.paid_through_date
    return {
      ...row,
      member: userById.get(row.user_id) ?? null,
      plan: planById.get(row.plan_id) ?? null,
      marker: markerById.get(row.marked_by) ?? null,
      days_until_due: daysUntilDue(today, due),
    }
  })

  const overdue = normalized
    .filter((row) => row.paid_through_date < today)
    .sort((a, b) => a.paid_through_date.localeCompare(b.paid_through_date))
  const dueSoon = normalized
    .filter((row) => row.paid_through_date >= today && row.paid_through_date <= dueSoonCutoff)
    .sort((a, b) => a.paid_through_date.localeCompare(b.paid_through_date))
  const active = normalized
    .filter((row) => row.paid_through_date > dueSoonCutoff)
    .sort((a, b) => a.paid_through_date.localeCompare(b.paid_through_date))

  return c.json({
    as_of: today,
    due_soon_cutoff: dueSoonCutoff,
    totals: {
      active: active.length,
      due_soon: dueSoon.length,
      overdue: overdue.length,
    },
    active,
    due_soon: dueSoon,
    overdue,
  })
})

export { manualBilling }
export default manualBilling
