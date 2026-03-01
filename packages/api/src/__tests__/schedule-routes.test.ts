import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import schedule from '../routes/schedule'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/class-generator', () => ({ generateClassInstances: vi.fn() }))
vi.mock('../lib/notifications', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-admin', email: 'admin@example.com' })
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
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'
const CLASS_ID = 'class-123'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', schedule)
  app.route('/', schedule)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

const headers = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/classes/:classId — instance modification
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/studios/:studioId/classes/:classId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}`

  it('returns 404 when class instance does not exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ max_capacity: 25 }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 400 when no valid fields provided', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled' },
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/no valid fields/i)
  })

  it('returns 400 for invalid status', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled' },
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'invalid_status' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/invalid status/i)
  })

  it('updates class instance fields', async () => {
    const updated = { id: CLASS_ID, studio_id: STUDIO_ID, max_capacity: 25, status: 'scheduled' }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          const chain = makeAsyncChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled' }, error: null })
          chain.update = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updated, error: null }),
              }),
            }),
          })
          return chain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ max_capacity: 25 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.max_capacity).toBe(25)
  })

  it('sends cancellation notifications when status set to cancelled', async () => {
    const updated = { id: CLASS_ID, studio_id: STUDIO_ID, status: 'cancelled' }
    const bookings = [{ user_id: 'user-a' }, { user_id: 'user-b' }]

    const insertMock = vi.fn().mockResolvedValue({ error: null })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          const chain = makeAsyncChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled' }, error: null })
          chain.update = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: updated, error: null }),
              }),
            }),
          })
          return chain
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: bookings, error: null })
        }
        if (table === 'notifications') {
          return { insert: insertMock }
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'cancelled' }),
    })

    expect(res.status).toBe(200)
    expect(insertMock).toHaveBeenCalledTimes(1)
    const notifications = insertMock.mock.calls[0][0]
    expect(notifications).toHaveLength(2)
    expect(notifications[0].type).toBe('class_cancelled')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/classes — one-off class creation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/classes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/classes`

  it('returns 400 when name is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ date: '2026-03-15', start_time: '09:00', duration_min: 60 }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/name/i)
  })

  it('returns 400 when date is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Workshop', start_time: '09:00', duration_min: 60 }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/date/i)
  })

  it('returns 400 when start_time is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Workshop', date: '2026-03-15', duration_min: 60 }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/start_time/i)
  })

  it('returns 400 when duration_min is invalid', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Workshop', date: '2026-03-15', start_time: '09:00', duration_min: 0 }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/duration_min/i)
  })

  it('creates a one-off class with template and returns 201', async () => {
    const template = { id: 'tpl-new' }
    const instance = { id: 'inst-new', studio_id: STUDIO_ID, date: '2026-03-15', start_time: '09:00:00', end_time: '10:00:00', status: 'scheduled' }

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_templates') {
          const chain = makeAsyncChain({ data: null, error: null })
          chain.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: template, error: null }),
            }),
          })
          return chain
        }
        if (table === 'class_instances') {
          const chain = makeAsyncChain({ data: null, error: null })
          chain.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: instance, error: null }),
            }),
          })
          return chain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Workshop', date: '2026-03-15', start_time: '09:00', duration_min: 60 }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBe('inst-new')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/classes/:classId/restore
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/classes/:classId/restore', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/classes/${CLASS_ID}/restore`

  it('returns 404 when class instance does not exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(404)
  })

  it('returns 400 when class is not cancelled', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({
        data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled' },
        error: null,
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/cancelled/i)
  })

  it('restores a cancelled class and notifies booked members', async () => {
    const restored = { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled' }
    const bookings = [{ user_id: 'user-a', status: 'booked' }, { user_id: 'user-b', status: 'confirmed' }]

    const insertMock = vi.fn().mockResolvedValue({ error: null })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          const chain = makeAsyncChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'cancelled' }, error: null })
          chain.update = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: restored, error: null }),
              }),
            }),
          })
          return chain
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: bookings, error: null })
        }
        if (table === 'notifications') {
          return { insert: insertMock }
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'POST', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('scheduled')
    expect(insertMock).toHaveBeenCalledTimes(1)
    const notifications = insertMock.mock.calls[0][0]
    expect(notifications).toHaveLength(2)
    expect(notifications[0].type).toBe('class_restored')
  })
})
