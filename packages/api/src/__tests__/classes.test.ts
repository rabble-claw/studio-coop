import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import classes from '../routes/classes'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({
  createPaymentIntent: vi.fn(),
}))
vi.mock('../lib/payments', () => ({
  getOrCreateStripeCustomer: vi.fn(),
  getConnectedAccountId: vi.fn(),
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'member@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { createPaymentIntent } from '../lib/stripe'
import { getOrCreateStripeCustomer, getConnectedAccountId } from '../lib/payments'

const STUDIO_ID = 'studio-abc'
const CLASS_ID = 'class-123'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', classes)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

describe('POST /api/studios/:studioId/classes/:classId/drop-in', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/drop-in`
  const headers = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }

  it('returns clientSecret on successful drop-in purchase', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({
            data: { id: CLASS_ID, studio_id: STUDIO_ID, max_capacity: 20, booked_count: 5, status: 'scheduled', date: '2026-03-15', start_time: '09:00' },
            error: null,
          })
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: null, error: null })
        }
        if (table === 'membership_plans') {
          return makeAsyncChain({
            data: { id: 'plan-1', price_cents: 2000, currency: 'usd' },
            error: null,
          })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(getConnectedAccountId).mockResolvedValue('acct_123')
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue({ id: 'cus_123' } as any)
    vi.mocked(createPaymentIntent).mockResolvedValue({ client_secret: 'pi_secret_abc' } as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.clientSecret).toBe('pi_secret_abc')
    expect(body.amount).toBe(2000)
    expect(body.currency).toBe('usd')
  })

  it('returns 404 when class does not exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(404)
  })

  it('returns 400 when class is not scheduled', async () => {
    const mock = {
      from: vi.fn(() =>
        makeAsyncChain({
          data: { id: CLASS_ID, studio_id: STUDIO_ID, max_capacity: 20, booked_count: 5, status: 'cancelled' },
          error: null,
        }),
      ),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/not available/i)
  })

  it('returns 400 when class is full', async () => {
    const mock = {
      from: vi.fn(() =>
        makeAsyncChain({
          data: { id: CLASS_ID, studio_id: STUDIO_ID, max_capacity: 10, booked_count: 10, status: 'scheduled' },
          error: null,
        }),
      ),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/full/i)
  })

  it('returns 409 when user already has a booking', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({
            data: { id: CLASS_ID, studio_id: STUDIO_ID, max_capacity: 20, booked_count: 5, status: 'scheduled' },
            error: null,
          })
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: { id: 'booking-existing' }, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(409)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/already/i)
  })

  it('returns 400 when no drop-in plan is configured', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({
            data: { id: CLASS_ID, studio_id: STUDIO_ID, max_capacity: 20, booked_count: 5, status: 'scheduled' },
            error: null,
          })
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: null, error: null })
        }
        if (table === 'membership_plans') {
          return makeAsyncChain({ data: null, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/drop-in plan/i)
  })
})
