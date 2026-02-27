import { Hono } from 'hono'
import { createServiceClient } from '../lib/supabase'
import { constructWebhookEvent } from '../lib/stripe'
import { badRequest } from '../lib/errors'
import { errorHandler } from '../middleware/error-handler'

// Mounted at /api/webhooks
const webhooks = new Hono()
webhooks.onError(errorHandler)

/**
 * POST /stripe — Stripe webhook endpoint.
 *
 * Handles:
 *   checkout.session.completed   → create subscription or class_pass record
 *   payment_intent.succeeded     → create class_pass record for one-time pack purchase
 *   invoice.payment_succeeded    → reset usage counters + update period dates
 *   customer.subscription.deleted → mark subscription cancelled
 *   customer.subscription.updated → sync subscription status
 */
webhooks.post('/stripe', async (c) => {
  const sig = c.req.header('stripe-signature')
  if (!sig) throw badRequest('Missing stripe-signature header')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET')

  // Read raw body for signature verification
  const rawBody = await c.req.text()

  let event: ReturnType<typeof constructWebhookEvent>
  try {
    event = constructWebhookEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid webhook signature'
    throw badRequest(msg)
  }

  const supabase = createServiceClient()

  switch (event.type) {
    // ─── Task 2: Subscription created via Checkout ─────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as {
        id: string
        subscription: string | null
        payment_intent: string | null
        customer: string
        metadata: Record<string, string>
        amount_total: number
        currency: string
      }
      const { userId, studioId, planId, type, couponCode } = session.metadata

      if (type === 'subscription' && session.subscription) {
        // Create subscription record
        await supabase.from('subscriptions').insert({
          user_id: userId,
          studio_id: studioId,
          plan_id: planId,
          stripe_subscription_id: session.subscription,
          stripe_customer_id: session.customer,
          status: 'active',
          classes_used_this_period: 0,
        })

        // Create initial payment record
        await supabase.from('payments').insert({
          user_id: userId,
          studio_id: studioId,
          plan_id: planId,
          amount_cents: session.amount_total ?? 0,
          currency: (session.currency ?? 'usd').toUpperCase(),
          stripe_payment_intent_id: session.payment_intent,
          type: 'subscription',
          status: 'succeeded',
        })

        // Record coupon redemption if one was used
        if (couponCode) {
          await supabase.rpc('increment_coupon_redemptions', { coupon_code: couponCode, studio: studioId })
        }
      }
      break
    }

    // ─── Task 3: Class pack purchased via PaymentIntent ────────────────────
    case 'payment_intent.succeeded': {
      const pi = event.data.object as {
        id: string
        amount: number
        currency: string
        customer: string | null
        metadata: Record<string, string>
      }
      const { userId, studioId, planId, type } = pi.metadata

      if (type === 'class_pack' && planId) {
        // Fetch plan to get class limit and validity
        const { data: plan } = await supabase
          .from('membership_plans')
          .select('class_limit, validity_days')
          .eq('id', planId)
          .single()

        if (plan) {
          const expiresAt = plan.validity_days
            ? new Date(Date.now() + plan.validity_days * 24 * 60 * 60 * 1000).toISOString()
            : null

          await supabase.from('class_passes').insert({
            user_id: userId,
            studio_id: studioId,
            plan_id: planId,
            total_classes: plan.class_limit ?? 1,
            remaining_classes: plan.class_limit ?? 1,
            expires_at: expiresAt,
            stripe_payment_intent_id: pi.id,
          })

          await supabase.from('payments').insert({
            user_id: userId,
            studio_id: studioId,
            plan_id: planId,
            amount_cents: pi.amount,
            currency: pi.currency.toUpperCase(),
            stripe_payment_intent_id: pi.id,
            type: 'class_pack',
            status: 'succeeded',
          })
        }
      } else if (type === 'drop_in') {
        // Drop-in payment handled separately (booking created by the drop-in route)
        await supabase.from('payments').insert({
          user_id: userId,
          studio_id: studioId,
          amount_cents: pi.amount,
          currency: pi.currency.toUpperCase(),
          stripe_payment_intent_id: pi.id,
          type: 'drop_in',
          status: 'succeeded',
        })
      }
      break
    }

    // ─── Task 5: Subscription renewal ─────────────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as {
        subscription: string | null
        amount_paid: number
        currency: string
        customer: string
        lines: { data: Array<{ period: { start: number; end: number } }> }
        metadata: Record<string, string>
      }

      if (!invoice.subscription) break

      // Find subscription record
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, user_id, studio_id, plan_id')
        .eq('stripe_subscription_id', invoice.subscription)
        .single()

      if (!sub) break

      const period = invoice.lines.data[0]?.period
      const updates: Record<string, unknown> = {
        status: 'active',
        classes_used_this_period: 0,
      }
      if (period) {
        updates.current_period_start = new Date(period.start * 1000).toISOString()
        updates.current_period_end = new Date(period.end * 1000).toISOString()
      }

      await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', sub.id)

      // Record renewal payment
      await supabase.from('payments').insert({
        user_id: sub.user_id,
        studio_id: sub.studio_id,
        plan_id: sub.plan_id,
        amount_cents: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        type: 'subscription',
        status: 'succeeded',
      })
      break
    }

    // ─── Task 5: Subscription cancelled ───────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id: string }
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    // ─── Task 5: Subscription status sync ─────────────────────────────────
    case 'customer.subscription.updated': {
      const sub = event.data.object as {
        id: string
        status: string
        cancel_at_period_end: boolean
        current_period_start: number
        current_period_end: number
      }
      await supabase
        .from('subscriptions')
        .update({
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    default:
      // Unhandled event type — acknowledge receipt
      break
  }

  return c.json({ received: true })
})

export { webhooks }
export default webhooks
