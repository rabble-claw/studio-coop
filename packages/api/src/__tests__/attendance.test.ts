import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import attendance from '../routes/attendance'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-staff', email: 'staff@example.com' })
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

const STUDIO_ID = 'studio-xyz'
const USER_ID = 'user-staff'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', attendance)
  app.route('/api/my', attendance)
  return app
}

// ─── Supabase chain helper ────────────────────────────────────────────────────

function makeAsyncChain(result: { data: unknown; error: null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─── Studio attendance tests ──────────────────────────────────────────────────

describe('GET /api/studios/:studioId/attendance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const mockInstances = [
    {
      id: 'inst-1',
      date: '2026-02-10',
      start_time: '09:00',
      status: 'completed',
      max_capacity: 15,
      template: { name: 'Morning Yoga' },
    },
    {
      id: 'inst-2',
      date: '2026-02-17',
      start_time: '09:00',
      status: 'completed',
      max_capacity: 15,
      template: { name: 'Morning Yoga' },
    },
  ]

  const mockAttendance = [
    { class_instance_id: 'inst-1', user_id: 'u1', checked_in: true, walk_in: false },
    { class_instance_id: 'inst-1', user_id: 'u2', checked_in: true, walk_in: true },
    { class_instance_id: 'inst-1', user_id: 'u3', checked_in: false, walk_in: false },
    { class_instance_id: 'inst-2', user_id: 'u4', checked_in: true, walk_in: false },
  ]

  const mockNoShows = [
    { class_instance_id: 'inst-1', user_id: 'u3' },
  ]

  function makeStudioAttMock() {
    let callCount = 0
    return {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return makeAsyncChain({ data: mockInstances, error: null })
        }
        if (table === 'attendance') {
          return makeAsyncChain({ data: mockAttendance, error: null })
        }
        if (table === 'bookings') {
          return makeAsyncChain({ data: mockNoShows, error: null })
        }
        callCount++
        return makeAsyncChain({ data: [], error: null })
      }),
    }
  }

  it('returns per-class attendance with stats', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeStudioAttMock() as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/attendance?from=2026-02-01&to=2026-02-28`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.classes).toHaveLength(2)

    // inst-1: 2 checked in (u1, u2), 1 walk-in (u2), 1 no-show (u3)
    const inst1 = body.classes.find((c: any) => c.id === 'inst-1')
    expect(inst1.checked_in).toBe(2)
    expect(inst1.walk_ins).toBe(1)
    expect(inst1.no_shows).toBe(1)

    // inst-2: 1 checked in
    const inst2 = body.classes.find((c: any) => c.id === 'inst-2')
    expect(inst2.checked_in).toBe(1)
    expect(inst2.no_shows).toBe(0)
  })

  it('calculates aggregate stats correctly', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeStudioAttMock() as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/attendance?from=2026-02-01&to=2026-02-28`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    const body = await res.json() as any
    const { stats } = body
    // 2 classes, total 3 checked-in (2 + 1), 1 no-show
    expect(stats.total_classes).toBe(2)
    expect(stats.avg_attendance).toBe(1.5) // (2+1)/2
    // no_show_rate: 1 no-show / (3 + 1 booked) = 25%
    expect(stats.no_show_rate).toBe(25)
  })

  it('returns empty result when no classes in range', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/attendance?from=2025-01-01&to=2025-01-07`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.classes).toHaveLength(0)
    expect(body.stats.total_classes).toBe(0)
    expect(body.stats.avg_attendance).toBe(0)
    expect(body.stats.no_show_rate).toBe(0)
  })

  it('returns 400 when from is missing', async () => {
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn() } as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/attendance?to=2026-02-28`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when from is after to', async () => {
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn() } as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/attendance?from=2026-03-01&to=2026-02-01`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(400)
  })
})

// ─── Personal attendance tests ────────────────────────────────────────────────

describe('GET /api/my/attendance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makePersonalAttMock(records: unknown[]) {
    return {
      from: vi.fn(() => makeAsyncChain({ data: records, error: null })),
    }
  }

  it('returns history sorted newest first', async () => {
    const records = [
      {
        id: 'att-1',
        class_instance_id: 'inst-1',
        walk_in: false,
        class_instance: {
          id: 'inst-1',
          date: '2026-02-10',
          start_time: '09:00',
          studio_id: 'studio-xyz',
          template: { name: 'Yoga' },
        },
      },
      {
        id: 'att-2',
        class_instance_id: 'inst-2',
        walk_in: false,
        class_instance: {
          id: 'inst-2',
          date: '2026-02-17',
          start_time: '09:00',
          studio_id: 'studio-xyz',
          template: { name: 'Yoga' },
        },
      },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makePersonalAttMock(records) as any)

    const app = makeApp()
    const res = await app.request('/api/my/attendance', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.history).toHaveLength(2)
    // newest first: Feb 17 before Feb 10
    expect(body.history[0].date).toBe('2026-02-17')
    expect(body.history[1].date).toBe('2026-02-10')
  })

  it('calculates monthly and yearly totals', async () => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth() + 1
    const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1
    const lastMonthYear = thisMonth === 1 ? thisYear - 1 : thisYear

    const records = [
      {
        id: 'att-1',
        class_instance_id: 'inst-1',
        walk_in: false,
        class_instance: {
          id: 'inst-1',
          date: `${thisYear}-${String(thisMonth).padStart(2, '0')}-05`,
          start_time: '09:00',
          studio_id: 'studio-xyz',
          template: { name: 'Yoga' },
        },
      },
      {
        id: 'att-2',
        class_instance_id: 'inst-2',
        walk_in: false,
        class_instance: {
          id: 'inst-2',
          date: `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-10`,
          start_time: '09:00',
          studio_id: 'studio-xyz',
          template: { name: 'Yoga' },
        },
      },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makePersonalAttMock(records) as any)

    const app = makeApp()
    const res = await app.request('/api/my/attendance', {
      headers: { Authorization: 'Bearer tok' },
    })

    const body = await res.json() as any
    expect(body.stats.total_this_month).toBe(1) // only this month
    expect(body.stats.total_this_year).toBe(lastMonthYear === thisYear ? 2 : 1)
  })

  it('calculates streak correctly for consecutive weeks', async () => {
    // Create records for the past 3 consecutive weeks
    const records = []
    const today = new Date()
    for (let w = 0; w < 3; w++) {
      const d = new Date(today)
      d.setDate(d.getDate() - w * 7)
      records.push({
        id: `att-${w}`,
        class_instance_id: `inst-${w}`,
        walk_in: false,
        class_instance: {
          id: `inst-${w}`,
          date: d.toISOString().slice(0, 10),
          start_time: '09:00',
          studio_id: 'studio-xyz',
          template: { name: 'Yoga' },
        },
      })
    }
    vi.mocked(createServiceClient).mockReturnValue(makePersonalAttMock(records) as any)

    const app = makeApp()
    const res = await app.request('/api/my/attendance', {
      headers: { Authorization: 'Bearer tok' },
    })

    const body = await res.json() as any
    expect(body.stats.streak_weeks).toBe(3)
  })

  it('returns zero streak when no recent attendance', async () => {
    // A record from 3 weeks ago with a gap (no current week or last week)
    const d = new Date()
    d.setDate(d.getDate() - 21) // 3 weeks ago
    const records = [{
      id: 'att-old',
      class_instance_id: 'inst-old',
      walk_in: false,
      class_instance: {
        id: 'inst-old',
        date: d.toISOString().slice(0, 10),
        start_time: '09:00',
        studio_id: 'studio-xyz',
        template: { name: 'Yoga' },
      },
    }]
    vi.mocked(createServiceClient).mockReturnValue(makePersonalAttMock(records) as any)

    const app = makeApp()
    const res = await app.request('/api/my/attendance', {
      headers: { Authorization: 'Bearer tok' },
    })

    const body = await res.json() as any
    // Streak should be 0 since there's a gap before the most recent attendance
    expect(body.stats.streak_weeks).toBe(0)
  })

  it('returns empty history with zero stats for new member', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makePersonalAttMock([]) as any)

    const app = makeApp()
    const res = await app.request('/api/my/attendance', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.history).toHaveLength(0)
    expect(body.stats.total_this_month).toBe(0)
    expect(body.stats.streak_weeks).toBe(0)
  })

  it('filters out records with null dates', async () => {
    const records = [
      {
        id: 'att-1',
        class_instance_id: 'inst-1',
        walk_in: false,
        class_instance: {
          id: 'inst-1',
          date: null, // no date
          start_time: '09:00',
          studio_id: 'studio-xyz',
          template: { name: 'Yoga' },
        },
      },
      {
        id: 'att-2',
        class_instance_id: 'inst-2',
        walk_in: false,
        class_instance: {
          id: 'inst-2',
          date: '2026-02-20',
          start_time: '09:00',
          studio_id: 'studio-xyz',
          template: { name: 'Yoga' },
        },
      },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makePersonalAttMock(records) as any)

    const app = makeApp()
    const res = await app.request('/api/my/attendance', {
      headers: { Authorization: 'Bearer tok' },
    })

    const body = await res.json() as any
    // Only the record with a valid date should be returned
    expect(body.history).toHaveLength(1)
    expect(body.history[0].date).toBe('2026-02-20')
  })

  it('includes walk_in flag in history', async () => {
    const records = [
      {
        id: 'att-walk',
        class_instance_id: 'inst-1',
        walk_in: true,
        class_instance: {
          id: 'inst-1',
          date: '2026-02-25',
          start_time: '10:00',
          studio_id: 'studio-xyz',
          template: { name: 'Pilates' },
        },
      },
    ]
    vi.mocked(createServiceClient).mockReturnValue(makePersonalAttMock(records) as any)

    const app = makeApp()
    const res = await app.request('/api/my/attendance', {
      headers: { Authorization: 'Bearer tok' },
    })

    const body = await res.json() as any
    expect(body.history[0].walk_in).toBe(true)
    expect(body.history[0].class_name).toBe('Pilates')
  })
})

// ─── Additional studio attendance tests ─────────────────────────────────────

describe('GET /api/studios/:studioId/attendance — date validation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when to is missing', async () => {
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn() } as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/attendance?from=2026-02-01`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn() } as any)

    const app = makeApp()
    const res = await app.request(
      `/api/studios/${STUDIO_ID}/attendance?from=02-2026-01&to=2026-02-28`,
      { headers: { Authorization: 'Bearer tok' } },
    )
    expect(res.status).toBe(400)
  })
})
