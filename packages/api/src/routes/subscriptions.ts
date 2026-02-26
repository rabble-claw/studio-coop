import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createServiceClient } from '../lib/supabase'
import { notFound, forbidden, badRequest } from '../lib/errors'
import { cancelStripeSubscription, pauseStripeSubscription } from '../lib/stripe'
import { getConnectedAccountId } from '../lib/payments'

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

export { subscriptions }
export default subscriptions
