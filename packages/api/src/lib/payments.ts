// Payment helpers — stubs for Plan 3 (Stripe Connect)
// Real implementation lives on the stripe-connect branch.

import { createServiceClient } from './supabase'
import type { StripeCustomer } from './stripe'

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
    // Return a minimal stub; real impl would fetch from Stripe
    return {
      id: membership.stripe_customer_id,
      object: 'customer',
      email,
      metadata: {},
    }
  }

  // Stub: real implementation would create via Stripe API
  throw new Error('Stripe not configured — stub (merge stripe-connect branch)')
}
