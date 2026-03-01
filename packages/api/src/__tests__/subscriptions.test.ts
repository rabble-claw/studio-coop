import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import plans from '../routes/plans'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({
  createStripePrice: vi.fn(),
  archiveStripePrice: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPaymentIntent: vi.fn(),
}))
vi.mock('../lib/payments', () => ({
  getConnectedAccountId: vi.fn().mockResolvedValue('acct_test'),
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue({ id: 'cus_test', object: 'customer', email: 'test@example.com', metadata: {} }),
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireAdmin: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    await next()
  }),
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    await next()
  }),
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { createCheckoutSession } from '../lib/stripe'

const STUDIO_ID = 'studio-abc'
const PLAN_ID = 'plan-xyz'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', plans)
  return app
}

describe('POST /api/studios/:studioId/plans/:planId/subscribe', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns checkout URL on happy path', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    // Each call to createServiceClient returns the same mock chain
    const callOrder: string[] = []
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callOrder.push('single')
        // First single = plan fetch, second = no existing sub (maybeSingle)
        if (callOrder.length === 1) return Promise.resolve({ data: mockPlan, error: null })
        return Promise.resolve({ data: null, error: null })
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // no existing sub
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'cs_test',
      object: 'checkout.session',
      url: 'https://checkout.stripe.com/pay/cs_test',
      payment_intent: null,
      subscription: null,
      customer: 'cus_test',
      metadata: {},
    })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test')
  })

  it('rejects duplicate active subscription with 409', async () => {
    const mockPlan = { id: PLAN_ID, stripe_price_id: 'price_test', type: 'unlimited', active: true }
    const existingSub = { id: 'sub-existing' }
    let callCount = 0
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({ data: callCount === 1 ? mockPlan : null, error: null })
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: existingSub, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('rejects invalid coupon with 400', async () => {
    const mockPlan = { id: PLAN_ID, stripe_price_id: 'price_test', type: 'unlimited', active: true }
    let callCount = 0
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({ data: callCount === 1 ? mockPlan : null, error: null })
      }),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })  // no existing sub
        .mockResolvedValueOnce({ data: null, error: null }),  // coupon not found
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ couponCode: 'INVALID' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/coupon/i)
  })
})

// ─── A5: My-subscription endpoint ────────────────────────────────────────────

describe('GET /api/studios/:studioId/my-subscription', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns subscription and class passes when user has active subscription', async () => {
    const mockSub = {
      id: 'sub-1',
      user_id: 'user-123',
      studio_id: STUDIO_ID,
      plan_id: PLAN_ID,
      status: 'active',
      plan: { id: PLAN_ID, name: 'Unlimited Monthly' },
    }
    const mockPasses = [
      { id: 'pass-1', remaining_classes: 5, expires_at: '2026-04-01T00:00:00Z' },
    ]

    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockSub, error: null }),
    }
    // For the second query (class_passes), we make the chain resolve to passes
    // We need the order call to return the passes data for the second query
    let queryCount = 0
    chain.order = vi.fn().mockImplementation(() => {
      queryCount++
      if (queryCount === 1) {
        // First order -> subscription query -> limit -> maybeSingle
        return { limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: mockSub, error: null }) }) }
      }
      // Second order -> class_passes query -> resolves to data
      return Promise.resolve({ data: mockPasses, error: null })
    })
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/my-subscription`, {
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subscription).toBeTruthy()
    expect(body.subscription.id).toBe('sub-1')
    expect(body.classPasses).toHaveLength(1)
  })

  it('returns null subscription when user has no active subscription', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    // order resolves to empty data for class_passes
    let queryCount = 0
    chain.order = vi.fn().mockImplementation(() => {
      queryCount++
      if (queryCount === 1) {
        return { limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
      }
      return Promise.resolve({ data: [], error: null })
    })
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/my-subscription`, {
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subscription).toBeNull()
    expect(body.classPasses).toEqual([])
  })
})

describe('POST /api/studios/:studioId/plans/:planId/purchase (class pack)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns client secret for a class pack plan', async () => {
    const { createPaymentIntent } = await import('../lib/stripe')
    vi.mocked(createPaymentIntent).mockResolvedValue({
      id: 'pi_test',
      object: 'payment_intent',
      client_secret: 'pi_test_secret_abc',
      amount: 16000,
      currency: 'nzd',
      status: 'requires_payment_method',
      customer: 'cus_test',
      metadata: {},
    })

    const mockPlan = { id: PLAN_ID, type: 'class_pack', price_cents: 16000, currency: 'NZD', active: true }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/purchase`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toBe('pi_test_secret_abc')
  })

  it('rejects non-class-pack plans with 400', async () => {
    const mockPlan = { id: PLAN_ID, type: 'unlimited', price_cents: 18000, currency: 'NZD', active: true }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/purchase`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
  })
})
