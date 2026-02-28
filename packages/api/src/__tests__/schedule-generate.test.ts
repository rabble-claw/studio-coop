import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import schedule from '../routes/schedule'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/class-generator', () => ({
  generateClassInstances: vi.fn(),
}))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'owner@example.com' })
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
  requireAdmin: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
    await next()
  }),
}))

import { generateClassInstances } from '../lib/class-generator'

const STUDIO_ID = 'studio-abc'
const ADMIN_KEY = 'test-admin-key'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', schedule)
  app.route('/', schedule)
  return app
}

describe('POST /api/admin/generate-classes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLATFORM_ADMIN_KEY = ADMIN_KEY
  })

  it('rejects requests without valid admin key', async () => {
    const app = makeApp()
    const res = await app.request('/api/admin/generate-classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-key' },
      body: JSON.stringify({ studioId: STUDIO_ID }),
    })
    expect(res.status).toBe(403)
  })

  it('rejects when no studioId provided', async () => {
    const app = makeApp()
    const res = await app.request('/api/admin/generate-classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_KEY}` },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('generates instances for a studio and returns count', async () => {
    vi.mocked(generateClassInstances).mockResolvedValue(12)

    const app = makeApp()
    const res = await app.request('/api/admin/generate-classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_KEY}` },
      body: JSON.stringify({ studioId: STUDIO_ID, weeksAhead: 4 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.generated).toBe(12)
    expect(body.studioId).toBe(STUDIO_ID)
    expect(generateClassInstances).toHaveBeenCalledWith(STUDIO_ID, 4)
  })

  it('is idempotent — running twice returns 0 on second run', async () => {
    vi.mocked(generateClassInstances)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(0) // second run finds no new dates

    const app = makeApp()

    const res1 = await app.request('/api/admin/generate-classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_KEY}` },
      body: JSON.stringify({ studioId: STUDIO_ID }),
    })
    const res2 = await app.request('/api/admin/generate-classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_KEY}` },
      body: JSON.stringify({ studioId: STUDIO_ID }),
    })

    expect((await res1.json()).generated).toBe(8)
    expect((await res2.json()).generated).toBe(0)
  })
})

describe('POST /api/studios/:studioId/generate-classes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('generates instances for the owner studio', async () => {
    vi.mocked(generateClassInstances).mockResolvedValue(7)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/generate-classes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ weeksAhead: 2 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.generated).toBe(7)
    expect(body.studioId).toBe(STUDIO_ID)
    expect(generateClassInstances).toHaveBeenCalledWith(STUDIO_ID, 2)
  })

  it('defaults to 4 weeks when weeksAhead not provided', async () => {
    vi.mocked(generateClassInstances).mockResolvedValue(0)

    const app = makeApp()
    await app.request(`/api/studios/${STUDIO_ID}/generate-classes`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(generateClassInstances).toHaveBeenCalledWith(STUDIO_ID, 4)
  })
})
