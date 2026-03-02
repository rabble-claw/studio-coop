import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import calendarFeed from '../routes/calendar-feed'
import { errorHandler } from '../middleware/error-handler'

// Mock supabase
vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const VALID_TOKEN = 'a'.repeat(64)

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api', calendarFeed)
  return app
}

function mockChain(overrides: Record<string, any> = {}) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined as any,
    ...overrides,
  }
  // Make thenable for await
  chain.then = (res: any) => Promise.resolve({ data: overrides.data ?? null, error: overrides.error ?? null, count: overrides.count ?? null }).then(res)
  chain.catch = (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cal/:token — Public feed
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/cal/:token', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 for invalid token format', async () => {
    const app = makeApp()
    const res = await app.request('/api/cal/short-token')
    expect(res.status).toBe(404)
  })

  it('returns 404 for unknown token', async () => {
    const tokenChain = mockChain()
    tokenChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mock = { from: vi.fn(() => tokenChain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/cal/${VALID_TOKEN}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 for revoked token', async () => {
    // revoked tokens have revoked_at set, so the `is('revoked_at', null)` filter excludes them
    const tokenChain = mockChain()
    tokenChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mock = { from: vi.fn(() => tokenChain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/cal/${VALID_TOKEN}`)
    expect(res.status).toBe(404)
  })

  it('returns text/calendar with VEVENTs for valid token', async () => {
    const tokenData = { id: 'tok-1', user_id: 'user-1', label: 'My Classes' }
    const bookingData = [{
      id: 'b-1',
      status: 'booked',
      class_instance: {
        id: 'ci-1',
        date: '2026-03-10',
        start_time: '09:00:00',
        template: { name: 'Yoga', duration_min: 60, description: null },
        teacher: { name: 'Jane' },
        studio: { id: 's-1', name: 'Flow Studio', slug: 'flow', timezone: 'Pacific/Auckland', email: 'info@flow.co' },
      },
    }]

    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          // Token lookup
          const chain = mockChain()
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: tokenData, error: null })
          return chain
        }
        if (callCount === 2) {
          // last_used_at update (fire-and-forget)
          const chain = mockChain()
          chain.then = (res: any) => Promise.resolve({ data: null, error: null }).then(res)
          return chain
        }
        // Bookings query
        const chain = mockChain({ data: bookingData })
        return chain
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/cal/${VALID_TOKEN}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    expect(res.headers.get('cache-control')).toContain('no-cache')

    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('METHOD:PUBLISH')
    expect(body).toContain('X-WR-CALNAME:My Classes')
    expect(body).toContain('BEGIN:VEVENT')
    expect(body).toContain('UID:booking-b-1@studiocoop')
    expect(body).toContain('SUMMARY:Yoga')
    expect(body).toContain('DTSTART;TZID=Pacific/Auckland:20260310T090000')
    expect(body).toContain('DESCRIPTION:Class with Jane')
    expect(body).toContain('END:VCALENDAR')
  })

  it('returns valid empty feed when user has no bookings', async () => {
    const tokenData = { id: 'tok-1', user_id: 'user-1', label: 'Empty' }

    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          const chain = mockChain()
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: tokenData, error: null })
          return chain
        }
        if (callCount === 2) {
          const chain = mockChain()
          chain.then = (res: any) => Promise.resolve({ data: null, error: null }).then(res)
          return chain
        }
        return mockChain({ data: [] })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/cal/${VALID_TOKEN}`)
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('END:VCALENDAR')
    expect(body).not.toContain('BEGIN:VEVENT')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/my/calendar-token — Create token
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/my/calendar-token', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a token and returns feedUrl', async () => {
    const countChain = mockChain({ count: 2 })
    const insertChain = mockChain()
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: 'new-tok', label: 'Test', created_at: '2026-03-01T00:00:00Z' },
      error: null,
    })

    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) return countChain
        return insertChain
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/calendar-token', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Test' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBe('new-tok')
    expect(body.feedUrl).toContain('/api/cal/')
    expect(body.label).toBe('Test')
  })

  it('rejects when max 5 tokens reached', async () => {
    const countChain = mockChain({ count: 5 })

    const mock = { from: vi.fn(() => countChain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/calendar-token', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toContain('Maximum of 5')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/my/calendar-token — List tokens
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/my/calendar-token', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of active tokens', async () => {
    const tokens = [
      { id: 't-1', label: 'Cal 1', created_at: '2026-03-01T00:00:00Z', last_used_at: null },
      { id: 't-2', label: 'Cal 2', created_at: '2026-02-15T00:00:00Z', last_used_at: '2026-03-01T08:00:00Z' },
    ]
    const chain = mockChain({ data: tokens })
    const mock = { from: vi.fn(() => chain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/calendar-token', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.tokens).toHaveLength(2)
    expect(body.tokens[0].id).toBe('t-1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/my/calendar-token/:tokenId — Revoke token
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/my/calendar-token/:tokenId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('revokes token successfully', async () => {
    const chain = mockChain()
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 't-1' }, error: null })
    const mock = { from: vi.fn(() => chain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/calendar-token/t-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })

  it('returns 404 for non-existent token', async () => {
    const chain = mockChain()
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mock = { from: vi.fn(() => chain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/calendar-token/nonexistent', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(404)
  })
})
