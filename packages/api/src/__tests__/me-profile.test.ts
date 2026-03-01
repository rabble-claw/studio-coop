import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import my from '../routes/my'
import schedule from '../routes/schedule'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/credits', () => ({ refundCredit: vi.fn() }))
vi.mock('../lib/waitlist', () => ({ promoteFromWaitlist: vi.fn() }))
vi.mock('../lib/calendar', () => ({
  buildBookingCalEvent: vi.fn().mockReturnValue('BEGIN:VCALENDAR...'),
}))
vi.mock('../lib/notifications', () => ({ sendNotification: vi.fn() }))
vi.mock('../lib/stripe', () => ({ createPaymentIntent: vi.fn() }))
vi.mock('../lib/payments', () => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue({ id: 'cus_test' }),
  getConnectedAccountId: vi.fn().mockResolvedValue('acct_test'),
}))
vi.mock('../lib/class-generator', () => ({
  generateClassInstances: vi.fn().mockResolvedValue(0),
}))

const mockAuthOk = vi.fn(async (c: any, next: any) => {
  c.set('user', { id: 'user-123', email: 'test@example.com' })
  c.set('accessToken', 'fake-token')
  await next()
})

const mockAuthFail = vi.fn(async (c: any) => {
  return c.json({ error: { message: 'Unauthorized' } }, 401)
})

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
    c.set('memberRole', 'admin')
    await next()
  }),
  requireAdmin: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
  requireRole: vi.fn(),
}))

import { createServiceClient } from '../lib/supabase'

function makeMyApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api', my)
  return app
}

function makeScheduleApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', schedule)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─── GET /api/me/profile ──────────────────────────────────────────────────────

describe('GET /api/me/profile', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the user profile', async () => {
    const profileData = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: null,
      phone: '+1234567890',
      created_at: '2026-01-01T00:00:00Z',
    }

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: profileData, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeMyApp()
    const res = await app.request('/api/me/profile', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe('user-123')
    expect(body.email).toBe('test@example.com')
    expect(body.name).toBe('Test User')
  })

  it('returns 404 when user not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeMyApp()
    const res = await app.request('/api/me/profile', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })
})

// ─── PUT /api/me/profile ──────────────────────────────────────────────────────

describe('PUT /api/me/profile', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates name successfully', async () => {
    const updatedProfile = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'New Name',
      avatar_url: null,
      phone: null,
      created_at: '2026-01-01T00:00:00Z',
    }

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: updatedProfile, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeMyApp()
    const res = await app.request('/api/me/profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.name).toBe('New Name')
  })

  it('updates phone successfully', async () => {
    const updatedProfile = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: null,
      phone: '+9876543210',
      created_at: '2026-01-01T00:00:00Z',
    }

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: updatedProfile, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeMyApp()
    const res = await app.request('/api/me/profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: '+9876543210' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.phone).toBe('+9876543210')
  })

  it('returns 400 for empty update', async () => {
    const app = makeMyApp()
    const res = await app.request('/api/me/profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/no valid fields/i)
  })

  it('returns 400 when trying to update email', async () => {
    const app = makeMyApp()
    const res = await app.request('/api/me/profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'new@example.com' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/email/i)
  })

  it('returns 400 for empty name', async () => {
    const app = makeMyApp()
    const res = await app.request('/api/me/profile', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '   ' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/name/i)
  })
})

// ─── GET /api/me/memberships ──────────────────────────────────────────────────

