// Payment helpers — stubs for Plan 3 (Stripe Connect)
// Real implementation lives on the stripe-connect branch.

import { createServiceClient } from './supabase'
import { createStripeClient, calculateApplicationFee, type StripeCustomer } from './stripe'

// Re-export for convenience — tests import these from payments.ts
export { calculateApplicationFee }

/**
 * Get a studio's Stripe connected account ID from the database.
 * Throws if the studio doesn't have a connected Stripe account yet.
 */
export async function getConnectedAccountId(studioId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data: studio, error } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', studioId)
    .single()

  if (error || !studio?.stripe_account_id) {
    throw new Error('Studio does not have a connected Stripe account')
  }
  return studio.stripe_account_id
}

/**
 * Get or create a Stripe Customer for a user/studio pair.
 * Stores stripe_customer_id on the membership record for reuse.
 * Stub: real implementation in stripe-connect branch.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  studioId: string,
  email: string,
): Promise<StripeCustomer> {
  // Check if we already have a customer ID stored
  const supabase = createServiceClient()
  const { data: membership } = await supabase
    .from('memberships')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .eq('studio_id', studioId)
    .single()

  if (membership?.stripe_customer_id) {
    return {
      id: membership.stripe_customer_id,
      object: 'customer',
      email,
      metadata: {},
    }
  }

  // Create customer on the connected account
  const connectedAccountId = await getConnectedAccountId(studioId)
  const stripe = createStripeClient()
  const customer = await stripe.customers.create(
    { email, metadata: { userId, studioId } },
    { stripeAccount: connectedAccountId },
  )

  // Store for reuse
  await supabase
    .from('memberships')
    .update({ stripe_customer_id: customer.id })
    .eq('user_id', userId)
    .eq('studio_id', studioId)

  return {
    id: customer.id,
    object: 'customer',
    email: customer.email ?? email,
    metadata: (customer.metadata ?? {}) as Record<string, string>,
  }
}

/**
 * Create a Stripe Checkout Session for a subscription purchase.
 * Stub: real implementation in stripe-connect branch.
 */
export async function createCheckoutSession(
  studioId: string,
  userId: string,
  planId: string,
): Promise<unknown> {
  const supabase = createServiceClient()
  const [{ data: studio }, { data: plan }] = await Promise.all([
    supabase.from('studios').select('stripe_account_id').eq('id', studioId).single(),
    supabase.from('plans').select('stripe_price_id, price_cents').eq('id', planId).single(),
  ])

  if (!studio?.stripe_account_id) throw new Error('Studio has no Stripe account')

  const stripe = createStripeClient()
  return stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [{ price: plan!.stripe_price_id, quantity: 1 }],
      metadata: { studioId, userId, planId },
    },
    { stripeAccount: studio.stripe_account_id },
  )
}

/**
 * Create a Stripe PaymentIntent for a one-time charge.
 * Stub: real implementation in stripe-connect branch.
 */
export async function createPaymentIntent(
  studioId: string,
  userId: string,
  amountCents: number,
  metadata?: Record<string, string>,
): Promise<unknown> {
  const supabase = createServiceClient()
  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', studioId)
    .single()

  if (!studio?.stripe_account_id) throw new Error('Studio has no Stripe account')

  const stripe = createStripeClient()
  const fee = calculateApplicationFee(amountCents)

  const pi = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'usd',
      application_fee_amount: fee,
      metadata: { studioId, userId, ...metadata },
    },
    { stripeAccount: studio.stripe_account_id },
  )

  await supabase.from('payments').insert({
    studio_id: studioId,
    user_id: userId,
    stripe_payment_intent_id: pi.id,
    amount_cents: amountCents,
    status: 'pending',
    type: metadata?.type ?? 'other',
  })

  return pi
}

/**
 * Process a full or partial refund.
 * Stub: real implementation in stripe-connect branch.
 */
export async function processRefund(
  paymentIntentId: string,
  amountCents?: number,
): Promise<unknown> {
  const supabase = createServiceClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('studio_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()

  if (!payment) throw new Error('Payment not found')

  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', payment.studio_id)
    .single()

  const stripe = createStripeClient()
  const refundParams: Record<string, unknown> = { payment_intent: paymentIntentId }
  if (amountCents) refundParams.amount = amountCents

  const refund = await stripe.refunds.create(
    refundParams as any,
    { stripeAccount: studio!.stripe_account_id },
  )

  const newStatus = amountCents ? 'partially_refunded' : 'refunded'
  await supabase
    .from('payments')
    .update({ status: newStatus })
    .eq('stripe_payment_intent_id', paymentIntentId)

  return refund
}
