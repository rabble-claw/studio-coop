import Stripe from 'stripe'
import { createServiceClient } from './supabase'

export function getPlatformFeePercent(): number {
  return parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '2.5')
}

/** Convenience export — reads env at call time */
export const platformFeePercent = getPlatformFeePercent()

/**
 * Create a Stripe client using the secret key from env.
 */
export function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }
  return new Stripe(key)
}

/**
 * Look up or create a Stripe customer for a given user.
 * Persists the customer ID in the profiles table.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  const stripe = createStripeClient()
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  })

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  return customer.id
}
