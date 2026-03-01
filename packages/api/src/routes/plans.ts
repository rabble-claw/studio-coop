import { Hono } from 'hono'
import { createMembershipPlanSchema } from '@studio-coop/shared'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, requireMember, requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest, conflict } from '../lib/errors'
import {
  createStripePrice,
  archiveStripePrice,
  createCheckoutSession,
  createPaymentIntent,
} from '../lib/stripe'
import { getOrCreateStripeCustomer, getConnectedAccountId } from '../lib/payments'

// Mounted at /api/studios — handles /:studioId/plans/* and related
const plans = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 1: Plan CRUD
// ─────────────────────────────────────────────────────────────────────────────

/** GET /:studioId/plans — public, no auth required */
plans.get('/:studioId/plans', async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('studio_id', studioId)
    .eq('active', true)
    .order('sort_order')

  if (error) throw error
  return c.json({ plans: data ?? [] })
})

/** POST /:studioId/plans — owner/admin only */
plans.post('/:studioId/plans', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const body = await c.req.json()

  const result = createMembershipPlanSchema.safeParse(body)
  if (!result.success) {
    throw badRequest('Invalid plan data', result.error.flatten())
  }
  const data = result.data
  const supabase = createServiceClient()

  // Sync with Stripe for recurring plans (best-effort)
  let stripePriceId = data.stripePriceId ?? null
  if (!stripePriceId && data.priceCents > 0 && data.interval !== 'once') {
    try {
      const connectedAccountId = await getConnectedAccountId(studioId)
      const price = await createStripePrice({
        name: data.name,
        unitAmount: data.priceCents,
        currency: data.currency,
        interval: data.interval as 'month' | 'year',
        connectedAccountId,
      })
      stripePriceId = price.id
    } catch {
      // Stripe not configured yet — continue without price ID
    }
  }

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .insert({
      studio_id: studioId,
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      price_cents: data.priceCents,
      currency: data.currency,
      interval: data.interval,
      class_limit: data.classLimit ?? null,
      validity_days: data.validityDays ?? null,
      stripe_price_id: stripePriceId,
      active: data.active,
      sort_order: data.sortOrder,
    })
    .select()
    .single()

  if (error) throw error
  return c.json({ plan }, 201)
})

/** PUT /:studioId/plans/:planId — owner/admin only */
plans.put('/:studioId/plans/:planId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const planId = c.req.param('planId')
  const body = await c.req.json()

  const result = createMembershipPlanSchema.partial().safeParse(body)
  if (!result.success) {
    throw badRequest('Invalid plan data', result.error.flatten())
  }
  const data = result.data
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Plan')

  // If price or interval changed and plan has a Stripe price, archive old + create new
  const priceChanged =
    (data.priceCents !== undefined && data.priceCents !== existing.price_cents) ||
    (data.interval !== undefined && data.interval !== existing.interval)

  let stripePriceId: string | null = existing.stripe_price_id ?? null
  if (priceChanged && existing.stripe_price_id) {
    try {
      const connectedAccountId = await getConnectedAccountId(studioId)
      await archiveStripePrice(existing.stripe_price_id, connectedAccountId)
      const newPrice = await createStripePrice({
        name: data.name ?? existing.name,
        unitAmount: data.priceCents ?? existing.price_cents,
        currency: data.currency ?? existing.currency,
        interval: (data.interval ?? existing.interval) as 'month' | 'year',
        connectedAccountId,
      })
      stripePriceId = newPrice.id
    } catch {
      // Stripe not configured — proceed without updating price ID
    }
  }

  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.description !== undefined) updates.description = data.description
  if (data.type !== undefined) updates.type = data.type
  if (data.priceCents !== undefined) updates.price_cents = data.priceCents
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.interval !== undefined) updates.interval = data.interval
  if (data.classLimit !== undefined) updates.class_limit = data.classLimit
  if (data.validityDays !== undefined) updates.validity_days = data.validityDays
  if (data.active !== undefined) updates.active = data.active
  if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder
  if (stripePriceId !== (existing.stripe_price_id ?? null)) {
    updates.stripe_price_id = stripePriceId
  }

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .update(updates)
    .eq('id', planId)
    .eq('studio_id', studioId)
    .select()
    .single()

  if (error) throw error
  return c.json({ plan })
})

