import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import scheduleEfficiency from '../routes/schedule-efficiency'
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
    c.set('memberRole', 'admin')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', scheduleEfficiency)
  return app
}

function makeAsyncChain(result: { data?: unknown; error?: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

describe('GET /api/studios/:studioId/schedule/efficiency', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns schedule analysis with underbooked classes', async () => {
    const instances = [
      { id: 'c1', date: '2026-03-01', start_time: '09:00', end_time: '10:00', max_capacity: 20, booked_count: 5, status: 'completed', template: { id: 't1', name: 'Morning Yoga', day_of_week: 1 }, teacher: { id: 'teacher1', name: 'Jane' } },
      { id: 'c2', date: '2026-03-08', start_time: '09:00', end_time: '10:00', max_capacity: 20, booked_count: 4, status: 'completed', template: { id: 't1', name: 'Morning Yoga', day_of_week: 1 }, teacher: { id: 'teacher1', name: 'Jane' } },
      { id: 'c3', date: '2026-03-01', start_time: '18:00', end_time: '19:00', max_capacity: 15, booked_count: 15, status: 'completed', template: { id: 't2', name: 'Evening Flow', day_of_week: 1 }, teacher: { id: 'teacher2', name: 'Sam' } },
      { id: 'c4', date: '2026-03-08', start_time: '18:00', end_time: '19:00', max_capacity: 15, booked_count: 14, status: 'completed', template: { id: 't2', name: 'Evening Flow', day_of_week: 1 }, teacher: { id: 'teacher2', name: 'Sam' } },
    ]

    const chain = makeAsyncChain({ data: instances })
    ;(createServiceClient as any).mockReturnValue({ from: () => chain })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/schedule/efficiency`)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.total_classes).toBe(4)

    // Morning Yoga should be underbooked (avg fill rate ~22%)
    expect(body.underbooked.length).toBeGreaterThanOrEqual(1)
    const morningYoga = body.underbooked.find((c: any) => c.name === 'Morning Yoga')
    expect(morningYoga).toBeDefined()
    expect(morningYoga.avgFillRate).toBeLessThan(50)

    // Evening Flow should be overbooked (at or near capacity)
    expect(body.overbooked.length).toBeGreaterThanOrEqual(1)
    const eveningFlow = body.overbooked.find((c: any) => c.name === 'Evening Flow')
    expect(eveningFlow).toBeDefined()

    // Instructor utilization should include both teachers
    expect(body.instructorUtilization).toHaveLength(2)
  })

  it('returns empty analysis for studio with no classes', async () => {
    const chain = makeAsyncChain({ data: [] })
    ;(createServiceClient as any).mockReturnValue({ from: () => chain })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/schedule/efficiency`)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.total_classes).toBe(0)
    expect(body.underbooked).toHaveLength(0)
    expect(body.overbooked).toHaveLength(0)
  })

  it('respects weeks query parameter', async () => {
    const chain = makeAsyncChain({ data: [] })
    const mockFrom = vi.fn(() => chain)
    ;(createServiceClient as any).mockReturnValue({ from: mockFrom })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/schedule/efficiency?weeks=8`)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.period_weeks).toBe(8)
  })
})
