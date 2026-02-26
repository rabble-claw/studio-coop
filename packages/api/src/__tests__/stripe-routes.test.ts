import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { StudioEnv } from '../middleware/studio-access'

// --- Mocks ---
vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({ createStripeClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set('user', { id: 'user-1', email: 'owner@test.com', role: 'authenticated' })
    c.set('accessToken', 'tok')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireOwner: vi.fn(async (c, next) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { createStripeClient } from '../lib/stripe'
import { stripeRoutes } from '../routes/stripe'
import { errorHandler } from '../middleware/error-handler'

// Mount routes under /api/studios
const app = new Hono<StudioEnv>()
app.onError(errorHandler)
app.route('/api/studios', stripeRoutes)

// Shared Stripe mock helpers
const mockStripe = {
  accounts: {
    create: vi.fn(),
    retrieve: vi.fn(),
    createLoginLink: vi.fn(),
  },
  accountLinks: {
    create: vi.fn(),
  },
}

function makeSupabase(studioRow: Record<string, unknown> | null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: studioRow, error: null }),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createStripeClient).mockReturnValue(mockStripe as any)
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
})

// ─── Task 2: POST onboard ────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/stripe/onboard', () => {
  it('creates a new Connect account when studio has none', async () => {
    const supabase = makeSupabase({ id: 'studio-1', stripe_account_id: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    mockStripe.accounts.create.mockResolvedValue({ id: 'acct_new' })
    mockStripe.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/setup/e/xxx' })

    const res = await app.request('/api/studios/studio-1/stripe/onboard', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('stripe.com')

    expect(mockStripe.accounts.create).toHaveBeenCalledWith({
      type: 'express',
      metadata: { studioId: 'studio-1' },
    })
    expect(mockStripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_new', type: 'account_onboarding' })
    )
  })

  it('skips account creation when studio already has stripe_account_id', async () => {
    const supabase = makeSupabase({ id: 'studio-1', stripe_account_id: 'acct_existing' })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    mockStripe.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/setup/e/yyy' })

    const res = await app.request('/api/studios/studio-1/stripe/onboard', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(mockStripe.accounts.create).not.toHaveBeenCalled()
    expect(mockStripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_existing' })
    )
  })

  it('returns 404 when studio is not found', async () => {
    const supabase = makeSupabase(null)
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    const res = await app.request('/api/studios/no-such-studio/stripe/onboard', { method: 'POST' })
    expect(res.status).toBe(404)
  })
})

// ─── Task 3: GET status ──────────────────────────────────────────────────────

describe('GET /api/studios/:studioId/stripe/status', () => {
  it('returns connected=false when no stripe_account_id', async () => {
    const supabase = makeSupabase({ stripe_account_id: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    const res = await app.request('/api/studios/studio-1/stripe/status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ connected: false, chargesEnabled: false, detailsSubmitted: false })
  })

  it('returns full status when account exists and charges enabled', async () => {
    const supabase = makeSupabase({ stripe_account_id: 'acct_123' })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    mockStripe.accounts.retrieve.mockResolvedValue({
      id: 'acct_123',
      charges_enabled: true,
      details_submitted: true,
    })

    const res = await app.request('/api/studios/studio-1/stripe/status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      connected: true,
      chargesEnabled: true,
      detailsSubmitted: true,
      accountId: 'acct_123',
    })
  })

  it('returns partial status when onboarding incomplete', async () => {
    const supabase = makeSupabase({ stripe_account_id: 'acct_123' })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    mockStripe.accounts.retrieve.mockResolvedValue({
      id: 'acct_123',
      charges_enabled: false,
      details_submitted: false,
    })

    const res = await app.request('/api/studios/studio-1/stripe/status')
    const body = await res.json()
    expect(body.chargesEnabled).toBe(false)
    expect(body.detailsSubmitted).toBe(false)
  })
})

// ─── Task 3: POST refresh-link ───────────────────────────────────────────────

describe('POST /api/studios/:studioId/stripe/refresh-link', () => {
  it('generates a new onboarding link', async () => {
    const supabase = makeSupabase({ stripe_account_id: 'acct_123' })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    mockStripe.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/refresh/xxx' })

    const res = await app.request('/api/studios/studio-1/stripe/refresh-link', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('stripe.com')
  })

  it('returns 400 when no Stripe account exists', async () => {
    const supabase = makeSupabase({ stripe_account_id: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    const res = await app.request('/api/studios/studio-1/stripe/refresh-link', { method: 'POST' })
    expect(res.status).toBe(400)
  })
})

// ─── Task 4: GET dashboard ───────────────────────────────────────────────────

describe('GET /api/studios/:studioId/stripe/dashboard', () => {
  it('returns a login link for the Express dashboard', async () => {
    const supabase = makeSupabase({ stripe_account_id: 'acct_123' })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    mockStripe.accounts.createLoginLink.mockResolvedValue({
      url: 'https://connect.stripe.com/express/login/xxx',
    })

    const res = await app.request('/api/studios/studio-1/stripe/dashboard')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('stripe.com')
    expect(mockStripe.accounts.createLoginLink).toHaveBeenCalledWith('acct_123')
  })

  it('returns 400 when no Stripe account exists', async () => {
    const supabase = makeSupabase({ stripe_account_id: null })
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    const res = await app.request('/api/studios/studio-1/stripe/dashboard')
    expect(res.status).toBe(400)
  })
})
