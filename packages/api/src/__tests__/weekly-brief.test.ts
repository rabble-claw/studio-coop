import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import weeklyBrief from '../routes/weekly-brief'
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
  app.route('/api/studios', weeklyBrief)
  return app
}

function makeAsyncChain(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

describe('GET /api/studios/:studioId/briefs', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of briefs', async () => {
    const briefs = [
      { id: 'b1', week_start: '2026-03-02', data: {}, narrative: 'A great week!', created_at: '2026-03-02' },
      { id: 'b2', week_start: '2026-02-23', data: {}, narrative: 'Steady week.', created_at: '2026-02-23' },
    ]

    const chain = makeAsyncChain({ data: briefs })
    ;(createServiceClient as any).mockReturnValue({ from: () => chain })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/briefs`)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.briefs).toHaveLength(2)
    expect(body.briefs[0].narrative).toBe('A great week!')
  })
})

describe('GET /api/studios/:studioId/briefs/latest', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns latest brief', async () => {
    const brief = { id: 'b1', week_start: '2026-03-02', data: { revenue: 5000 }, narrative: 'Good week!' }

    const chain = makeAsyncChain({ data: brief })
    ;(createServiceClient as any).mockReturnValue({ from: () => chain })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/briefs/latest`)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.brief.narrative).toBe('Good week!')
  })

  it('returns 404 when no brief exists', async () => {
    const chain = makeAsyncChain({ data: null })
    ;(createServiceClient as any).mockReturnValue({ from: () => chain })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/briefs/latest`)
    expect(res.status).toBe(404)
  })
})
