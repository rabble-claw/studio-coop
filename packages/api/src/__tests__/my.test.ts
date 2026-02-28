import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import my from '../routes/my'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/credits', () => ({
  refundCredit: vi.fn(),
}))
vi.mock('../lib/waitlist', () => ({
  promoteFromWaitlist: vi.fn(),
}))
vi.mock('../lib/calendar', () => ({
  buildBookingCalEvent: vi.fn().mockReturnValue('BEGIN:VCALENDAR...'),
}))
vi.mock('../lib/notifications', () => ({
  sendNotification: vi.fn(),
}))
vi.mock('../lib/stripe', () => ({
  createPaymentIntent: vi.fn(),
}))
vi.mock('../lib/payments', () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue({ id: 'cus_test', object: 'customer', email: 'test@example.com', metadata: {} }),
  getConnectedAccountId: vi.fn().mockResolvedValue('acct_test'),
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { refundCredit } from '../lib/credits'
import { promoteFromWaitlist } from '../lib/waitlist'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api', my)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─── DELETE /api/bookings/:bookingId (cancel own booking) ───────────────────

describe('DELETE /api/bookings/:bookingId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // Helper to make a booking with a class far in the future (within cancellation window)
  const futureDate = '2099-12-31'
  const makeBookingData = (overrides: Record<string, unknown> = {}) => ({
    id: 'booking-1',
    user_id: 'user-123',
    status: 'booked',
    credit_source: 'class_pack',
    credit_source_id: 'pass-1',
    booked_at: '2026-02-28T10:00:00Z',
    class_instance: {
      id: 'ci-1',
      studio_id: 'studio-abc',
      date: futureDate,
      start_time: '18:00:00',
      studio: { settings: { cancellationWindowHours: 12 }, timezone: 'Pacific/Auckland', name: 'Studio A' },
      template: { name: 'Yoga', location: 'Room 1', duration_min: 60 },
      teacher: { name: 'Jane' },
    },
    ...overrides,
  })

  it('returns 404 when booking not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/nonexistent', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when cancelling another users booking', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: makeBookingData({ user_id: 'other-user' }),
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/booking-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when booking is already cancelled', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: makeBookingData({ status: 'cancelled' }),
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/booking-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/already cancelled/i)
  })

  it('cancels and refunds credit when within cancellation window', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return {
            ...makeAsyncChain({ data: makeBookingData(), error: null }),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(refundCredit).mockResolvedValue()
    vi.mocked(promoteFromWaitlist).mockResolvedValue()

    const app = makeApp()
    const res = await app.request('/api/bookings/booking-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('cancelled')
    expect(body.creditRefunded).toBe(true)
    expect(body.withinCancellationWindow).toBe(true)
    expect(refundCredit).toHaveBeenCalled()
    expect(promoteFromWaitlist).toHaveBeenCalledWith('ci-1')
  })

  it('cancels without refund when outside cancellation window', async () => {
    // Class starts in 1 hour (< 12 hour window)
    const soonDate = new Date(Date.now() + 60 * 60 * 1000)
    const dateStr = soonDate.toISOString().split('T')[0]
    const timeStr = soonDate.toISOString().split('T')[1].slice(0, 8)

    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return {
            ...makeAsyncChain({
              data: makeBookingData({
                class_instance: {
                  id: 'ci-soon',
                  studio_id: 'studio-abc',
                  date: dateStr,
                  start_time: timeStr,
                  studio: { settings: { cancellationWindowHours: 12 }, timezone: 'UTC', name: 'Studio A' },
                  template: { name: 'Yoga', location: 'Room 1', duration_min: 60 },
                  teacher: { name: 'Jane' },
                },
              }),
              error: null,
            }),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(promoteFromWaitlist).mockResolvedValue()

    const app = makeApp()
    const res = await app.request('/api/bookings/booking-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('cancelled')
    expect(body.creditRefunded).toBe(false)
    expect(body.withinCancellationWindow).toBe(false)
    expect(refundCredit).not.toHaveBeenCalled()
  })
})

// ─── POST /api/bookings/:bookingId/confirm ──────────────────────────────────

describe('POST /api/bookings/:bookingId/confirm', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when booking not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/nonexistent/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when confirming another users booking', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: { id: 'b-1', user_id: 'other-user', status: 'booked' },
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/b-1/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when booking is cancelled', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: { id: 'b-1', user_id: 'user-123', status: 'cancelled' },
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/b-1/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/cancelled/i)
  })

  it('returns 400 when booking is waitlisted', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: { id: 'b-1', user_id: 'user-123', status: 'waitlisted' },
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/b-1/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/waitlisted/i)
  })

  it('confirms booking successfully', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn(() => ({
        ...makeAsyncChain({
          data: { id: 'b-1', user_id: 'user-123', status: 'booked' },
          error: null,
        }),
        update: vi.fn().mockReturnValue(updateChain),
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/bookings/b-1/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('confirmed')
    expect(body.confirmedAt).toBeDefined()
  })
})

// ─── GET /api/my/bookings ───────────────────────────────────────────────────

describe('GET /api/my/bookings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns upcoming bookings for the user', async () => {
    const futureDate = '2099-06-01'
    const bookingList = [
      {
        id: 'b-1',
        status: 'booked',
        waitlist_position: null,
        booked_at: '2026-02-28T10:00:00Z',
        confirmed_at: null,
        class_instance: {
          id: 'ci-1',
          date: futureDate,
          start_time: '18:00:00',
          template: { name: 'Yoga Flow', duration_min: 60 },
          teacher: { name: 'Jane', avatar_url: null },
          studio: { id: 'studio-1', name: 'Test Studio', slug: 'test', timezone: 'UTC' },
        },
      },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: bookingList, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/bookings', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.bookings).toHaveLength(1)
    expect(body.bookings[0].bookingId).toBe('b-1')
    expect(body.bookings[0].class.name).toBe('Yoga Flow')
    expect(body.bookings[0].cancelDeadline).toBeDefined()
  })

  it('filters out past bookings', async () => {
    const bookingList = [
      {
        id: 'b-past',
        status: 'booked',
        waitlist_position: null,
        booked_at: '2026-01-01T10:00:00Z',
        confirmed_at: null,
        class_instance: {
          id: 'ci-past',
          date: '2020-01-01',
          start_time: '10:00:00',
          template: { name: 'Old Class', duration_min: 60 },
          teacher: { name: 'Bob', avatar_url: null },
          studio: { id: 'studio-1', name: 'Test', slug: 'test', timezone: 'UTC' },
        },
      },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: bookingList, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/bookings', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.bookings).toHaveLength(0)
  })

  it('returns empty array when no bookings', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/bookings', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.bookings).toHaveLength(0)
  })
})
