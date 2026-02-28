import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createServiceClient } from '../lib/supabase'
import { notFound, forbidden, badRequest } from '../lib/errors'
import { cancelStripeSubscription, pauseStripeSubscription, resumeStripeSubscription, createCheckoutSession } from '../lib/stripe'
import { getConnectedAccountId, getOrCreateStripeCustomer } from '../lib/payments'

// Mounted at /api/subscriptions — handles /:subscriptionId/*
const subscriptions = new Hono()

/**
 * GET /:subscriptionId — fetch a subscription (must own it)
 */
subscriptions.get('/:subscriptionId', authMiddleware, async (c) => {
  const subscriptionId = c.req.param('subscriptionId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*, plan:membership_plans(*)')
    .eq('id', subscriptionId)
    .single()

  if (!sub) throw notFound('Subscription')
  if (sub.user_id !== user.id) throw forbidden()

  return c.json({ subscription: sub })
})

/**
 * POST /:subscriptionId/cancel — cancel at period end
 *
 * Sets cancel_at_period_end=true on Stripe, marks locally as
 * cancel_at_period_end=true (hard cancel happens via webhook when period ends).
 */
subscriptions.post('/:subscriptionId/cancel', authMiddleware, async (c) => {
  const subscriptionId = c.req.param('subscriptionId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, user_id, studio_id, stripe_subscription_id, status')
    .eq('id', subscriptionId)
    .single()

  if (!sub) throw notFound('Subscription')
  if (sub.user_id !== user.id) throw forbidden()
  if (!['active', 'paused'].includes(sub.status)) {
    throw badRequest('Subscription is not active')
  }

  // Cancel on Stripe (best-effort — webhook will confirm)
  if (sub.stripe_subscription_id) {
    try {
      const connectedAccountId = await getConnectedAccountId(sub.studio_id)
      await cancelStripeSubscription(sub.stripe_subscription_id, connectedAccountId)
    } catch {
      // Stripe not configured — fall through and update locally
    }
  }

  const { data: updated, error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('id', subscriptionId)
    .select()
    .single()

  if (error) throw error
  return c.json({ subscription: updated })
})

/**
 * POST /:subscriptionId/pause — pause subscription (if studio allows)
 *
 * Pauses by setting a collection pause on Stripe. Studio must have
 * pause_allowed=true in their settings (or we allow it by default for now).
 */
subscriptions.post('/:subscriptionId/pause', authMiddleware, async (c) => {
  const subscriptionId = c.req.param('subscriptionId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, user_id, studio_id, stripe_subscription_id, status')
    .eq('id', subscriptionId)
    .single()

  if (!sub) throw notFound('Subscription')
  if (sub.user_id !== user.id) throw forbidden()
  if (sub.status !== 'active') throw badRequest('Only active subscriptions can be paused')

  // Check if studio allows pausing
  const { data: studio } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', sub.studio_id)
    .single()

  const allowPause = studio?.settings?.allow_subscription_pause !== false
  if (!allowPause) throw badRequest('This studio does not allow subscription pausing')

  // Pause on Stripe (best-effort)
  if (sub.stripe_subscription_id) {
    try {
      const connectedAccountId = await getConnectedAccountId(sub.studio_id)
      await pauseStripeSubscription(sub.stripe_subscription_id, connectedAccountId)
    } catch {
      // Stripe not configured — fall through
    }
  }

  const { data: updated, error } = await supabase
    .from('subscriptions')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', subscriptionId)
    .select()
    .single()

  if (error) throw error
  return c.json({ subscription: updated })
})

/**
 * POST /:subscriptionId/resume -- resume a paused subscription
 *
 * Resumes collection on Stripe and updates the local status to 'active'.
 */
subscriptions.post('/:subscriptionId/resume', authMiddleware, async (c) => {
  const subscriptionId = c.req.param('subscriptionId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, user_id, studio_id, stripe_subscription_id, status')
    .eq('id', subscriptionId)
    .single()

  if (!sub) throw notFound('Subscription')
  if (sub.user_id !== user.id) throw forbidden()
  if (sub.status !== 'paused') throw badRequest('Only paused subscriptions can be resumed')

  // Resume on Stripe (best-effort)
  if (sub.stripe_subscription_id) {
    try {
      const connectedAccountId = await getConnectedAccountId(sub.studio_id)
      await resumeStripeSubscription(sub.stripe_subscription_id, connectedAccountId)
    } catch {
      // Stripe not configured -- fall through and update locally
    }
  }

  const { data: updated, error } = await supabase
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('id', subscriptionId)
    .select()
    .single()

  if (error) throw error
  return c.json({ subscription: updated })
})

/**
 * POST /:subscriptionId/reactivate — reactivate a cancelled subscription
 *
 * Unlike 'resume' (for paused subs), this creates a new Stripe Checkout
 * session for the same plan and updates the local subscription status.
 */
subscriptions.post('/:subscriptionId/reactivate', authMiddleware, async (c) => {
  const subscriptionId = c.req.param('subscriptionId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, user_id, studio_id, stripe_subscription_id, status, plan_id')
    .eq('id', subscriptionId)
    .single()

  if (!sub) throw notFound('Subscription')
  if (sub.user_id !== user.id) throw forbidden()
  if (sub.status !== 'cancelled') {
    throw badRequest('Only cancelled subscriptions can be reactivated. Use resume for paused subscriptions.')
  }

  // Look up the plan to get the Stripe price
  const { data: plan } = await supabase
    .from('membership_plans')
    .select('id, stripe_price_id, name')
    .eq('id', sub.plan_id)
    .single()

  if (!plan?.stripe_price_id) {
    throw badRequest('Plan does not have a Stripe price configured. Please contact the studio.')
  }

  // Create a new checkout session for re-subscription
  const connectedAccountId = await getConnectedAccountId(sub.studio_id)
  const customer = await getOrCreateStripeCustomer(user.id, sub.studio_id, user.email)

  const webUrl = process.env.WEB_URL ?? 'https://studio.coop'
  const session = await createCheckoutSession({
    priceId: plan.stripe_price_id,
    customerId: customer.id,
    successUrl: `${webUrl}/dashboard?reactivated=true`,
    cancelUrl: `${webUrl}/dashboard/plans`,
    connectedAccountId,
    metadata: {
      userId: user.id,
      studioId: sub.studio_id,
      subscriptionId: sub.id,
      type: 'reactivation',
    },
  })

  return c.json({
    checkoutUrl: session.url,
    subscriptionId: sub.id,
    message: 'Complete checkout to reactivate your subscription.',
  })
})

export { subscriptions }
export default subscriptions
