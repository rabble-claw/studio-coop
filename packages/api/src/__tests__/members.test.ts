import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import members from '../routes/members'
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
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
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
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', members)
  return app
}

function makeAsyncChain(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
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

// ─── GET /:studioId/members ───────────────────────────────────────────────────

describe('GET /api/studios/:studioId/members', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns paginated members with default filters', async () => {
    const memberships = [
      {
        id: 'mem-1', role: 'member', status: 'active', created_at: '2026-01-01T00:00:00Z', notes: null,
        user: { id: 'u1', name: 'Alice', email: 'alice@e.com', avatar_url: null, phone: null },
      },
      {
        id: 'mem-2', role: 'teacher', status: 'active', created_at: '2026-01-15T00:00:00Z', notes: 'Great teacher',
        user: { id: 'u2', name: 'Bob', email: 'bob@e.com', avatar_url: 'https://img.com/bob.jpg', phone: '+1234' },
      },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: memberships, error: null, count: 2 })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.members).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.members[0].name).toBe('Alice')
    expect(body.members[0].role).toBe('member')
    expect(body.members[1].name).toBe('Bob')
    expect(body.members[1].phone).toBe('+1234')
  })

  it('filters by role when query param provided', async () => {
    const memberships = [
      {
        id: 'mem-2', role: 'teacher', status: 'active', created_at: '2026-01-15T00:00:00Z', notes: null,
        user: { id: 'u2', name: 'Bob', email: 'bob@e.com', avatar_url: null, phone: null },
      },
    ]

    const chain = makeAsyncChain({ data: memberships, error: null, count: 1 })
    const mock = {
      from: vi.fn(() => chain),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members?role=teacher`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.members).toHaveLength(1)
    expect(body.members[0].role).toBe('teacher')
    // Verify eq was called with 'role', 'teacher'
    expect(chain.eq).toHaveBeenCalledWith('role', 'teacher')
  })

  it('filters by status when query param provided', async () => {
    const chain = makeAsyncChain({ data: [], error: null, count: 0 })
    const mock = {
      from: vi.fn(() => chain),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members?status=suspended`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.members).toEqual([])
    expect(body.total).toBe(0)
    // Verify in was called with status filter
    expect(chain.in).toHaveBeenCalledWith('status', ['suspended'])
  })

  it('searches members by name or email', async () => {
    const userSearchChain = makeAsyncChain({ data: [{ id: 'u1' }], error: null })
    const membershipChain = makeAsyncChain({
      data: [{
        id: 'mem-1', role: 'member', status: 'active', created_at: '2026-01-01T00:00:00Z', notes: null,
        user: { id: 'u1', name: 'Alice', email: 'alice@e.com', avatar_url: null, phone: null },
      }],
      error: null,
      count: 1,
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'users') return userSearchChain
        return membershipChain
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members?search=alice`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.members).toHaveLength(1)
    expect(body.members[0].name).toBe('Alice')
  })

  it('returns empty when search matches no users', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members?search=nonexistent`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.members).toEqual([])
    expect(body.total).toBe(0)
  })

  it('returns empty array when no members exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null, count: 0 })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.members).toEqual([])
    expect(body.total).toBe(0)
  })

  it('respects limit and offset params', async () => {
    const chain = makeAsyncChain({ data: [], error: null, count: 100 })
    const mock = {
      from: vi.fn(() => chain),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members?limit=10&offset=20`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    // Verify range was called with correct offset
    expect(chain.range).toHaveBeenCalledWith(20, 29)
  })

  it('handles FK join returning user as array', async () => {
    const memberships = [
      {
        id: 'mem-1', role: 'member', status: 'active', created_at: '2026-01-01T00:00:00Z', notes: null,
        user: [{ id: 'u1', name: 'Alice', email: 'alice@e.com', avatar_url: null, phone: null }],
      },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: memberships, error: null, count: 1 })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.members[0].name).toBe('Alice')
  })
})

// ─── GET /:studioId/members/:memberId ─────────────────────────────────────────

describe('GET /api/studios/:studioId/members/:memberId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns full member detail with history', async () => {
    const memberData = {
      id: 'mem-1', role: 'admin', status: 'active', created_at: '2026-01-01T00:00:00Z', notes: 'VIP',
      user: { id: 'u1', name: 'Alice', email: 'alice@e.com', avatar_url: 'https://img.com/a.jpg', phone: '+1234' },
    }

    const attendanceData = [
      {
        id: 'att-1', checked_in_at: '2026-03-01T10:00:00Z', walk_in: false, user_id: 'u1',
        class_instance: { id: 'ci-1', date: '2026-03-01', start_time: '10:00', template: { name: 'Yoga' } },
      },
    ]

    const subscriptionData = [
      {
        id: 'sub-1', status: 'active', current_period_start: '2026-03-01', current_period_end: '2026-04-01',
        plan: { id: 'plan-1', name: 'Monthly', price_cents: 9900, interval: 'month' },
      },
    ]

    const compData = [
      { id: 'comp-1', remaining: 3, reason: 'Welcome gift', granted_at: '2026-01-01T00:00:00Z', expires_at: '2026-06-01T00:00:00Z' },
    ]

    const bookingsData = [
      {
        id: 'bk-1', status: 'confirmed', created_at: '2026-02-28T10:00:00Z', user_id: 'u1',
        class_instance: { id: 'ci-2', date: '2026-03-02', start_time: '09:00', template: { name: 'Pilates' } },
      },
    ]

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: memberData, error: null })
        }
        if (table === 'attendance') {
          return makeAsyncChain({ data: attendanceData, error: null })
        }
        if (table === 'subscriptions') {
          return makeAsyncChain({ data: subscriptionData, error: null })
        }
        if (table === 'comp_classes') {
          return makeAsyncChain({ data: compData, error: null })
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: bookingsData, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/mem-1`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any

    // Member info
    expect(body.member.name).toBe('Alice')
    expect(body.member.email).toBe('alice@e.com')
    expect(body.member.role).toBe('admin')
    expect(body.member.notes).toBe('VIP')

    // Subscription
    expect(body.subscription).not.toBeNull()
    expect(body.subscription.plan.name).toBe('Monthly')

    // Comp grants
    expect(body.compGrants).toHaveLength(1)
    expect(body.compGrants[0].remaining).toBe(3)

    // Attendance
    expect(body.attendance).toHaveLength(1)
    expect(body.attendance[0].class_name).toBe('Yoga')

    // Bookings
    expect(body.recentBookings).toHaveLength(1)
    expect(body.recentBookings[0].class_name).toBe('Pilates')

    // Stats
    expect(body.stats.totalAttendance).toBe(1)
  })

  it('returns 404 when member not found', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: { code: 'PGRST116', message: 'not found' } })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/nonexistent`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
  })

  it('returns member with no subscription or attendance', async () => {
    const memberData = {
      id: 'mem-3', role: 'member', status: 'active', created_at: '2026-02-01T00:00:00Z', notes: null,
      user: { id: 'u3', name: 'Charlie', email: 'charlie@e.com', avatar_url: null, phone: null },
    }

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: memberData, error: null })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/mem-3`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.member.name).toBe('Charlie')
    expect(body.subscription).toBeNull()
    expect(body.compGrants).toEqual([])
    expect(body.attendance).toEqual([])
    expect(body.recentBookings).toEqual([])
    expect(body.stats.totalAttendance).toBe(0)
    expect(body.stats.attendanceThisMonth).toBe(0)
  })

  it('handles FK joins returning arrays for detail view', async () => {
    const memberData = {
      id: 'mem-1', role: 'member', status: 'active', created_at: '2026-01-01T00:00:00Z', notes: null,
      user: [{ id: 'u1', name: 'Alice', email: 'alice@e.com', avatar_url: null, phone: null }],
    }

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: memberData, error: null })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/mem-1`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.member.name).toBe('Alice')
  })
})

// ─── POST /:studioId/members/:memberId/notes ─────────────────────────────────

describe('POST /api/studios/:studioId/members/:memberId/notes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates member notes successfully', async () => {
    const membershipChain = makeAsyncChain({ data: { id: 'mem-1' }, error: null })
    const updateChain = makeAsyncChain({ data: null, error: null })

    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) return membershipChain
        return updateChain
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/mem-1/notes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Prefers morning classes' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.notes).toBe('Prefers morning classes')
  })

  it('returns 400 when note is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/mem-1/notes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/note/i)
  })

  it('returns 404 when membership not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: { code: 'PGRST116', message: 'not found' } })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/nonexistent/notes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'Test note' }),
    })
    expect(res.status).toBe(404)
  })

  it('allows empty string as note to clear notes', async () => {
    const membershipChain = makeAsyncChain({ data: { id: 'mem-1' }, error: null })
    const updateChain = makeAsyncChain({ data: null, error: null })

    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) return membershipChain
        return updateChain
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/mem-1/notes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.notes).toBe('')
  })

  it('handles invalid JSON body gracefully', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/mem-1/notes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})
