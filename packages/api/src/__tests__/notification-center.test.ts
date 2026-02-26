import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../index'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'test@example.com' })
    await next()
  }),
}))
vi.mock('../lib/push', () => ({
  registerPushToken: vi.fn().mockResolvedValue(undefined),
  unregisterPushToken: vi.fn().mockResolvedValue(undefined),
}))

import { createServiceClient } from '../lib/supabase'

const authHeader = { Authorization: 'Bearer test-token' }

/**
 * Build a fluent Supabase chain that resolves to `resolvedValue` at any terminal step.
 * Supports arbitrary chaining depth: .select().eq().not().order().limit().is() etc.
 */
function makeFluentChain(resolvedValue: unknown): any {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make the chain itself thenable (awaitable)
        return (res: (v: unknown) => void) => Promise.resolve(resolvedValue).then(res)
      }
      if (prop === 'catch') {
        return (rej: (e: unknown) => void) => Promise.resolve(resolvedValue).catch(rej)
      }
      // Any method call returns a new fluent chain with the same resolved value
      return () => makeFluentChain(resolvedValue)
    },
  }
  return new Proxy({}, handler)
}

function makeSupabaseMock({
  notifications = [] as unknown[],
  single = null as unknown,
  count = 0,
} = {}) {
  return {
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockImplementation((_fields: string, opts?: any) => {
        if (opts?.head) {
          // count query used by /count endpoint
          return makeFluentChain({ count, error: null })
        }
        return makeFluentChain({ data: notifications, error: null })
      }),
      update: vi.fn().mockReturnValue(makeFluentChain({ error: null })),
      // single-row fetch (for mark-read by id)
      single: vi.fn().mockResolvedValue({ data: single, error: null }),
    })),
  }
}

/**
 * Mock that returns the `single` value for single-row queries and `notifications` for list queries.
 */
function makeMixedMock({
  notifications = [] as unknown[],
  single = null as unknown,
  count = 0,
} = {}) {
  return {
    from: vi.fn().mockImplementation((_table: string) => {
      const selectFn = vi.fn().mockImplementation((_fields: string, opts?: any) => {
        if (opts?.head) {
          return makeFluentChain({ count, error: null })
        }
        // Return a chain that settles to notifications list, but with a .single() shortcut
        const listChain = makeFluentChain({ data: notifications, error: null })
        // Patch .single() on the chain proxy — override the proxy's .single
        return new Proxy({}, {
          get(_t, prop) {
            if (prop === 'then') return (res: (v: unknown) => void) => Promise.resolve({ data: notifications, error: null }).then(res)
            if (prop === 'single') return () => Promise.resolve({ data: single, error: null })
            return () => new Proxy({}, {
              get(_t2, p2) {
                if (p2 === 'then') return (res: (v: unknown) => void) => Promise.resolve({ data: notifications, error: null }).then(res)
                if (p2 === 'single') return () => Promise.resolve({ data: single, error: null })
                return () => makeFluentChain({ data: notifications, error: null })
              },
            })
          },
        })
      })
      return {
        select: selectFn,
        update: vi.fn().mockReturnValue(makeFluentChain({ error: null })),
      }
    }),
  }
}

describe('GET /api/my/notifications', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of sent notifications', async () => {
    const notifs = [{ id: 'n1', type: 'booking_confirmed', title: 'Hi', body: 'Hey', sent_at: new Date().toISOString(), read_at: null }]
    vi.mocked(createServiceClient).mockReturnValue(makeSupabaseMock({ notifications: notifs }) as any)

    const res = await app.request('/api/my/notifications', { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications).toHaveLength(1)
    expect(body.notifications[0].id).toBe('n1')
  })

  it('returns empty array when no notifications', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSupabaseMock({ notifications: [] }) as any)

    const res = await app.request('/api/my/notifications', { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications).toHaveLength(0)
  })

  it('filters to unread when ?unread=true', async () => {
    const notifs = [{ id: 'n2', read_at: null }]
    vi.mocked(createServiceClient).mockReturnValue(makeSupabaseMock({ notifications: notifs }) as any)

    const res = await app.request('/api/my/notifications?unread=true', { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications).toHaveLength(1)
  })
})

describe('GET /api/my/notifications/count', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns unread count', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSupabaseMock({ count: 3 }) as any)

    const res = await app.request('/api/my/notifications/count', { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.unreadCount).toBe(3)
  })

  it('returns 0 when no unread notifications', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSupabaseMock({ count: 0 }) as any)

    const res = await app.request('/api/my/notifications/count', { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.unreadCount).toBe(0)
  })
})

describe('POST /api/my/notifications/:id/read', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('marks notification as read', async () => {
    const notif = { id: 'n1', user_id: 'user-1', read_at: null }
    vi.mocked(createServiceClient).mockReturnValue(makeMixedMock({ single: notif }) as any)

    const res = await app.request('/api/my/notifications/n1/read', {
      method: 'POST',
      headers: authHeader,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.read).toBe(true)
  })

  it('returns 404 for unknown notification', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeMixedMock({ single: null }) as any)

    const res = await app.request('/api/my/notifications/unknown/read', {
      method: 'POST',
      headers: authHeader,
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/my/notifications/read-all', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('marks all notifications as read', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeSupabaseMock() as any)

    const res = await app.request('/api/my/notifications/read-all', {
      method: 'POST',
      headers: authHeader,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.markedRead).toBe(true)
  })
})

describe('POST /api/my/push-token', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('registers a push token', async () => {
    const res = await app.request('/api/my/push-token', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ExponentPushToken[xxx]', platform: 'ios' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.registered).toBe(true)
  })

  it('rejects missing token', async () => {
    const res = await app.request('/api/my/push-token', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'ios' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects invalid platform', async () => {
    const res = await app.request('/api/my/push-token', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ExponentPushToken[xxx]', platform: 'web' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/my/push-token', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('unregisters a push token', async () => {
    const res = await app.request('/api/my/push-token', {
      method: 'DELETE',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'ExponentPushToken[xxx]' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.unregistered).toBe(true)
  })

  it('rejects missing token', async () => {
    const res = await app.request('/api/my/push-token', {
      method: 'DELETE',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
