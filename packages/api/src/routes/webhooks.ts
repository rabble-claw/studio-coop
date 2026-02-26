import { Hono } from 'hono'
import type Stripe from 'stripe'
import { createStripeClient } from '../lib/stripe'
import { createServiceClient } from '../lib/supabase'

const webhookRoutes = new Hono()

/**
 * POST /api/webhooks/stripe
 * No auth — verified via Stripe-Signature header.
 * Returns 200 immediately; event handling runs asynchronously.
 */
webhookRoutes.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400)
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return c.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, 500)
  }

  const body = await c.req.text()
  const stripe = createStripeClient()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    return c.json({ error: message }, 400)
  }

  // Return 200 immediately; process event in the background
  handleEvent(event).catch((err) =>
    console.error('[webhook] Error handling event:', event.type, err)
  )

  return c.json({ received: true })
})

async function handleEvent(event: Stripe.Event): Promise<void> {
  const supabase = createServiceClient()

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const studioId = account.metadata?.studioId
      if (studioId) {
        await supabase
          .from('studios')
          .update({
            stripe_charges_enabled: account.charges_enabled,
            stripe_details_submitted: account.details_submitted,
          })
          .eq('stripe_account_id', account.id)
      }
      break
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_status === 'paid') {
        await supabase.from('payments').insert({
          stripe_payment_intent_id: session.payment_intent as string,
          stripe_session_id: session.id,
          amount_cents: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          status: 'succeeded',
          user_id: session.metadata?.userId,
          studio_id: session.metadata?.studioId,
          metadata: session.metadata,
        })
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('subscriptions').upsert(
        {
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer as string,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          plan_id: sub.metadata?.planId,
          user_id: sub.metadata?.userId,
          studio_id: sub.metadata?.studioId,
        },
        { onConflict: 'stripe_subscription_id' }
      )
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        await supabase
          .from('subscriptions')
          .update({ classes_used_this_period: 0 })
          .eq('stripe_subscription_id', invoice.subscription as string)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription as string)
      }
      break
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      await supabase.from('payments').upsert(
        {
          stripe_payment_intent_id: pi.id,
          amount_cents: pi.amount,
          currency: pi.currency,
          status: 'succeeded',
          user_id: pi.metadata?.userId,
          studio_id: pi.metadata?.studioId,
          metadata: pi.metadata,
        },
        { onConflict: 'stripe_payment_intent_id' }
      )
      break
    }

    default:
      // Unhandled event type — no action needed
      break
  }
}

export { webhookRoutes, handleEvent }
