import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import classes from '../routes/classes'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({ createPaymentIntent: vi.fn() }))
vi.mock('../lib/payments', () => ({
  getConnectedAccountId: vi.fn().mockResolvedValue('acct_test'),
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue({ id: 'cus_test', object: 'customer', email: 'test@example.com', metadata: {} }),
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { createPaymentIntent } from '../lib/stripe'

const STUDIO_ID = 'studio-abc'
const CLASS_ID = 'class-xyz'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', classes)
  return app
}

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

describe('POST /api/studios/:studioId/classes/:classId/drop-in', () => {
  beforeEach(() => { vi.clearAllMocks() })

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

  it('returns client_secret on happy path', async () => {
    vi.mocked(createPaymentIntent).mockResolvedValue({
      id: 'pi_test',
      object: 'payment_intent',
      client_secret: 'pi_test_secret',
      amount: 2500,
      currency: 'nzd',
      status: 'requires_payment_method',
      customer: 'cus_test',
      metadata: {},
    })

    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(scheduledClass, null, dropInPlan) as any
    )

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toBe('pi_test_secret')
    expect(body.amount).toBe(2500)
  })

  it('rejects when class is full', async () => {
    const fullClass = { ...scheduledClass, max_capacity: 8, booked_count: 8 }
    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(fullClass, null, dropInPlan) as any
    )

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/full/i)
  })

  it('rejects when user already has a booking', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(scheduledClass, { id: 'booking-existing' }, dropInPlan) as any
    )

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(409)
  })

  it('returns 404 when class not found', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeChain(null, null, dropInPlan) as any
    )

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })
})
