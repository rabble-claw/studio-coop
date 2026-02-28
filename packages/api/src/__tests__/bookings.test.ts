import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import bookings from '../routes/bookings'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/credits', () => ({
  checkBookingCredits: vi.fn(),
  deductCredit: vi.fn(),
  refundCredit: vi.fn(),
}))
vi.mock('../lib/waitlist', () => ({
  addToWaitlist: vi.fn(),
  promoteFromWaitlist: vi.fn(),
}))
vi.mock('../lib/calendar', () => ({
  buildBookingCalEvent: vi.fn().mockReturnValue('BEGIN:VCALENDAR...'),
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
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
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'staff')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { checkBookingCredits, deductCredit, refundCredit } from '../lib/credits'
import { addToWaitlist, promoteFromWaitlist } from '../lib/waitlist'

const STUDIO_ID = 'studio-abc'
const CLASS_ID = 'class-xyz'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', bookings)
  return app
}

// ─── Supabase chain helpers ──────────────────────────────────────────────────

function makeAsyncChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
  // Make chain thenable for count queries
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

const scheduledClass = {
  id: CLASS_ID,
  studio_id: STUDIO_ID,
  status: 'scheduled',
  max_capacity: 12,
  date: '2026-03-01',
  start_time: '18:00:00',
  template: { name: 'Yoga Flow', location: 'Studio A', duration_min: 60 },
  teacher: { name: 'Jane' },
  studio: { name: 'Test Studio', timezone: 'Pacific/Auckland', settings: {} },
}

// ─── POST /:studioId/classes/:classId/book ──────────────────────────────────

describe('POST /api/studios/:studioId/classes/:classId/book', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when class not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(404)
  })

  it('returns 409 when already booked', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: scheduledClass, error: null })
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: { id: 'booking-existing', status: 'booked' }, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(409)
  })

  it('returns 409 when already waitlisted', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: scheduledClass, error: null })
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: { id: 'booking-wl', status: 'waitlisted' }, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(409)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/waitlist/i)
  })

  it('returns 202 with waitlist when class is full', async () => {
    let bookingsCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: scheduledClass, error: null })
        }
        if (table === 'bookings') {
          bookingsCallCount++
          // First call: existing booking check -> null
          if (bookingsCallCount === 1) {
            return makeAsyncChain({ data: null, error: null })
          }
          // Second call: count active bookings -> full
          return makeAsyncChain({ data: null, error: null, count: 12 })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(addToWaitlist).mockResolvedValue({ waitlist_position: 1, bookingId: 'wl-booking-1' })

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(202)
    const body = await res.json() as any
    expect(body.status).toBe('waitlisted')
    expect(body.waitlist_position).toBe(1)
    expect(addToWaitlist).toHaveBeenCalledWith(CLASS_ID, 'user-123')
  })

  it('returns 400 with NO_CREDITS when no credits available', async () => {
    let bookingsCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: scheduledClass, error: null })
        }
        if (table === 'bookings') {
          bookingsCallCount++
          if (bookingsCallCount === 1) {
            return makeAsyncChain({ data: null, error: null })
          }
          return makeAsyncChain({ data: null, error: null, count: 5 })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(checkBookingCredits).mockResolvedValue({ hasCredits: false, source: 'none' })

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.details?.code).toBe('NO_CREDITS')
  })

  it('successfully books with comp credit', async () => {
    let bookingsCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: scheduledClass, error: null })
        }
        if (table === 'bookings') {
          bookingsCallCount++
          if (bookingsCallCount === 1) {
            return makeAsyncChain({ data: null, error: null })
          }
          if (bookingsCallCount === 2) {
            return makeAsyncChain({ data: null, error: null, count: 5 })
          }
          // Third call: insert returns booking
          const insertChain: any = {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'booking-new' }, error: null }),
              }),
            }),
          }
          return insertChain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(checkBookingCredits).mockResolvedValue({
      hasCredits: true,
      source: 'comp_class',
      sourceId: 'comp-1',
      remainingAfter: 1,
    })
    vi.mocked(deductCredit).mockResolvedValue()

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.status).toBe('booked')
    expect(body.creditSource).toBe('comp_class')
    expect(body.remainingCredits).toBe(1)
    expect(deductCredit).toHaveBeenCalled()
  })

  it('successfully books with subscription credit', async () => {
    let bookingsCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: scheduledClass, error: null })
        }
        if (table === 'bookings') {
          bookingsCallCount++
          if (bookingsCallCount === 1) {
            return makeAsyncChain({ data: null, error: null })
          }
          if (bookingsCallCount === 2) {
            return makeAsyncChain({ data: null, error: null, count: 5 })
          }
          const insertChain: any = {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'booking-sub' }, error: null }),
              }),
            }),
          }
          return insertChain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(checkBookingCredits).mockResolvedValue({
      hasCredits: true,
      source: 'subscription_unlimited',
      sourceId: 'sub-1',
    })
    vi.mocked(deductCredit).mockResolvedValue()

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.creditSource).toBe('subscription_unlimited')
  })

  it('successfully books with class pack credit', async () => {
    let bookingsCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: scheduledClass, error: null })
        }
        if (table === 'bookings') {
          bookingsCallCount++
          if (bookingsCallCount === 1) {
            return makeAsyncChain({ data: null, error: null })
          }
          if (bookingsCallCount === 2) {
            return makeAsyncChain({ data: null, error: null, count: 5 })
          }
          const insertChain: any = {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'booking-pack' }, error: null }),
              }),
            }),
          }
          return insertChain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(checkBookingCredits).mockResolvedValue({
      hasCredits: true,
      source: 'class_pack',
      sourceId: 'pass-1',
      remainingAfter: 4,
    })
    vi.mocked(deductCredit).mockResolvedValue()

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.creditSource).toBe('class_pack')
    expect(body.remainingCredits).toBe(4)
  })
})

