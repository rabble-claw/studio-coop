// Stripe client and helpers — stubs for Plan 3 (Stripe Connect)
// Real implementation lives on the stripe-connect branch.
// These interfaces match the Stripe SDK types we'll rely on once merged.

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
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
}

/** Archive (deactivate) a Stripe Price on a connected account. */
export async function archiveStripePrice(
  priceId: string,
  connectedAccountId: string,
): Promise<void> {
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
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
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
}

/** Create a Stripe PaymentIntent for a one-time charge. */
export async function createPaymentIntent(params: {
  amount: number
  currency: string
  customerId: string
  connectedAccountId: string
  metadata?: Record<string, string>
}): Promise<StripePaymentIntent> {
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
}

/** Cancel a Stripe Subscription at period end. */
export async function cancelStripeSubscription(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<StripeSubscription> {
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
}

/** Pause a Stripe Subscription by setting a trial end far in the future. */
export async function pauseStripeSubscription(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<StripeSubscription> {
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
}

/** Resume a paused Stripe Subscription. */
export async function resumeStripeSubscription(
  subscriptionId: string,
  connectedAccountId: string,
): Promise<StripeSubscription> {
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
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
  // Stub: real implementation in stripe-connect branch
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
}
