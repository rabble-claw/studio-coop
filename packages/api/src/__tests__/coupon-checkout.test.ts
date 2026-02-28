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

describe('Coupon redemption in checkout', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('passes stripe_coupon_id to checkout session when coupon has percentage discount', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const mockCoupon = {
      id: 'coupon-db-1',
      code: 'SAVE20',
      studio_id: STUDIO_ID,
      active: true,
      stripe_coupon_id: 'stripe_coupon_20pct',
      discount_type: 'percentage',
      discount_value: 20,
      type: 'discount',
      valid_from: null,
      valid_until: null,
      max_redemptions: 100,
      current_redemptions: 5,
      free_classes: null,
    }

    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })  // no existing sub
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
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        couponId: 'stripe_coupon_20pct',
      }),
    )
  })

  it('rejects coupon that has reached max redemptions', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const maxedCoupon = {
      id: 'coupon-maxed',
      code: 'MAXED',
      studio_id: STUDIO_ID,
      active: true,
      stripe_coupon_id: 'stripe_maxed',
      valid_from: null,
      valid_until: null,
      max_redemptions: 10,
      current_redemptions: 10, // at max
    }

    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: maxedCoupon, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ couponCode: 'MAXED' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/maximum/i)
  })

  it('rejects coupon that is not yet valid', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    const futureCoupon = {
      id: 'coupon-future',
      code: 'FUTURE',
      studio_id: STUDIO_ID,
      active: true,
      stripe_coupon_id: 'stripe_future',
      valid_from: '2099-01-01T00:00:00Z', // future
      valid_until: null,
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
        .mockResolvedValueOnce({ data: futureCoupon, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ couponCode: 'FUTURE' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/not yet valid/i)
  })

  it('handles free_classes coupon by granting comp credits instead of Stripe discount', async () => {
    const mockPlan = {
      id: PLAN_ID,
      stripe_price_id: 'price_test',
      type: 'unlimited',
      active: true,
    }
    // A free_classes coupon: has type='free_classes' and free_classes count
    const freeClassCoupon = {
      id: 'coupon-free',
      code: 'FREECLASS',
      studio_id: STUDIO_ID,
      active: true,
      stripe_coupon_id: null, // no Stripe coupon for free_classes type
      type: 'free_classes',
      free_classes: 3,
      valid_from: null,
      valid_until: null,
      max_redemptions: null,
      current_redemptions: 0,
    }

    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const rpcMock = vi.fn().mockResolvedValue({ error: null })
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })  // no existing sub
        .mockResolvedValueOnce({ data: freeClassCoupon, error: null }),  // coupon found
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: insertMock,
      rpc: rpcMock,
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)
    vi.mocked(createCheckoutSession).mockResolvedValue({
      id: 'cs_free',
      object: 'checkout.session',
      url: 'https://checkout.stripe.com/pay/cs_free',
      payment_intent: null,
      subscription: null,
      customer: 'cus_test',
      metadata: {},
    })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ couponCode: 'FREECLASS' }),
    })
    expect(res.status).toBe(200)

    // For free_classes coupon, should NOT pass couponId to checkout
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        couponId: undefined,
      }),
    )

    // Should have inserted comp credits
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        studio_id: STUDIO_ID,
        remaining_classes: 3,
        reason: expect.stringContaining('FREECLASS'),
      }),
    )
  })
})
