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
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue({
    id: 'cus_test',
    object: 'customer',
    email: 'test@example.com',
    metadata: {},
  }),
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
    c.set('memberRole', 'admin')
    await next()
  }),
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
    await next()
  }),
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { createCheckoutSession } from '../lib/stripe'
import { getConnectedAccountId, getOrCreateStripeCustomer } from '../lib/payments'

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

  it('creates checkout session and returns URL on happy path', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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
      body: JSON.stringify({
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test')

    // Verify createCheckoutSession was called with correct params
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_test',
        customerId: 'cus_test',
        connectedAccountId: 'acct_test',
        metadata: expect.objectContaining({
          userId: 'user-123',
          studioId: STUDIO_ID,
          planId: PLAN_ID,
          type: 'subscription',
        }),
      }),
    )
  })

  it('rejects duplicate active subscription with 409', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'sub-existing' }, error: null }),
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

  it('applies coupon code and passes stripe_coupon_id to checkout', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const mockCoupon = {
      id: 'coupon-db-id',
      code: 'SAVE20',
      studio_id: STUDIO_ID,
      active: true,
      stripe_coupon_id: 'stripe_coupon_xyz',
      valid_from: null,
      valid_until: null,
      max_redemptions: null,
      current_redemptions: 0,
      discount_type: 'percentage',
      discount_value: 20,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })  // no existing subscription
        .mockResolvedValueOnce({ data: mockCoupon, error: null }),  // coupon found
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'cs_coupon',
      object: 'checkout.session',
      url: 'https://checkout.stripe.com/pay/cs_coupon',
      payment_intent: null,
      subscription: null,
      customer: 'cus_test',
      metadata: {},
    })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ couponCode: 'SAVE20' }),
    })
    expect(res.status).toBe(200)

    // Verify couponId was passed to createCheckoutSession
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        couponId: 'stripe_coupon_xyz',
        metadata: expect.objectContaining({
          couponCode: 'SAVE20',
        }),
      }),
    )
  })

  it('rejects invalid coupon code with 400', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
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

  it('rejects expired coupon with 400', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const expiredCoupon = {
      id: 'coupon-expired',
      code: 'OLD',
      studio_id: STUDIO_ID,
      active: true,
      stripe_coupon_id: 'stripe_old',
      valid_from: null,
      valid_until: '2020-01-01T00:00:00Z', // expired
      max_redemptions: null,
      current_redemptions: 0,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: expiredCoupon, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ couponCode: 'OLD' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/expired/i)
  })

  it('rejects plan without stripe_price_id with 400', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: null, // not configured
      type: 'unlimited',
      active: true,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/not.*configured/i)
  })

  it('returns 404 when plan not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    expect(res.status).toBe(404)
  })
})
