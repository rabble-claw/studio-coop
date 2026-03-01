import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import plans from '../routes/plans'
import classes from '../routes/classes'
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
import { createPaymentIntent } from '../lib/stripe'

const STUDIO_ID = 'studio-abc'
const PLAN_ID = 'plan-xyz'
const CLASS_ID = 'class-xyz'

function makePlansApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', plans)
  return app
}

function makeClassesApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', classes)
  return app
}

// ─── Class Pack Purchase ────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/plans/:planId/purchase (class pack)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns client secret for a class pack plan', async () => {
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

    const mockPlan = {
      id: PLAN_ID,
      type: 'class_pack',
      price_cents: 16000,
      currency: 'NZD',
      active: true,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makePlansApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/purchase`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toBe('pi_test_secret_abc')

    // Verify createPaymentIntent was called with correct params
    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 16000,
        currency: 'NZD',
        customerId: 'cus_test',
        connectedAccountId: 'acct_test',
        metadata: expect.objectContaining({
          userId: 'user-123',
          type: 'class_pack',
          planId: PLAN_ID,
        }),
      }),
    )
  })

  it('rejects non-class-pack plans with 400', async () => {
    const mockPlan = {
      id: PLAN_ID,
      type: 'unlimited',
      price_cents: 18000,
      currency: 'NZD',
      active: true,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makePlansApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/purchase`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/class pack/i)
  })

  it('returns 404 for non-existent plan', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makePlansApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/nonexistent/purchase`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })
})

// ─── Drop-in Purchase ───────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/classes/:classId/drop-in', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const scheduledClass = {
    id: CLASS_ID,
    studio_id: STUDIO_ID,
    max_capacity: 12,
    booked_count: 8,
    status: 'scheduled',
    date: '2026-03-01',
    start_time: '18:00:00',
  }

  const dropInPlan = {
    id: 'plan-dropin',
    price_cents: 2500,
    currency: 'NZD',
  }

  function makeChain(classData: unknown, existingBooking: unknown, planData: unknown) {
    let callCount = 0
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.resolve({ data: classData, error: null })
        if (callCount === 2) return Promise.resolve({ data: planData, error: null })
        return Promise.resolve({ data: null, error: null })
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: existingBooking, error: null }),
    }
    return chain
  }

  it('returns client_secret on happy path with capacity check', async () => {
    vi.mocked(createPaymentIntent).mockResolvedValue({
      id: 'pi_dropin',
      object: 'payment_intent',
      client_secret: 'pi_dropin_secret',
      amount: 2500,
      currency: 'nzd',
      status: 'requires_payment_method',
      customer: 'cus_test',
      metadata: {},
    })

    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(scheduledClass, null, dropInPlan) as any,
    )

    const app = makeClassesApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toBe('pi_dropin_secret')
    expect(body.amount).toBe(2500)
    expect(body.currency).toBe('NZD')
  })

  it('rejects when class is full (capacity check)', async () => {
    const fullClass = { ...scheduledClass, max_capacity: 8, booked_count: 8 }
    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(fullClass, null, dropInPlan) as any,
    )

    const app = makeClassesApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/full/i)
  })

  it('rejects duplicate booking with 409', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(scheduledClass, { id: 'booking-existing' }, dropInPlan) as any,
    )

    const app = makeClassesApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(409)
  })

  it('returns 404 when class not found', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(null, null, dropInPlan) as any,
    )

    const app = makeClassesApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })

  it('rejects when class is not scheduled', async () => {
    const cancelledClass = { ...scheduledClass, status: 'cancelled' }
    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(cancelledClass, null, dropInPlan) as any,
    )

    const app = makeClassesApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/not available/i)
  })
})
