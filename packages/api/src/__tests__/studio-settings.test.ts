import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../index'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'owner@example.com' })
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireOwner: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
  requireAdmin: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
  requireMember: vi.fn().mockImplementation(async (c: any, next: any) => await next()),
  requireStaff: vi.fn().mockImplementation(async (c: any, next: any) => await next()),
}))

import { createServiceClient } from '../lib/supabase'

const authHeader = { Authorization: 'Bearer test-token' }

function makeStudioMock(settings: Record<string, unknown> = {}, notFound = false) {
  const chain = {
    single: vi.fn().mockResolvedValue(notFound ? { data: null, error: null } : { data: { settings }, error: null }),
  }
  const selectChain = { eq: vi.fn().mockReturnValue(chain) }
  const updateSelectChain = { eq: vi.fn().mockResolvedValue({ error: null }) }

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateSelectChain),
    }),
  }
}

const STUDIO_ID = 'studio-abc'

describe('GET /api/studios/:studioId/settings/notifications', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns default settings when studio has none configured', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeStudioMock({}) as any)

    const res = await app.request(`/api/studios/${STUDIO_ID}/settings/notifications`, { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications).toMatchObject({
      reminderHours: [24, 2],
      confirmationEnabled: true,
      reengagementEnabled: true,
      reengagementDays: 14,
      feedNotifications: true,
    })
  })

  it('returns merged custom settings over defaults', async () => {
    const settings = { notifications: { reengagementEnabled: false, reengagementDays: 30 } }
    vi.mocked(createServiceClient).mockReturnValue(makeStudioMock(settings) as any)

    const res = await app.request(`/api/studios/${STUDIO_ID}/settings/notifications`, { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications.reengagementEnabled).toBe(false)
    expect(body.notifications.reengagementDays).toBe(30)
    expect(body.notifications.confirmationEnabled).toBe(true)  // default preserved
  })

  it('returns 404 for unknown studio', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeStudioMock({}, true) as any)

    const res = await app.request(`/api/studios/nonexistent/settings/notifications`, { headers: authHeader })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/studios/:studioId/settings/notifications', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates notification settings', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeStudioMock({}) as any)

    const res = await app.request(`/api/studios/${STUDIO_ID}/settings/notifications`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reengagementEnabled: false, reengagementDays: 21 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications.reengagementEnabled).toBe(false)
    expect(body.notifications.reengagementDays).toBe(21)
  })

  it('ignores unknown keys in request body', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeStudioMock({}) as any)

    const res = await app.request(`/api/studios/${STUDIO_ID}/settings/notifications`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknownField: 'hacked', confirmationEnabled: false }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications).not.toHaveProperty('unknownField')
    expect(body.notifications.confirmationEnabled).toBe(false)
  })

  it('preserves existing settings not in request', async () => {
    const existing = { notifications: { reengagementDays: 30 } }
    vi.mocked(createServiceClient).mockReturnValue(makeStudioMock(existing) as any)

    const res = await app.request(`/api/studios/${STUDIO_ID}/settings/notifications`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmationEnabled: false }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications.reengagementDays).toBe(30)  // preserved
    expect(body.notifications.confirmationEnabled).toBe(false)  // updated
  })

  it('returns 404 when studio not found', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeStudioMock({}, true) as any)

    const res = await app.request(`/api/studios/nonexistent/settings/notifications`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reengagementEnabled: false }),
    })
    expect(res.status).toBe(404)
  })
})
