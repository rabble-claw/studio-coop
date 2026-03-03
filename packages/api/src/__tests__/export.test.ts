import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import exportRoute from '../routes/export'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))

// Default: auth passes
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'
import { authMiddleware } from '../middleware/auth'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api', exportRoute)
  return app
}

function makeFromMock(tableResults: Record<string, { data: unknown; error: unknown }>) {
  return {
    from: vi.fn((table: string) => {
      const result = tableResults[table] ?? { data: null, error: null }
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result),
      }
      // For tables that don't call .single(), resolve as a thenable
      chain.then = (res: any) => Promise.resolve(result).then(res)
      chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
      chain[Symbol.toStringTag] = 'Promise'
      return chain
    }),
  }
}

describe('GET /api/my/export', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns all user data categories with Content-Disposition header', async () => {
    const mock = makeFromMock({
      users: { data: { id: 'user-123', email: 'test@example.com', name: 'Test User', avatar_url: null, phone: null, created_at: '2026-01-01', updated_at: null }, error: null },
      memberships: { data: [{ id: 'mem-1', studio_id: 'studio-1', role: 'member', status: 'active', joined_at: '2026-01-01', studio: { name: 'Yoga Studio', slug: 'yoga' } }], error: null },
      bookings: { data: [{ id: 'bk-1', status: 'booked', waitlist_position: null, booked_at: '2026-01-15', confirmed_at: null, cancelled_at: null, class_instance: { date: '2026-01-20', start_time: '10:00:00', template: { name: 'Morning Flow' } } }], error: null },
      attendance: { data: [{ id: 'att-1', class_instance_id: 'ci-1', checked_in_at: '2026-01-20', checked_in_by: null, method: 'qr' }], error: null },
      subscriptions: { data: [{ id: 'sub-1', status: 'active', current_period_start: '2026-01-01', current_period_end: '2026-02-01', cancel_at_period_end: false, created_at: '2026-01-01', plan: { name: 'Unlimited', interval: 'month', price: 9900 } }], error: null },
      payments: { data: [{ id: 'pay-1', amount: 9900, currency: 'NZD', type: 'subscription', refunded: false, created_at: '2026-01-01', studio_id: 'studio-1' }], error: null },
      feed_posts: { data: [{ id: 'fp-1', class_instance_id: 'ci-1', content: 'Great class!', media_url: null, created_at: '2026-01-20' }], error: null },
      notification_preferences: { data: [{ id: 'np-1', studio_id: 'studio-1', channel: 'push', type: 'booking', enabled: true }], error: null },
      calendar_tokens: { data: [{ id: 'ct-1', studio_id: 'studio-1', created_at: '2026-01-01' }], error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/export', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="studio-coop-data-export.json"')

    const body = await res.json() as any
    expect(body.exported_at).toBeDefined()
    expect(body.user.id).toBe('user-123')
    expect(body.memberships).toHaveLength(1)
    expect(body.memberships[0].studio.name).toBe('Yoga Studio')
    expect(body.bookings).toHaveLength(1)
    expect(body.bookings[0].class_name).toBe('Morning Flow')
    expect(body.attendance).toHaveLength(1)
    expect(body.subscriptions).toHaveLength(1)
    expect(body.subscriptions[0].plan.name).toBe('Unlimited')
    expect(body.payments).toHaveLength(1)
    expect(body.feed_posts).toHaveLength(1)
    expect(body.notification_preferences).toHaveLength(1)
    expect(body.calendar_tokens).toHaveLength(1)
    // Calendar tokens should not expose the actual token value
    expect(body.calendar_tokens[0]).not.toHaveProperty('token')
  })

  it('returns 401 when unauthenticated', async () => {
    // Override auth middleware to reject
    vi.mocked(authMiddleware).mockImplementationOnce(async (c: any) => {
      return c.json({ error: { message: 'Unauthorized' } }, 401)
    })

    const app = makeApp()
    const res = await app.request('/api/my/export')

    expect(res.status).toBe(401)
  })

  it('returns empty arrays when user has no data', async () => {
    const mock = makeFromMock({
      users: { data: { id: 'user-123', email: 'test@example.com', name: 'New User', avatar_url: null, phone: null, created_at: '2026-01-01', updated_at: null }, error: null },
      memberships: { data: [], error: null },
      bookings: { data: [], error: null },
      attendance: { data: [], error: null },
      subscriptions: { data: [], error: null },
      payments: { data: [], error: null },
      feed_posts: { data: [], error: null },
      notification_preferences: { data: [], error: null },
      calendar_tokens: { data: [], error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/export', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.user.id).toBe('user-123')
    expect(body.memberships).toHaveLength(0)
    expect(body.bookings).toHaveLength(0)
    expect(body.attendance).toHaveLength(0)
    expect(body.subscriptions).toHaveLength(0)
    expect(body.payments).toHaveLength(0)
    expect(body.feed_posts).toHaveLength(0)
    expect(body.notification_preferences).toHaveLength(0)
    expect(body.calendar_tokens).toHaveLength(0)
  })

  it('only includes data belonging to the authenticated user', async () => {
    const mock = makeFromMock({
      users: { data: { id: 'user-123', email: 'test@example.com', name: 'Test', avatar_url: null, phone: null, created_at: '2026-01-01', updated_at: null }, error: null },
      memberships: { data: [], error: null },
      bookings: { data: [], error: null },
      attendance: { data: [], error: null },
      subscriptions: { data: [], error: null },
      payments: { data: [], error: null },
      feed_posts: { data: [], error: null },
      notification_preferences: { data: [], error: null },
      calendar_tokens: { data: [], error: null },
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/my/export', {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)

    // Verify that queries filter by user id
    const fromCalls = mock.from.mock.calls.map((c: any[]) => c[0])
    expect(fromCalls).toContain('users')
    expect(fromCalls).toContain('memberships')
    expect(fromCalls).toContain('bookings')
    expect(fromCalls).toContain('attendance')
    expect(fromCalls).toContain('subscriptions')
    expect(fromCalls).toContain('payments')
    expect(fromCalls).toContain('feed_posts')
    expect(fromCalls).toContain('notification_preferences')
    expect(fromCalls).toContain('calendar_tokens')
  })
})
