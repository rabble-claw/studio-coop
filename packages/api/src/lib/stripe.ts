// Stripe client, type definitions, and platform-level helpers for Stripe Connect.
// Provides checkout sessions, payment intents, subscription management, and webhook verification.
// Connected-account operations (customer management per studio) live in ./payments.ts.

import Stripe from 'stripe'

/** Platform fee percentage (configurable via env). */
export const platformFeePercent = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 2.5)

/** Get platform fee percentage (function form for mocking in tests). */
export function getPlatformFeePercent(): number {
  return platformFeePercent
}

/** Create a Stripe client instance. Throws if STRIPE_SECRET_KEY is not set. */
export function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  return new Stripe(key)
}

/** Calculate platform application fee in cents. */
export function calculateApplicationFee(amountCents: number): number {
  return Math.round(amountCents * platformFeePercent / 100)
}

export interface StripePrice {
  id: string
  object: 'price'
  active: boolean
  currency: string
  unit_amount: number | null
  recurring: { interval: 'month' | 'year' } | null
  product: string
}

export interface StripeCheckoutSession {
  id: string
  object: 'checkout.session'
  url: string | null
  payment_intent: string | null
  subscription: string | null
  customer: string | null
  metadata: Record<string, string>
}

export interface StripePaymentIntent {
  id: string
  object: 'payment_intent'
  client_secret: string | null
  amount: number
  currency: string
  status: string
  customer: string | null
  metadata: Record<string, string>
}

export interface StripeCustomer {
  id: string
  object: 'customer'
  email: string | null
  metadata: Record<string, string>
}

export interface StripeSubscription {
  id: string
  object: 'subscription'
  status: string
  current_period_start: number
  current_period_end: number
  customer: string
  cancel_at_period_end: boolean
  items: {
    data: Array<{
      price: { id: string }
    }>
  }
  metadata: Record<string, string>
}

export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

export interface StripeInvoice {
  id: string
  object: 'invoice'
  subscription: string | null
  customer: string
  amount_paid: number
  currency: string
  lines: {
    data: Array<{
      period: { start: number; end: number }
    }>
  }
  metadata: Record<string, string>
}

/** Create a Stripe Price on a connected account. */
export async function createStripePrice(params: {
  name: string
  unitAmount: number
  currency: string
  interval?: 'month' | 'year'
  connectedAccountId: string
}): Promise<StripePrice> {
  const stripe = createStripeClient()
  const opts = { stripeAccount: params.connectedAccountId }

  const product = await stripe.products.create({ name: params.name }, opts)

  const priceParams: Record<string, unknown> = {
    product: product.id,
    unit_amount: params.unitAmount,
    currency: params.currency,
  }
  if (params.interval) {
    priceParams.recurring = { interval: params.interval }
  }

  const price = await stripe.prices.create(priceParams as any, opts)
  return price as unknown as StripePrice
}

/** Archive (deactivate) a Stripe Price on a connected account. */
export async function archiveStripePrice(
  priceId: string,
  connectedAccountId: string,
): Promise<void> {
  const stripe = createStripeClient()
  await stripe.prices.update(priceId, { active: false }, { stripeAccount: connectedAccountId })
}

/** Create a Stripe Checkout Session for a subscription. */
export async function createCheckoutSession(params: {
  priceId: string
  customerId: string
  successUrl: string
  cancelUrl: string
  connectedAccountId: string
  couponId?: string
  metadata?: Record<string, string>
}): Promise<StripeCheckoutSession> {
  const stripe = createStripeClient()
  const sessionParams: Record<string, unknown> = {
    mode: 'subscription',
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata ?? {},
    subscription_data: {
      application_fee_percent: getPlatformFeePercent(),
    },
  }

  if (params.couponId) {
    sessionParams.discounts = [{ coupon: params.couponId }]
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as any,
    { stripeAccount: params.connectedAccountId },
  )
  return session as unknown as StripeCheckoutSession
}

/** Create a Stripe PaymentIntent for a one-time charge. */
export async function createPaymentIntent(params: {
  amount: number
  currency: string
  customerId: string
  connectedAccountId: string
  metadata?: Record<string, string>
}): Promise<StripePaymentIntent> {
  const stripe = createStripeClient()
  const fee = calculateApplicationFee(params.amount)

  const pi = await stripe.paymentIntents.create(
    {
      amount: params.amount,
      currency: params.currency,
      customer: params.customerId,
      application_fee_amount: fee,
      metadata: params.metadata ?? {},
    },
    { stripeAccount: params.connectedAccountId },
  )
  return pi as unknown as StripePaymentIntent
}

/** Cancel a Stripe Subscription at period end. */
export async function cancelStripeSubscription(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<StripeSubscription> {
  const stripe = createStripeClient()
  const sub = await stripe.subscriptions.update(
    subscriptionId,
    { cancel_at_period_end: true },
    { stripeAccount: connectedAccountId },
  )
  return sub as unknown as StripeSubscription
}

/** Pause a Stripe Subscription by setting a trial end far in the future. */
export async function pauseStripeSubscription(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<StripeSubscription> {
  const stripe = createStripeClient()
  // Set trial_end to ~2 years from now to effectively pause billing
  const twoYearsFromNow = Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 60 * 60
  const sub = await stripe.subscriptions.update(
    subscriptionId,
    { trial_end: twoYearsFromNow },
    { stripeAccount: connectedAccountId },
  )
  return sub as unknown as StripeSubscription
}

/** Resume a paused Stripe Subscription. */
export async function resumeStripeSubscription(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<StripeSubscription> {
  const stripe = createStripeClient()
  const sub = await stripe.subscriptions.update(
    subscriptionId,
    { trial_end: 'now' as any },
    { stripeAccount: connectedAccountId },
  )
  return sub as unknown as StripeSubscription
}

/**
 * Verify and parse an incoming Stripe webhook event.
 * Throws if the signature is invalid.
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  sig: string,
  secret: string,
): StripeWebhookEvent {
  const stripe = createStripeClient()
  const event = stripe.webhooks.constructEvent(payload, sig, secret)
  return event as unknown as StripeWebhookEvent
}
