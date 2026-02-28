import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import privateBookings from '../routes/private-bookings'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-staff', email: 'staff@example.com' })
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

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', privateBookings)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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

// ─── GET /:studioId/private-bookings ────────────────────────────────────────

describe('GET /api/studios/:studioId/private-bookings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of private bookings', async () => {
    const bookings = [
      {
        id: 'pb-1',
        type: 'party',
        title: 'Birthday Party',
        description: null,
        notes: null,
        date: '2026-03-15',
        start_time: '14:00',
        end_time: '16:00',
        attendee_count: 10,
        status: 'requested',
        price_cents: 50000,
        deposit_cents: 10000,
        deposit_paid: false,
        created_at: '2026-02-28T10:00:00Z',
        user: { name: 'Alice', email: 'alice@example.com' },
      },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: bookings, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.bookings).toHaveLength(1)
    expect(body.bookings[0].client_name).toBe('Alice')
    // 'requested' is mapped to 'pending' for frontend
    expect(body.bookings[0].status).toBe('pending')
  })

  it('filters by status query param', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings?status=confirmed`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.bookings).toHaveLength(0)
  })
})

// ─── POST /:studioId/private-bookings ───────────────────────────────────────

describe('POST /api/studios/:studioId/private-bookings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a private booking with required fields', async () => {
    const newBooking = {
      id: 'pb-new',
      studio_id: STUDIO_ID,
      user_id: 'user-staff',
      type: 'party',
      title: 'Birthday Party',
      description: '',
      notes: null,
      date: '2026-04-01',
      start_time: '14:00',
      end_time: '16:00',
      attendee_count: null,
      price_cents: 0,
      deposit_paid: false,
      status: 'requested',
    }
    const mock = {
      from: vi.fn(() => ({
        ...makeAsyncChain({ data: null, error: null }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newBooking, error: null }),
          }),
        }),
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Birthday Party',
        type: 'party',
        date: '2026-04-01',
        start_time: '14:00',
        end_time: '16:00',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.booking.status).toBe('pending')
  })

  it('returns 400 when title is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-04-01', start_time: '14:00', end_time: '16:00' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when date is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Test', start_time: '14:00', end_time: '16:00' }),
    })
    expect(res.status).toBe(400)
  })
})

// ─── PUT /:studioId/private-bookings/:id ────────────────────────────────────

describe('PUT /api/studios/:studioId/private-bookings/:id', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when booking not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/nonexistent`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(res.status).toBe(404)
  })

  it('updates status from pending to confirmed', async () => {
    const updatedBooking = {
      id: 'pb-1',
      status: 'confirmed',
      title: 'Party',
      notes: null,
    }
    let callCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        callCount++
        // First call: select to check existence
        if (callCount === 1) {
          return makeAsyncChain({ data: { id: 'pb-1' }, error: null })
        }
        // Second call: update
        return {
          ...makeAsyncChain({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updatedBooking, error: null }),
              }),
            }),
          }),
        }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/pb-1`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.booking.status).toBe('confirmed')
  })

  it('returns 400 when no fields to update', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: { id: 'pb-1' }, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/pb-1`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

// ─── DELETE /:studioId/private-bookings/:id ─────────────────────────────────

describe('DELETE /api/studios/:studioId/private-bookings/:id', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when booking not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/nonexistent`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })

  it('cancels a private booking', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return makeAsyncChain({ data: { id: 'pb-1' }, error: null })
        }
        return {
          ...makeAsyncChain({ data: null, error: null }),
          update: vi.fn().mockReturnValue(updateChain),
        }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/private-bookings/pb-1`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.cancelled).toBe(true)
  })
})
