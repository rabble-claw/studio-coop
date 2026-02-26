import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import comps from '../routes/comps'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'staff-user-1', email: 'staff@example.com' })
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID  = 'studio-abc'
const MEMBER_ID  = 'member-user-1'
const STAFF_ID   = 'staff-user-1'
const COMP_ID    = 'comp-grant-1'

function makeStudioApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', comps)
  return app
}

function makeMyApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/my', comps)
  return app
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/studios/:studioId/members/:userId/comp
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/members/:userId/comp', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeGrantMock(membershipRole: string | null, insertedComp: object | null) {
    // requireStaff middleware calls .single() for the calling user (always admin)
    // The route then calls .maybeSingle() for the target user
    let membershipCallCount = 0
    return {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          membershipCallCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            // requireStaff (middleware) calls .single() — always return admin role
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
            // route handler calls .maybeSingle() for target user
            maybeSingle: vi.fn().mockResolvedValue({
              data: membershipRole ? { role: membershipRole } : null,
              error: null,
            }),
          }
        }
        if (table === 'comp_classes') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data:  insertedComp,
              error: insertedComp ? null : { message: 'DB error' },
            }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
  }

  it('grants comp classes to a member and returns 201', async () => {
    const mockComp = {
      id: COMP_ID,
      user_id: MEMBER_ID,
      studio_id: STUDIO_ID,
      granted_by: STAFF_ID,
      total_classes: 3,
      remaining_classes: 3,
      reason: 'Missed classes due to illness',
      expires_at: null,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeGrantMock('admin', mockComp) as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/${MEMBER_ID}/comp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: 3, reason: 'Missed classes due to illness' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.comp.total_classes).toBe(3)
    expect(body.comp.remaining_classes).toBe(3)
  })

  it('grants comp classes with expiry date', async () => {
    const expiresAt = '2026-12-31T23:59:59Z'
    const mockComp = {
      id: COMP_ID,
      user_id: MEMBER_ID,
      studio_id: STUDIO_ID,
      granted_by: STAFF_ID,
      total_classes: 5,
      remaining_classes: 5,
      reason: null,
      expires_at: expiresAt,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeGrantMock('staff', mockComp) as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/${MEMBER_ID}/comp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: 5, expiresAt }),
    })

    expect(res.status).toBe(201)
  })

  it('returns 400 when classes is missing', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeGrantMock('admin', null) as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/${MEMBER_ID}/comp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Goodwill' }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when classes is not a positive integer', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeGrantMock('admin', null) as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/${MEMBER_ID}/comp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: 0 }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 404 when target user is not a member of the studio', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeGrantMock(null, null) as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/${MEMBER_ID}/comp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: 2 }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 403 when caller is not staff', async () => {
    // requireStaff checks memberships.role for the calling user
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/${MEMBER_ID}/comp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: 1 }),
    })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/studios/:studioId/comps
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/studios/:studioId/comps', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of all comp grants for a studio', async () => {
    const mockComps = [
      {
        id: COMP_ID,
        total_classes: 3,
        remaining_classes: 2,
        reason: 'Goodwill',
        expires_at: null,
        created_at: '2026-01-01T00:00:00Z',
        member: { id: MEMBER_ID, name: 'Alice', email: 'alice@example.com', avatar_url: null },
        granted_by_user: { id: STAFF_ID, name: 'Staff Member' },
      },
    ]

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'comp_classes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: mockComps, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: mockComps, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/comps`, {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.comps).toHaveLength(1)
    expect(body.comps[0].id).toBe(COMP_ID)
    expect(body.comps[0].member.name).toBe('Alice')
  })

  it('returns 403 when caller is not staff', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/comps`, {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/studios/:studioId/comps/:compId
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/studios/:studioId/comps/:compId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('revokes comp grant by setting remaining_classes to 0', async () => {
    const updateMock = vi.fn().mockReturnThis()
    const eqMock = vi.fn().mockReturnThis()

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'comp_classes') {
          let callCount = 0
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(() => {
              callCount++
              // First call = find comp; second+ = update chain
              return Promise.resolve({ data: callCount === 1 ? { id: COMP_ID } : null, error: null })
            }),
            update: updateMock,
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/comps/${COMP_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.revoked).toBe(true)
    expect(body.compId).toBe(COMP_ID)
  })

  it('returns 404 when comp grant not found', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'comp_classes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeStudioApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/comps/${COMP_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/my/comps
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/my/comps', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns valid (non-expired, positive remaining) comp credits for the member', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const mockComps = [
      {
        id: 'comp-1',
        total_classes: 5,
        remaining_classes: 3,
        expires_at: futureDate,
        reason: 'Welcome gift',
        created_at: '2026-01-01T00:00:00Z',
        studio: { id: STUDIO_ID, name: 'Yoga Studio', slug: 'yoga-studio' },
      },
    ]

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'comp_classes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: mockComps, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: mockComps, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeMyApp()
    const res = await app.request('/api/my/comps', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.comps).toHaveLength(1)
    expect(body.comps[0].remaining_classes).toBe(3)
    expect(body.comps[0].studio.name).toBe('Yoga Studio')
  })

  it('filters out expired comp grants', async () => {
    const pastDate = new Date(Date.now() - 1).toISOString()
    const mockComps = [
      {
        id: 'comp-expired',
        total_classes: 5,
        remaining_classes: 2,
        expires_at: pastDate,
        reason: null,
        created_at: '2026-01-01T00:00:00Z',
        studio: { id: STUDIO_ID, name: 'Studio', slug: 'studio' },
      },
    ]

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'comp_classes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: mockComps, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: mockComps, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeMyApp()
    const res = await app.request('/api/my/comps', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.comps).toHaveLength(0)
  })

  it('returns comps with no expiry date (never expires)', async () => {
    const mockComps = [
      {
        id: 'comp-noexpiry',
        total_classes: 2,
        remaining_classes: 2,
        expires_at: null,
        reason: 'Promotional gift',
        created_at: '2026-01-01T00:00:00Z',
        studio: { id: STUDIO_ID, name: 'Studio', slug: 'studio' },
      },
    ]

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'comp_classes') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: mockComps, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: mockComps, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeMyApp()
    const res = await app.request('/api/my/comps', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.comps).toHaveLength(1)
    expect(body.comps[0].expires_at).toBeNull()
  })
})
