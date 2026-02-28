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
const CLASS_ID = 'class-xyz'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', schedule)
  app.route('/', schedule)
  return app
}

const existingClass = {
  id: CLASS_ID,
  studio_id: STUDIO_ID,
  status: 'scheduled',
  teacher_id: 'teacher-old',
  max_capacity: 15,
}

describe('PUT /api/studios/:studioId/classes/:classId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeChain({
    classData = existingClass as unknown,
    updated = existingClass as unknown,
    bookings = [] as unknown[],
    updateError = null,
  }: {
    classData?: unknown
    updated?: unknown
    bookings?: unknown[]
    updateError?: unknown
  }) {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const updateSelectSingleMock = vi.fn().mockResolvedValue({
      data: updated,
      error: updateError,
    })
    const updateSelectMock = vi.fn().mockReturnValue({ single: updateSelectSingleMock })
    const updateEqMock = vi.fn().mockReturnValue({ select: updateSelectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

    let fromCallCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        fromCallCount++
        if (table === 'class_instances' && fromCallCount === 1) {
          // Initial fetch
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: classData, error: null }),
          }
        }
        if (table === 'class_instances' && fromCallCount >= 2) {
          // Update
          return { update: updateMock }
        }
        if (table === 'bookings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({ data: bookings, error: null }),
          }
        }
        if (table === 'notifications') {
          return { insert: insertMock }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
      _insertMock: insertMock,
    }
    return mock
  }

  it('updates teacher_id for a teacher sub', async () => {
    const mock = makeChain({ updated: { ...existingClass, teacher_id: 'teacher-new' } })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_id: 'teacher-new' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.teacher_id).toBe('teacher-new')
  })

  it('updates max_capacity', async () => {
    const mock = makeChain({ updated: { ...existingClass, max_capacity: 20 } })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_capacity: 20 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.max_capacity).toBe(20)
  })

  it('cancels class and sends notifications to booked members', async () => {
    const bookedMembers = [
      { user_id: 'member-1' },
      { user_id: 'member-2' },
    ]
    const mock = makeChain({
      updated: { ...existingClass, status: 'cancelled' },
      bookings: bookedMembers,
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', notes: 'Studio closed today' }),
    })

    expect(res.status).toBe(200)
    // Notifications should have been inserted
    expect(mock._insertMock).toHaveBeenCalledTimes(1)
    const insertCall = mock._insertMock.mock.calls[0][0] as any[]
    expect(insertCall).toHaveLength(2)
    expect(insertCall[0].user_id).toBe('member-1')
    expect(insertCall[0].type).toBe('class_cancelled')
  })

  it('returns 404 when class not found', async () => {
    const mock = makeChain({ classData: null })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'hi' }),
    })

    expect(res.status).toBe(404)
  })

  it('rejects invalid status values', async () => {
    const mock = makeChain({})
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unknown_status' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toMatch(/invalid status/i)
  })

  it('rejects when no valid fields provided', async () => {
    const mock = makeChain({})
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/classes/${CLASS_ID}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: 'value' }),
    })

    expect(res.status).toBe(400)
  })
})