describe('GET /api/me/memberships', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns memberships with studio details', async () => {
    const memberships = [
      {
        id: 'mem-1',
        studio_id: 'studio-1',
        role: 'member',
        status: 'active',
        joined_at: '2026-01-01T00:00:00Z',
        studio: { id: 'studio-1', name: 'Yoga Studio', slug: 'yoga', discipline: 'yoga', logo_url: null, timezone: 'UTC' },
      },
      {
        id: 'mem-2',
        studio_id: 'studio-2',
        role: 'admin',
        status: 'active',
        joined_at: '2026-02-01T00:00:00Z',
        studio: { id: 'studio-2', name: 'Pilates Place', slug: 'pilates', discipline: 'pilates', logo_url: null, timezone: 'US/Eastern' },
      },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: memberships, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeMyApp()
    const res = await app.request('/api/me/memberships', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.memberships).toHaveLength(2)
    expect(body.memberships[0].studio.name).toBe('Yoga Studio')
    expect(body.memberships[1].role).toBe('admin')
  })

  it('returns empty array when no memberships', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeMyApp()
    const res = await app.request('/api/me/memberships', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.memberships).toHaveLength(0)
  })
})

// ─── GET /api/me/studios (alias) ──────────────────────────────────────────────

describe('GET /api/me/studios', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns same response as /me/memberships', async () => {
    const memberships = [
      {
        id: 'mem-1',
        studio_id: 'studio-1',
        role: 'member',
        status: 'active',
        joined_at: '2026-01-01T00:00:00Z',
        studio: { id: 'studio-1', name: 'Yoga Studio', slug: 'yoga', discipline: 'yoga', logo_url: null, timezone: 'UTC' },
      },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: memberships, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeMyApp()
    const res = await app.request('/api/me/studios', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.memberships).toHaveLength(1)
    expect(body.memberships[0].studio.name).toBe('Yoga Studio')
  })
})

// ─── GET /api/studios/:studioId/classes/:classId ──────────────────────────────

describe('GET /api/studios/:studioId/classes/:classId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns class detail with booking count and my_booking', async () => {
    const instanceData = {
      id: 'ci-1',
      date: '2026-03-15',
      start_time: '10:00:00',
      end_time: '11:00:00',
      status: 'scheduled',
      max_capacity: 20,
      notes: null,
      feed_enabled: true,
      template: { id: 'tpl-1', name: 'Morning Flow', description: 'Gentle yoga', duration_min: 60, location: 'Room A', recurrence: 'weekly' },
      teacher: { id: 'teacher-1', name: 'Jane', avatar_url: null },
      studio: { id: 'studio-1', name: 'Yoga Studio', slug: 'yoga', timezone: 'UTC' },
    }

    const userBooking = {
      id: 'booking-1',
      status: 'booked',
      waitlist_position: null,
    }

    let callCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: instanceData, error: null })
        }
        if (table === 'bookings') {
          callCount++
          if (callCount === 1) {
            // booking count query
            return makeAsyncChain({ data: null, error: null, count: 5 })
          }
          // user booking query
          return makeAsyncChain({ data: userBooking, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeScheduleApp()
    const res = await app.request('/api/studios/studio-1/classes/ci-1', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe('ci-1')
    expect(body.template.name).toBe('Morning Flow')
    expect(body.teacher.name).toBe('Jane')
    expect(body.booking_count).toBe(5)
    expect(body.my_booking.id).toBe('booking-1')
  })

  it('returns null for my_booking when user has no booking', async () => {
    const instanceData = {
      id: 'ci-1',
      date: '2026-03-15',
      start_time: '10:00:00',
      end_time: '11:00:00',
      status: 'scheduled',
      max_capacity: 20,
      notes: null,
      feed_enabled: true,
      template: { id: 'tpl-1', name: 'Morning Flow', description: null, duration_min: 60, location: 'Room A', recurrence: 'weekly' },
      teacher: { id: 'teacher-1', name: 'Jane', avatar_url: null },
      studio: { id: 'studio-1', name: 'Yoga Studio', slug: 'yoga', timezone: 'UTC' },
    }

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: instanceData, error: null })
        }
        return makeAsyncChain({ data: null, error: null, count: 0 })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeScheduleApp()
    const res = await app.request('/api/studios/studio-1/classes/ci-1', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.my_booking).toBeNull()
    expect(body.booking_count).toBe(0)
  })

  it('returns 404 when class not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeScheduleApp()
    const res = await app.request('/api/studios/studio-1/classes/nonexistent', {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })
})
