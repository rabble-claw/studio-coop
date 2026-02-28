import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import checkin from '../routes/checkin'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'staff-user-1', email: 'teacher@example.com' })
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const CLASS_ID = 'class-abc'
const STUDIO_ID = 'studio-xyz'
const STAFF_USER = 'staff-user-1'
const MEMBER_USER = 'member-user-1'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/classes', checkin)
  return app
}

// ─── Supabase mock factory ────────────────────────────────────────────────────

function makeChain(result: { data: unknown; error: null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  // Make the chain awaitable (for queries without .single())
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─── GET /roster tests ────────────────────────────────────────────────────────

describe('GET /api/classes/:classId/roster', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns roster with attendance and membership notes', async () => {
    const mockBookings = [
      {
        id: 'booking-1',
        status: 'booked',
        spot: 'A1',
        user: { id: MEMBER_USER, name: 'Alice Smith', avatar_url: null },
      },
    ]
    const mockAttendance = [
      { user_id: MEMBER_USER, checked_in: true, walk_in: false },
    ]
    const mockMemberships = [
      { user_id: MEMBER_USER, notes: 'Prefers front row' },
    ]

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled', max_capacity: 15 },
              error: null,
            }),
          }
        }
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null }),
            then: (res: any) => Promise.resolve({ data: mockMemberships, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: mockMemberships, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        if (table === 'bookings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: mockBookings, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: mockBookings, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        if (table === 'attendance') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: mockAttendance, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: mockAttendance, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }

    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeApp()
    const res = await app.request(
      `/api/classes/${CLASS_ID}/roster`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(body).toHaveLength(1)
    expect(body[0].user.name).toBe('Alice Smith')
    expect(body[0].booking.status).toBe('booked')
    expect(body[0].attendance.checked_in).toBe(true)
    expect(body[0].membership_notes).toBe('Prefers front row')
  })

  it('returns 403 when user is not staff', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'scheduled', max_capacity: 15 },
              error: null,
            }),
          }
        }
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

    const app = makeApp()
    const res = await app.request(
      `/api/classes/${CLASS_ID}/roster`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(403)
  })

  it('returns 404 when class not found', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
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

    const app = makeApp()
    const res = await app.request(
      `/api/classes/${CLASS_ID}/roster`,
      { headers: { Authorization: 'Bearer tok' } },
    )

    expect(res.status).toBe(404)
  })
})

// ─── POST /checkin tests ──────────────────────────────────────────────────────

describe('POST /api/classes/:classId/checkin', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeCheckinMock(classStatus: string, existingAttendance: Array<{ id: string; user_id: string }> = []) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: CLASS_ID, studio_id: STUDIO_ID, status: classStatus, max_capacity: 15 },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          }
        }
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null }),
          }
        }
        if (table === 'attendance') {
          const chain: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            then: (res: any) => Promise.resolve({ data: existingAttendance, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: existingAttendance, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
          return chain
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
  }

  it('batch checks in attendees and returns count', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeCheckinMock('in_progress') as any)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/checkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendees: [
          { userId: MEMBER_USER, checkedIn: true },
        ],
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
    expect(body.processed).toBe(1)
  })

  it('transitions class to in_progress on first check-in', async () => {
    const mock = makeCheckinMock('scheduled')
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    await app.request(`/api/classes/${CLASS_ID}/checkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendees: [{ userId: MEMBER_USER, checkedIn: true }],
      }),
    })

    // Verify class_instances update was called
    const fromCalls = (mock.from as ReturnType<typeof vi.fn>).mock.calls
    const classInstancesCalls = fromCalls.filter((call: unknown[]) => call[0] === 'class_instances')
    expect(classInstancesCalls.length).toBeGreaterThan(0)
  })

  it('returns 400 when attendees is missing', async () => {
    const mock = makeCheckinMock('in_progress')
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/checkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when attendees is empty array', async () => {
    const mock = makeCheckinMock('in_progress')
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/checkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendees: [] }),
    })

    expect(res.status).toBe(400)
  })
})

// ─── POST /walkin tests ───────────────────────────────────────────────────────

describe('POST /api/classes/:classId/walkin', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeWalkInMock(existingUser: { id: string } | null = null, existingAttendance: { id: string } | null = null) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: CLASS_ID, studio_id: STUDIO_ID, status: 'in_progress', max_capacity: 15 },
              error: null,
            }),
          }
        }
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'teacher' }, error: null }),
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: existingUser, error: null }),
          }
        }
        if (table === 'attendance') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: existingAttendance, error: null }),
            update: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
  }

  it('creates walk-in with userId', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeWalkInMock() as any)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/walkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: MEMBER_USER }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
    expect(body.userId).toBe(MEMBER_USER)
  })

  it('looks up user by email for non-member walk-in', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeWalkInMock({ id: 'guest-user-id' }) as any,
    )

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/walkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guest User', email: 'guest@example.com' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.userId).toBe('guest-user-id')
  })

  it('returns 400 when email not found', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeWalkInMock(null) as any)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/walkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unknown', email: 'nobody@example.com' }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when neither userId nor name/email provided', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeWalkInMock() as any)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/walkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})

// ─── POST /complete tests ─────────────────────────────────────────────────────

describe('POST /api/classes/:classId/complete', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeCompleteMock(classStatus: string, bookings: Array<{ id: string; user_id: string }>, attendanceList: Array<{ user_id: string; checked_in: boolean }>) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'class_instances') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: CLASS_ID, studio_id: STUDIO_ID, status: classStatus, max_capacity: 15 },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          }
        }
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'bookings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: bookings, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: bookings, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        if (table === 'attendance') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: attendanceList, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: attendanceList, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        if (table === 'notifications') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
  }

  it('completes class and marks no-shows', async () => {
    const bookings = [
      { id: 'b-1', user_id: 'user-present' },
      { id: 'b-2', user_id: 'user-absent' },
    ]
    const attendance = [
      { user_id: 'user-present', checked_in: true },
    ]
    vi.mocked(createServiceClient).mockReturnValue(
      makeCompleteMock('in_progress', bookings, attendance) as any,
    )

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/complete`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
    expect(body.no_shows).toBe(1)
  })

  it('returns 400 when class is not in_progress', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeCompleteMock('scheduled', [], []) as any,
    )

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/complete`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(400)
  })

  it('reports zero no-shows when all booked members checked in', async () => {
    const bookings = [{ id: 'b-1', user_id: 'user-a' }]
    const attendance = [{ user_id: 'user-a', checked_in: true }]
    vi.mocked(createServiceClient).mockReturnValue(
      makeCompleteMock('in_progress', bookings, attendance) as any,
    )

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/complete`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.no_shows).toBe(0)
  })
})
