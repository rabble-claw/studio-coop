import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import privateBookings from '../routes/private-bookings'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({
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
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'staff')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { createPaymentIntent } from '../lib/stripe'

const STUDIO_ID = 'studio-abc'
const BOOKING_ID = 'booking-123'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', privateBookings)
  return app
}

describe('POST /api/studios/:studioId/private-bookings/:id/deposit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('collects deposit via PaymentIntent', async () => {
    const booking = {
      id: BOOKING_ID,
      studio_id: STUDIO_ID,
      user_id: 'user-123',
      price_cents: 50000,
      deposit_cents: 10000,
      deposit_paid: false,
      status: 'requested',
    }
    vi.mocked(createPaymentIntent).mockResolvedValue({
      id: 'pi_deposit',
      object: 'payment_intent',
      client_secret: 'pi_deposit_secret',
      amount: 10000,
      currency: 'nzd',
      status: 'requires_payment_method',
      customer: 'cus_test',
      metadata: {},
    })

    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: booking, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/${BOOKING_ID}/deposit`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toBe('pi_deposit_secret')
    expect(body.amount).toBe(10000)

    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        metadata: expect.objectContaining({
          type: 'private_booking_deposit',
          bookingId: BOOKING_ID,
        }),
      }),
    )
  })

  it('rejects when deposit already paid', async () => {
    const booking = {
      id: BOOKING_ID,
      studio_id: STUDIO_ID,
      user_id: 'user-123',
      price_cents: 50000,
      deposit_cents: 10000,
      deposit_paid: true,
      status: 'confirmed',
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: booking, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/${BOOKING_ID}/deposit`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/already paid/i)
  })

  it('returns 404 when booking not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/nonexistent/deposit`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/studios/:studioId/private-bookings/:id/balance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns balance calculation with deposit deducted', async () => {
    const booking = {
      id: BOOKING_ID,
      studio_id: STUDIO_ID,
      user_id: 'user-123',
      price_cents: 50000,
      deposit_cents: 10000,
      deposit_paid: true,
      status: 'confirmed',
    }
    const payments = [
      { amount_cents: 10000, type: 'private_booking_deposit' },
    ]
    let queryCount = 0
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        queryCount++
        if (queryCount === 1) return Promise.resolve({ data: booking, error: null })
        return Promise.resolve({ data: null, error: null })
      }),
    }
    // For the payments query, return the array
    const originalFrom = chain.from
    chain.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockResolvedValue({ data: payments, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: booking, error: null }),
      }
    })
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/${BOOKING_ID}/balance`, {
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalPrice).toBe(50000)
    expect(body.depositPaid).toBe(10000)
    expect(body.balanceDue).toBe(40000)
  })

  it('returns 404 when booking not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/nonexistent/balance`, {
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/studios/:studioId/private-bookings/:id/pay-balance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates PaymentIntent for remaining balance', async () => {
    const booking = {
      id: BOOKING_ID,
      studio_id: STUDIO_ID,
      user_id: 'user-123',
      price_cents: 50000,
      deposit_cents: 10000,
      deposit_paid: true,
      status: 'confirmed',
    }
    vi.mocked(createPaymentIntent).mockResolvedValue({
      id: 'pi_balance',
      object: 'payment_intent',
      client_secret: 'pi_balance_secret',
      amount: 40000,
      currency: 'nzd',
      status: 'requires_payment_method',
      customer: 'cus_test',
      metadata: {},
    })

    const payments = [
      { amount_cents: 10000, type: 'private_booking_deposit' },
    ]
    const chain = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({ data: payments, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: booking, error: null }),
        }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/${BOOKING_ID}/pay-balance`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientSecret).toBe('pi_balance_secret')
    expect(body.amount).toBe(40000)

    expect(createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 40000,
        metadata: expect.objectContaining({
          type: 'private_booking_balance',
          bookingId: BOOKING_ID,
        }),
      }),
    )
  })

  it('rejects when balance is zero', async () => {
    const booking = {
      id: BOOKING_ID,
      studio_id: STUDIO_ID,
      user_id: 'user-123',
      price_cents: 10000,
      deposit_cents: 10000,
      deposit_paid: true,
      status: 'confirmed',
    }
    const payments = [
      { amount_cents: 10000, type: 'private_booking_deposit' },
    ]
    const chain = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({ data: payments, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: booking, error: null }),
        }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/${BOOKING_ID}/pay-balance`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/no balance/i)
  })
})