/** DELETE /:studioId/plans/:planId — soft delete, owner/admin only */
plans.delete('/:studioId/plans/:planId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const planId = c.req.param('planId')
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('membership_plans')
    .select('id, stripe_price_id')
    .eq('id', planId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Plan')

  // Archive the Stripe price if one exists (best-effort)
  if (existing.stripe_price_id) {
    try {
      const connectedAccountId = await getConnectedAccountId(studioId)
      await archiveStripePrice(existing.stripe_price_id, connectedAccountId)
    } catch {
      // Stripe not configured — proceed
    }
  }

  const { error } = await supabase
    .from('membership_plans')
    .update({ active: false })
    .eq('id', planId)
    .eq('studio_id', studioId)

  if (error) throw error
  return c.json({ success: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Subscribe to a plan
// ─────────────────────────────────────────────────────────────────────────────

/** POST /:studioId/plans/:planId/subscribe — member only */
plans.post('/:studioId/plans/:planId/subscribe', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const planId = c.req.param('planId')
  const user = c.get('user' as never) as { id: string; email: string }
  const body = await c.req.json().catch(() => ({}))

  const couponCode: string | undefined = body.couponCode
  const successUrl: string = body.successUrl ?? `${process.env.WEB_URL ?? ''}/dashboard`
  const cancelUrl: string = body.cancelUrl ?? `${process.env.WEB_URL ?? ''}/`

  const supabase = createServiceClient()

  // Fetch plan
  const { data: plan } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('studio_id', studioId)
    .eq('active', true)
    .single()

  if (!plan) throw notFound('Plan')
  if (!plan.stripe_price_id) throw badRequest('Plan is not yet configured for payment')

  // Check for existing active subscription in this studio
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .maybeSingle()

  if (existingSub) throw conflict('You already have an active subscription to this studio')

  // Validate coupon if provided
  let stripeCouponId: string | undefined
  if (couponCode) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('studio_id', studioId)
      .eq('code', couponCode.toUpperCase())
      .eq('active', true)
      .maybeSingle()

    if (!coupon) throw badRequest('Invalid or expired coupon code')

    const now = new Date()
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      throw badRequest('Coupon is not yet valid')
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      throw badRequest('Coupon has expired')
    }
    if (
      coupon.max_redemptions !== null &&
      coupon.current_redemptions >= coupon.max_redemptions
    ) {
      throw badRequest('Coupon has reached its maximum redemptions')
    }

    // Handle free_classes coupon: grant comp classes instead of Stripe discount
    if (coupon.type === 'free_classes' && coupon.free_classes) {
      await supabase.from('comp_classes').insert({
        user_id: user.id,
        studio_id: studioId,
        total_classes: coupon.free_classes,
        remaining_classes: coupon.free_classes,
        reason: `Coupon ${couponCode!.toUpperCase()}`,
      })

      // Increment redemption counter
      await supabase
        .from('coupons')
        .update({ current_redemptions: coupon.current_redemptions + 1 })
        .eq('id', coupon.id)
    } else if (coupon.stripe_coupon_id) {
      // For percent_off / amount_off coupons, pass Stripe coupon ID to checkout
      stripeCouponId = coupon.stripe_coupon_id
    }
  }

  // Create Stripe Checkout Session
  const connectedAccountId = await getConnectedAccountId(studioId)
  const customer = await getOrCreateStripeCustomer(user.id, studioId, user.email)

  const session = await createCheckoutSession({
    priceId: plan.stripe_price_id,
    customerId: customer.id,
    successUrl,
    cancelUrl,
    connectedAccountId,
    couponId: stripeCouponId,
    metadata: {
      userId: user.id,
      studioId,
      planId,
      type: 'subscription',
      couponCode: couponCode ?? '',
    },
  })

  return c.json({ checkoutUrl: session.url })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 3: Purchase class pack
// ─────────────────────────────────────────────────────────────────────────────

/** POST /:studioId/plans/:planId/purchase — class pack, member only */
plans.post('/:studioId/plans/:planId/purchase', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const planId = c.req.param('planId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: plan } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .eq('studio_id', studioId)
    .eq('active', true)
    .single()

  if (!plan) throw notFound('Plan')
  if (plan.type !== 'class_pack') throw badRequest('This plan is not a class pack')

  const connectedAccountId = await getConnectedAccountId(studioId)
  const customer = await getOrCreateStripeCustomer(user.id, studioId, user.email)

  const paymentIntent = await createPaymentIntent({
    amount: plan.price_cents,
    currency: plan.currency,
    customerId: customer.id,
    connectedAccountId,
    metadata: {
      userId: user.id,
      studioId,
      planId,
      type: 'class_pack',
    },
  })

  return c.json({ clientSecret: paymentIntent.client_secret })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 5 (partial): Get current subscription for a studio
// ─────────────────────────────────────────────────────────────────────────────

/** GET /:studioId/my-subscription — member only */
plans.get('/:studioId/my-subscription', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, plan:membership_plans(*)')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Class passes
  const { data: passes } = await supabase
    .from('class_passes')
    .select('*')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .gt('remaining_classes', 0)
    .order('expires_at', { ascending: true })

  return c.json({
    subscription: subscription ?? null,
    classPasses: passes ?? [],
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task A9: Staff view of plan subscribers
// ─────────────────────────────────────────────────────────────────────────────

/** GET /:studioId/plans/:planId/subscribers — staff view of plan subscribers */
plans.get('/:studioId/plans/:planId/subscribers', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const planId = c.req.param('planId')
  const supabase = createServiceClient()

  // Verify plan belongs to studio
  const { data: plan } = await supabase
    .from('membership_plans')
    .select('id, name')
    .eq('id', planId)
    .eq('studio_id', studioId)
    .single()

  if (!plan) throw notFound('Plan')

  const { data: subscribers, error } = await supabase
    .from('subscriptions')
    .select(`
      id, status, current_period_start, current_period_end,
      classes_used_this_period, created_at, cancelled_at,
      member:users!subscriptions_user_id_fkey(id, name, email, avatar_url)
    `)
    .eq('plan_id', planId)
    .eq('studio_id', studioId)
    .in('status', ['active', 'past_due', 'paused'])
    .order('created_at', { ascending: false })

  if (error) throw error

  return c.json({ plan, subscribers: subscribers ?? [] })
})

export { plans }
export default plans
