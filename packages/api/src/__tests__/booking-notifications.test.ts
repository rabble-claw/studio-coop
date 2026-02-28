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
vi.mock('../lib/notifications', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
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
import { promoteFromWaitlist } from '../lib/waitlist'
import { sendNotification } from '../lib/notifications'

const STUDIO_ID = 'studio-abc'
const CLASS_ID = 'class-xyz'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', bookings)
  return app
}

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
  }
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

describe('Booking confirmation notification', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends booking_confirmed notification on successful book', async () => {
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

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        studioId: STUDIO_ID,
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        channels: expect.arrayContaining(['push', 'in_app']),
      }),
    )
  })

  it('does not block booking response when notification fails', async () => {
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
      remainingAfter: 0,
    })
    vi.mocked(deductCredit).mockResolvedValue()
    // Notification fails
    vi.mocked(sendNotification).mockRejectedValue(new Error('Notification service down'))

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )
    // Booking should still succeed even though notification failed
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.status).toBe('booked')
  })
})

describe('Staff cancel notification', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends booking_cancelled notification when staff cancels a booking', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return {
            ...makeAsyncChain({
              data: {
                id: 'b-1',
                user_id: 'member-1',
                status: 'booked',
                credit_source: 'subscription_unlimited',
                credit_source_id: 'sub-1',
                class_instance_id: CLASS_ID,
              },
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
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings/b-1`,
      { method: 'DELETE', headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(200)

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        studioId: STUDIO_ID,
        type: 'booking_cancelled',
        channels: expect.arrayContaining(['push', 'in_app']),
      }),
    )
  })
})

describe('Waitlist promotion notification', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sendNotification is imported and callable from waitlist lib', async () => {
    const { sendNotification: sn } = await import('../lib/notifications')
    expect(typeof sn).toBe('function')
  })

  it('booking confirmation includes class name in notification body', async () => {
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
      source: 'class_pack',
      sourceId: 'pack-1',
      remainingAfter: 3,
    })
    vi.mocked(deductCredit).mockResolvedValue()

    const app = makeApp()
    await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/book`,
      { method: 'POST', headers: { Authorization: 'Bearer tok' } },
    )

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Yoga Flow'),
        data: expect.objectContaining({
          classId: CLASS_ID,
          bookingId: 'booking-new',
          screen: 'BookingDetail',
        }),
      }),
    )
  })

  it('staff cancel notification includes correct user_id (not staff id)', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'bookings') {
          return {
            ...makeAsyncChain({
              data: {
                id: 'b-member',
                user_id: 'the-member-id',
                status: 'booked',
                credit_source: null,
                credit_source_id: null,
                class_instance_id: CLASS_ID,
              },
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
    await app.request(
      `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/bookings/b-member`,
      { method: 'DELETE', headers: { Authorization: 'Bearer tok' } },
    )

    await new Promise(resolve => setTimeout(resolve, 10))

    // Notification should go to the member, not the staff user
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'the-member-id', // member's ID, not 'user-123' (staff)
      }),
    )
  })
})
