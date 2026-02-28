import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import schedule from '../routes/schedule'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/class-generator', () => ({ generateClassInstances: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'admin@example.com' })
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

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', schedule)
  app.route('/', schedule)
  return app
}

const mockInstances = [
  {
    id: 'inst-1',
    date: '2026-03-02',
    start_time: '09:00',
    end_time: '10:00:00',
    status: 'scheduled',
    max_capacity: 15,
    notes: null,
    feed_enabled: true,
    teacher_id: 'teacher-1',
    template_id: 'tpl-1',
    template: { id: 'tpl-1', name: 'Morning Yoga', description: null, recurrence: 'weekly' },
    teacher: { id: 'teacher-1', name: 'Jane Doe', avatar_url: null },
    bookings: [{ count: 8 }],
  },
  {
    id: 'inst-2',
    date: '2026-03-04',
    start_time: '18:00',
    end_time: '19:00:00',
    status: 'scheduled',
    max_capacity: 12,
    notes: null,
    feed_enabled: true,
    teacher_id: 'teacher-2',
    template_id: 'tpl-2',
    template: { id: 'tpl-2', name: 'Evening BJJ', description: null, recurrence: 'weekly' },
    teacher: { id: 'teacher-2', name: 'John Smith', avatar_url: null },
    bookings: [{ count: 12 }],
  },
]

function makeSupabaseMock(instances: unknown[]) {
  const queryChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    // Final resolution
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: instances, error: null }).then(resolve),
    catch: (rej: (e: unknown) => void) =>
      Promise.resolve({ data: instances, error: null }).catch(rej),
    [Symbol.toStringTag]: 'Promise',
  }

  // eq/gte/lte/order all need to be chainable and still be thenable
  const makeChainable = (obj: typeof queryChain) => {
    const chainable = { ...obj }
    chainable.eq = vi.fn().mockReturnValue(chainable)
    chainable.gte = vi.fn().mockReturnValue(chainable)
    chainable.lte = vi.fn().mockReturnValue(chainable)
    chainable.order = vi.fn().mockReturnValue(chainable)
    return chainable
  }

  const chain = makeChainable(queryChain)

  return {
    from: vi.fn(() => ({ select: vi.fn().mockReturnValue(chain) })),
  }
}

describe('GET /api/studios/:studioId/schedule', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns class instances with booking counts for a date range', async () => {
    const mock = makeSupabaseMock(mockInstances)
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/schedule?from=2026-03-01&to=2026-03-14`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)

    // Booking counts are normalized from [{count: N}] to number
    expect(body[0].booking_count).toBe(8)
    expect(body[1].booking_count).toBe(12)

    // Template and teacher info included
    expect(body[0].template.name).toBe('Morning Yoga')
    expect(body[0].teacher.name).toBe('Jane Doe')
  })

  it('filters by day-of-week', async () => {
    // inst-1 is 2026-03-02 (Monday=1), inst-2 is 2026-03-04 (Wednesday=3)
    const mock = makeSupabaseMock(mockInstances)
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/schedule?from=2026-03-01&to=2026-03-14&day=1`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('inst-1')
  })

  it('returns 400 when from or to are missing', async () => {
    const mock = makeSupabaseMock([])
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()

    const res1 = await app.request(
      `/api/studios/${STUDIO_ID}/schedule?to=2026-03-14`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res1.status).toBe(400)

    const res2 = await app.request(
      `/api/studios/${STUDIO_ID}/schedule?from=2026-03-01`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res2.status).toBe(400)
  })

  it('returns 400 when from is after to', async () => {
    const mock = makeSupabaseMock([])
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/schedule?from=2026-03-14&to=2026-03-01`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(400)
  })

  it('includes booking count as a number (normalized from PostgREST format)', async () => {
    const instanceWithCount = [{ ...mockInstances[0], bookings: [{ count: 5 }] }]
    const mock = makeSupabaseMock(instanceWithCount)
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/schedule?from=2026-03-01&to=2026-03-07`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    const body = await res.json()
    expect(typeof body[0].booking_count).toBe('number')
    expect(body[0].booking_count).toBe(5)
    // Raw bookings array should not be present
    expect(body[0].bookings).toBeUndefined()
  })
})