// ─── POST /:studioId/classes/:classId/bookings (staff book) ─────────────────

describe('POST /api/studios/:studioId/classes/:classId/bookings (staff)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when userId is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/userId/i)
  })

  it('returns 403 when user is not a member', async () => {
    let callIdx = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: { id: CLASS_ID, status: 'scheduled', max_capacity: 12 }, error: null })
        }
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'member-999' }),
      },
    )
    expect(res.status).toBe(403)
  })

  it('books bypassing credit check when staff provides valid userId', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: { id: CLASS_ID, status: 'scheduled', max_capacity: 12 }, error: null })
        }
        if (table === 'memberships') {
          return makeAsyncChain({ data: { role: 'member' }, error: null })
        }
        if (table === 'bookings') {
          const chain: any = {
            ...makeAsyncChain({ data: null, error: null }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'staff-booking-1' }, error: null }),
              }),
            }),
          }
          return chain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'member-1' }),
      },
    )
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.bookingId).toBe('staff-booking-1')
    expect(body.status).toBe('booked')
    // Credit check should NOT have been called
    expect(checkBookingCredits).not.toHaveBeenCalled()
  })
})

// ─── DELETE /:studioId/classes/:classId/bookings/:bookingId (staff cancel) ───

describe('DELETE /api/studios/:studioId/classes/:classId/bookings/:bookingId (staff)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when booking not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings/booking-999`,
      { method: 'DELETE', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(404)
  })

  it('returns 400 when booking is already cancelled', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return makeAsyncChain({
            data: { id: 'b-1', user_id: 'u-1', status: 'cancelled', credit_source: null, credit_source_id: null, class_instance_id: CLASS_ID },
            error: null,
          })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings/b-1`,
      { method: 'DELETE', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/already cancelled/i)
  })

  it('cancels booking, refunds credit, and promotes from waitlist', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return {
            ...makeAsyncChain({
              data: { id: 'b-2', user_id: 'u-1', status: 'booked', credit_source: 'class_pack', credit_source_id: 'pass-1', class_instance_id: CLASS_ID },
              error: null,
            }),
            update: vi.fn().mockReturnValue(updateChain),
          }
        }
        if (table === 'class_instances') {
          return makeAsyncChain({ data: { id: CLASS_ID }, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(promoteFromWaitlist).mockResolvedValue()

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings/b-2`,
      { method: 'DELETE', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('cancelled')
    expect(promoteFromWaitlist).toHaveBeenCalledWith(CLASS_ID)
  })
})

// ─── GET /:studioId/classes/:classId/bookings (staff roster) ────────────────

describe('GET /api/studios/:studioId/classes/:classId/bookings (staff)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when class not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(404)
  })

  it('returns booked, waitlisted, and cancelled lists', async () => {
    const bookingList = [
      { id: 'b1', status: 'booked', spot: 1, waitlist_position: null, booked_at: '2026-02-28T10:00:00Z', confirmed_at: null, cancelled_at: null, member: { id: 'u1', name: 'Alice', avatar_url: null, email: 'a@e.com' } },
      { id: 'b2', status: 'waitlisted', spot: null, waitlist_position: 1, booked_at: '2026-02-28T10:01:00Z', confirmed_at: null, cancelled_at: null, member: { id: 'u2', name: 'Bob', avatar_url: null, email: 'b@e.com' } },
      { id: 'b3', status: 'cancelled', spot: null, waitlist_position: null, booked_at: '2026-02-28T09:00:00Z', confirmed_at: null, cancelled_at: '2026-02-28T10:00:00Z', member: { id: 'u3', name: 'Carol', avatar_url: null, email: 'c@e.com' } },
    ]

    let fromCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: { id: CLASS_ID, max_capacity: 12 }, error: null })
        }
        if (table === 'bookings') {
          const chain = makeAsyncChain({ data: bookingList, error: null })
          return chain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.maxCapacity).toBe(12)
    expect(body.booked).toHaveLength(1)
    expect(body.waitlist).toHaveLength(1)
    expect(body.cancelled).toHaveLength(1)
  })
})
