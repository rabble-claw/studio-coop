import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import reports from '../routes/reports'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-admin', email: 'admin@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', reports)
  return app
}

function makeAsyncChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─── GET /:studioId/reports/overview ────────────────────────────────────────

describe('GET /api/studios/:studioId/reports/overview', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns overview stats', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ count: 25, error: null })
        }
        if (table === 'payments') {
          return makeAsyncChain({ data: [{ amount_cents: 5000 }, { amount_cents: 3000 }], error: null })
        }
        if (table === 'class_instances') {
          return makeAsyncChain({
            data: [
              { id: 'c1', max_capacity: 10, booked_count: 8 },
              { id: 'c2', max_capacity: 10, booked_count: 6 },
            ],
            error: null,
          })
        }
        return makeAsyncChain({ data: null, error: null, count: 0 })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/reports/overview`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.activeMembers).toBe(25)
    expect(body.totalRevenue).toBe(8000)
    expect(body.avgAttendanceRate).toBe(0.7) // (8+6)/(10+10)
  })
})

// ─── GET /:studioId/reports/attendance ───────────────────────────────────────

describe('GET /api/studios/:studioId/reports/attendance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns weekly attendance grouped by week', async () => {
    const classes = [
      { id: 'c1', date: '2026-03-02', max_capacity: 10, booked_count: 8 },  // Monday W10
      { id: 'c2', date: '2026-03-04', max_capacity: 12, booked_count: 10 }, // Wednesday W10
      { id: 'c3', date: '2026-03-09', max_capacity: 10, booked_count: 5 },  // Monday W11
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: classes, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/reports/attendance?from=2026-03-01&to=2026-03-15`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.attendance.length).toBeGreaterThanOrEqual(1)
  })

  it('uses default date range when params not provided', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/reports/attendance`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.attendance).toEqual([])
  })
})

// ─── GET /:studioId/reports/revenue ─────────────────────────────────────────

describe('GET /api/studios/:studioId/reports/revenue', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns monthly revenue grouped by type', async () => {
    const payments = [
      { amount_cents: 5000, type: 'subscription', created_at: '2026-02-15T10:00:00Z' },
      { amount_cents: 2500, type: 'drop_in', created_at: '2026-02-20T10:00:00Z' },
      { amount_cents: 10000, type: 'class_pack', created_at: '2026-03-01T10:00:00Z' },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: payments, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/reports/revenue?from=2026-02-01&to=2026-03-31`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.revenue).toHaveLength(2)
    const feb = body.revenue.find((r: any) => r.month === '2026-02')
    expect(feb.revenue).toBe(7500)
    expect(feb.memberships).toBe(5000)
    expect(feb.dropins).toBe(2500)
    const mar = body.revenue.find((r: any) => r.month === '2026-03')
    expect(mar.packs).toBe(10000)
  })
})

// ─── GET /:studioId/reports/popular-classes ─────────────────────────────────

describe('GET /api/studios/:studioId/reports/popular-classes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns top classes sorted by avg attendance', async () => {
    const classes = [
      { template_id: 'tpl-1', max_capacity: 10, booked_count: 9, template: { name: 'Yoga' } },
      { template_id: 'tpl-1', max_capacity: 10, booked_count: 8, template: { name: 'Yoga' } },
      { template_id: 'tpl-2', max_capacity: 15, booked_count: 5, template: { name: 'Pilates' } },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: classes, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/reports/popular-classes`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.classes).toHaveLength(2)
    // Yoga should be first (avg 8.5 > Pilates avg 5)
    expect(body.classes[0].name).toBe('Yoga')
    expect(body.classes[0].avgAttendance).toBe(8.5)
    expect(body.classes[1].name).toBe('Pilates')
  })
})

// ─── GET /:studioId/reports/at-risk ─────────────────────────────────────────

describe('GET /api/studios/:studioId/reports/at-risk', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns members with no recent attendance', async () => {
    const members = [
      { user_id: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@e.com' } },
      { user_id: 'u2', user: { id: 'u2', name: 'Bob', email: 'bob@e.com' } },
    ]
    const recentAttendance = [{ user_id: 'u1', checked_in_at: '2026-02-27T10:00:00Z' }]

    let fromCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: members, error: null })
        }
        if (table === 'attendance') {
          fromCallCount++
          if (fromCallCount <= 1) {
            // Recent attendance query
            return makeAsyncChain({ data: recentAttendance, error: null })
          }
          // Individual last attendance query for at-risk members
          return makeAsyncChain({ data: { checked_in_at: '2026-02-01T10:00:00Z' }, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/reports/at-risk`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    // u1 has recent attendance, so only u2 (Bob) should be at-risk
    expect(body.members).toHaveLength(1)
    expect(body.members[0].name).toBe('Bob')
  })
})
