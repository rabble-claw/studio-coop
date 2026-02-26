import type Stripe from 'stripe'
import { createStripeClient, getPlatformFeePercent } from './stripe'
import { createServiceClient } from './supabase'

/**
 * Calculate the platform application fee for a given amount.
 */
export function calculateApplicationFee(amountCents: number): number {
  return Math.round(amountCents * (getPlatformFeePercent() / 100))
}

/**
 * Create a Stripe Checkout Session for a subscription plan.
 * Uses the studio's connected account and applies the platform application fee.
 */
export async function createCheckoutSession(
  studioId: string,
  userId: string,
  planId: string,
  couponCode?: string
): Promise<Stripe.Checkout.Session> {
  const supabase = createServiceClient()
  const stripe = createStripeClient()

  const [{ data: studio }, { data: plan }] = await Promise.all([
    supabase.from('studios').select('stripe_account_id').eq('id', studioId).single(),
    supabase.from('plans').select('stripe_price_id, price_cents').eq('id', planId).single(),
  ])

  if (!studio?.stripe_account_id) {
    throw new Error('Studio has no Stripe account')
  }
  if (!plan) {
    throw new Error('Plan not found')
  }

  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
  const feePercent = getPlatformFeePercent()

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    metadata: { studioId, userId, planId },
    success_url: `${webUrl}/studios/${studioId}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${webUrl}/studios/${studioId}/plans`,
    subscription_data: {
      metadata: { studioId, userId, planId },
      application_fee_percent: feePercent,
    },
  }

  if (couponCode) {
    sessionParams.discounts = [{ coupon: couponCode }]
  }

  return stripe.checkout.sessions.create(sessionParams, {
    stripeAccount: studio.stripe_account_id,
  })
}

/**
 * Create a PaymentIntent for one-off payments (class packs, drop-ins).
 * Uses the studio's connected account, applies platform application fee,
 * and records the pending payment in the DB.
 */
export async function createPaymentIntent(
  studioId: string,
  userId: string,
  amountCents: number,
  metadata: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  const supabase = createServiceClient()
  const stripe = createStripeClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', studioId)
    .single()

  if (!studio?.stripe_account_id) {
    throw new Error('Studio has no Stripe account')
  }

  const applicationFeeAmount = calculateApplicationFee(amountCents)

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: 'usd',
      application_fee_amount: applicationFeeAmount,
      metadata: { studioId, userId, ...metadata },
    },
    { stripeAccount: studio.stripe_account_id }
  )

  await supabase.from('payments').insert({
    stripe_payment_intent_id: paymentIntent.id,
    amount_cents: amountCents,
    currency: 'usd',
    status: 'pending',
    user_id: userId,
    studio_id: studioId,
    metadata: { studioId, userId, ...metadata },
  })

  return paymentIntent
}

/**
 * Issue a partial or full refund for a payment.
 * Looks up the studio's connected account to route the refund correctly.
 */
export async function processRefund(
  paymentIntentId: string,
  amountCents?: number
): Promise<Stripe.Refund> {
  const supabase = createServiceClient()
  const stripe = createStripeClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('studio_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()

  if (!payment) {
    throw new Error('Payment not found')
  }

  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', payment.studio_id)
    .single()

  const refundParams: Stripe.RefundCreateParams = { payment_intent: paymentIntentId }
  if (amountCents !== undefined) {
    refundParams.amount = amountCents
  }

  const requestOptions: Stripe.RequestOptions = {}
  if (studio?.stripe_account_id) {
    requestOptions.stripeAccount = studio.stripe_account_id
  }

  const refund = await stripe.refunds.create(refundParams, requestOptions)

  const newStatus = amountCents !== undefined ? 'partially_refunded' : 'refunded'
  await supabase
    .from('payments')
    .update({ status: newStatus })
    .eq('stripe_payment_intent_id', paymentIntentId)

  return refund
}
