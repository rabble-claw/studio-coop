import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireOwner, type StudioEnv } from '../middleware/studio-access'
import { createStripeClient } from '../lib/stripe'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'

const stripeRoutes = new Hono<StudioEnv>()

// All studio Stripe routes require auth + owner role
stripeRoutes.use('/:studioId/stripe/*', authMiddleware, requireOwner)

/**
 * POST /api/studios/:studioId/stripe/onboard
 * Creates a Stripe Connect Express account (if needed) and returns an onboarding URL.
 */
stripeRoutes.post('/:studioId/stripe/onboard', async (c) => {
  const studioId = c.get('studioId')
  const supabase = createServiceClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('id, stripe_account_id')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  let stripeAccountId: string = studio.stripe_account_id
  const stripe = createStripeClient()

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { studioId },
    })
    stripeAccountId = account.id

    await supabase
      .from('studios')
      .update({ stripe_account_id: stripeAccountId })
      .eq('id', studioId)
  }

  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${webUrl}/studios/${studioId}/stripe/refresh`,
    return_url: `${webUrl}/studios/${studioId}/stripe/complete`,
    type: 'account_onboarding',
  })

  return c.json({ url: accountLink.url })
})

/**
 * GET /api/studios/:studioId/stripe/status
 * Returns whether onboarding is complete (charges_enabled + details_submitted).
 */
stripeRoutes.get('/:studioId/stripe/status', async (c) => {
  const studioId = c.get('studioId')
  const supabase = createServiceClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  if (!studio.stripe_account_id) {
    return c.json({ connected: false, chargesEnabled: false, detailsSubmitted: false })
  }

  const stripe = createStripeClient()
  const account = await stripe.accounts.retrieve(studio.stripe_account_id)

  return c.json({
    connected: true,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    accountId: account.id,
  })
})

/**
 * POST /api/studios/:studioId/stripe/refresh-link
 * Generates a fresh onboarding link for an existing (but incomplete) Connect account.
 */
stripeRoutes.post('/:studioId/stripe/refresh-link', async (c) => {
  const studioId = c.get('studioId')
  const supabase = createServiceClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')
  if (!studio.stripe_account_id) {
    throw badRequest('Studio has no Stripe account — start onboarding first')
  }

  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
  const stripe = createStripeClient()
  const accountLink = await stripe.accountLinks.create({
    account: studio.stripe_account_id,
    refresh_url: `${webUrl}/studios/${studioId}/stripe/refresh`,
    return_url: `${webUrl}/studios/${studioId}/stripe/complete`,
    type: 'account_onboarding',
  })

  return c.json({ url: accountLink.url })
})

/**
 * GET /api/studios/:studioId/stripe/dashboard
 * Generates a Stripe Express dashboard login link for the studio owner.
 */
stripeRoutes.get('/:studioId/stripe/dashboard', async (c) => {
  const studioId = c.get('studioId')
  const supabase = createServiceClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('stripe_account_id')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')
  if (!studio.stripe_account_id) {
    throw badRequest('Studio has no Stripe account')
  }

  const stripe = createStripeClient()
  const loginLink = await stripe.accounts.createLoginLink(studio.stripe_account_id)

  return c.json({ url: loginLink.url })
})

export { stripeRoutes }
