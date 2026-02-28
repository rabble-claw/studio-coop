// Payment helpers for Stripe Connect (connected-account operations).
// Manages per-studio Stripe customer creation and connected account lookups.
// Platform-level Stripe helpers (checkout, payment intents, subscriptions) live in ./stripe.ts.

import { createServiceClient } from './supabase'
import { createStripeClient, calculateApplicationFee, type StripeCustomer } from './stripe'

// Re-export for convenience
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
 * Get or create a Stripe Customer for a user/studio pair on the connected account.
 * Stores stripe_customer_id on the membership record for reuse.
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
