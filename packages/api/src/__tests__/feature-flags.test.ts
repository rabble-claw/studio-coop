import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../index'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'admin@example.com' })
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
const STUDIO_ID = 'studio-abc'
const FLAG_ID = 'flag-123'

const SAMPLE_FLAGS = [
  { id: 'f1', name: 'waitlist', description: 'Waitlist feature', enabled: true, scope: 'global', studio_id: null, plan_tier: null },
  { id: 'f2', name: 'network', description: 'Network features', enabled: false, scope: 'global', studio_id: null, plan_tier: null },
  { id: 'f3', name: 'waitlist', description: 'Studio override', enabled: false, scope: 'studio', studio_id: STUDIO_ID, plan_tier: null },
]

function makeMock(opts: {
  selectData?: any[]
  selectSingle?: any
  insertSingle?: any
  updateSingle?: any
  deleteError?: any
  studioPlanTier?: string
} = {}) {
  // Build a chainable mock that supports any order of .select/.eq/.order/.single calls
  function makeChainable(resolveData: any, resolveAsSingle = false) {
    const chainable: any = {}
    const makeSelf = () => chainable

    chainable.select = vi.fn().mockReturnValue(chainable)
    chainable.eq = vi.fn().mockReturnValue(chainable)
    chainable.order = vi.fn().mockReturnValue(chainable)
    chainable.insert = vi.fn().mockReturnValue(chainable)
    chainable.update = vi.fn().mockReturnValue(chainable)
    chainable.delete = vi.fn().mockReturnValue(chainable)
    chainable.single = vi.fn().mockResolvedValue({
      data: resolveAsSingle ? resolveData : null,
      error: null,
    })

    // Make it thenable so `await query` works (returns array data)
    chainable.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: resolveData, error: null }).then(resolve, reject)

    return chainable
  }

  const mock: any = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'studios') {
        return makeChainable({ plan_tier: opts.studioPlanTier ?? 'free' }, true)
      }
      // feature_flags table — support both list and single operations
      const chain = makeChainable(opts.selectData ?? SAMPLE_FLAGS)
      // Override single for insert/update operations
      chain.single = vi.fn().mockResolvedValue({
        data: opts.insertSingle ?? opts.updateSingle ?? opts.selectSingle ?? null,
        error: null,
      })
      // Override delete to use its own error
      chain.delete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: opts.deleteError ?? null }),
      })
      return chain
    }),
  }
  return mock
}

describe('Admin feature flags API', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('GET /api/admin/feature-flags', () => {
    it('returns all flags', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request('/api/admin/feature-flags', { headers: authHeader })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flags).toHaveLength(3)
      expect(body.flags[0].name).toBe('waitlist')
    })

    it('accepts scope filter', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request('/api/admin/feature-flags?scope=global', { headers: authHeader })
      expect(res.status).toBe(200)
    })

    it('accepts studio_id filter', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request(`/api/admin/feature-flags?studio_id=${STUDIO_ID}`, { headers: authHeader })
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api/admin/feature-flags', () => {
    it('creates a global flag', async () => {
      const newFlag = { id: 'new-1', name: 'new_feature', enabled: true, scope: 'global' }
      vi.mocked(createServiceClient).mockReturnValue(makeMock({ insertSingle: newFlag }) as any)

      const res = await app.request('/api/admin/feature-flags', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'new_feature', enabled: true }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.flag.name).toBe('new_feature')
    })

    it('rejects missing name', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request('/api/admin/feature-flags', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects invalid scope', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request('/api/admin/feature-flags', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', scope: 'invalid' }),
      })
      expect(res.status).toBe(400)
    })

    it('requires studio_id for studio scope', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request('/api/admin/feature-flags', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', scope: 'studio' }),
      })
      expect(res.status).toBe(400)
    })

    it('requires plan_tier for plan_tier scope', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request('/api/admin/feature-flags', {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', scope: 'plan_tier' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/admin/feature-flags/:id', () => {
    it('updates a flag', async () => {
      const updated = { id: FLAG_ID, name: 'waitlist', enabled: false, scope: 'global' }
      vi.mocked(createServiceClient).mockReturnValue(makeMock({ updateSingle: updated }) as any)

      const res = await app.request(`/api/admin/feature-flags/${FLAG_ID}`, {
        method: 'PUT',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.flag.enabled).toBe(false)
    })

    it('rejects invalid scope on update', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request(`/api/admin/feature-flags/${FLAG_ID}`, {
        method: 'PUT',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'invalid' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/admin/feature-flags/:id', () => {
    it('deletes a flag', async () => {
      vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

      const res = await app.request(`/api/admin/feature-flags/${FLAG_ID}`, {
        method: 'DELETE',
        headers: authHeader,
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deleted).toBe(true)
    })
  })
})

describe('Studio-facing features endpoint', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GET /:studioId/features returns effective flags', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeMock() as any)

    const res = await app.request(`/api/studios/${STUDIO_ID}/features`, { headers: authHeader })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.studioId).toBe(STUDIO_ID)
    expect(body.features).toBeDefined()
  })
})

describe('getFeatureFlag helper', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns global flag value when no overrides exist', async () => {
    const { getFeatureFlag } = await import('../lib/feature-flags')

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'feature_flags') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ name: 'waitlist', enabled: true, scope: 'global', studio_id: null, plan_tier: null }],
                error: null,
              }),
            }),
          }
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }) }) }
      }),
    }

    const result = await getFeatureFlag(mockSupabase, STUDIO_ID, 'waitlist')
    expect(result).toBe(true)
  })

  it('returns false when flag does not exist', async () => {
    const { getFeatureFlag } = await import('../lib/feature-flags')

    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }

    const result = await getFeatureFlag(mockSupabase, STUDIO_ID, 'nonexistent')
    expect(result).toBe(false)
  })

  it('studio-specific flag overrides global', async () => {
    const { getFeatureFlag } = await import('../lib/feature-flags')

    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { name: 'waitlist', enabled: true, scope: 'global', studio_id: null, plan_tier: null },
              { name: 'waitlist', enabled: false, scope: 'studio', studio_id: STUDIO_ID, plan_tier: null },
            ],
            error: null,
          }),
        }),
      }),
    }

    const result = await getFeatureFlag(mockSupabase, STUDIO_ID, 'waitlist')
    expect(result).toBe(false)
  })

  it('plan_tier flag overrides global but not studio', async () => {
    const { getFeatureFlag } = await import('../lib/feature-flags')

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'studios') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { plan_tier: 'pro' } }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { name: 'network', enabled: false, scope: 'global', studio_id: null, plan_tier: null },
                { name: 'network', enabled: true, scope: 'plan_tier', studio_id: null, plan_tier: 'pro' },
              ],
              error: null,
            }),
          }),
        }
      }),
    }

    const result = await getFeatureFlag(mockSupabase, STUDIO_ID, 'network')
    expect(result).toBe(true)
  })
})
