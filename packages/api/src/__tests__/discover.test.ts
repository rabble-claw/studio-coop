import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import discover from '../routes/discover'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '../lib/supabase'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/discover', discover)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

describe('GET /api/discover/filters', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns aggregated cities, disciplines, and locations', async () => {
    const studios = [
      { discipline: 'yoga', country_code: 'US', region: 'California', city: 'San Francisco' },
      { discipline: 'yoga', country_code: 'US', region: 'New York', city: 'New York' },
      { discipline: 'pilates', country_code: 'GB', region: 'England', city: 'London' },
    ]

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: studios, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/discover/filters')

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.disciplines).toContain('yoga')
    expect(body.disciplines).toContain('pilates')
    expect(body.cities).toContain('San Francisco')
    expect(body.cities).toContain('London')
    expect(body.locations).toHaveLength(2) // US, GB
    expect(body.locations.find((l: any) => l.country_code === 'US').regions).toContain('California')
  })

  it('returns empty arrays when no studios exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/discover/filters')

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.disciplines).toEqual([])
    expect(body.cities).toEqual([])
    expect(body.locations).toEqual([])
  })
})

describe('GET /api/discover/studios', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns paginated studio list with member and class counts', async () => {
    const studios = [
      { id: 's1', name: 'Yoga Studio', slug: 'yoga-studio', discipline: 'yoga', description: 'Great yoga', logo_url: null, country_code: 'US', region: 'CA', city: 'SF', address: null, latitude: null, longitude: null },
    ]

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: studios, error: null, count: 1 })
        }
        if (table === 'memberships') {
          return makeAsyncChain({ data: [{ studio_id: 's1' }, { studio_id: 's1' }], error: null })
        }
        if (table === 'class_instances') {
          return makeAsyncChain({ data: [{ studio_id: 's1' }], error: null })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/discover/studios')

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.studios).toHaveLength(1)
    expect(body.studios[0].name).toBe('Yoga Studio')
    expect(body.studios[0].member_count).toBe(2)
    expect(body.studios[0].upcoming_class_count).toBe(1)
    expect(body.page).toBe(1)
  })

  it('returns empty list when no studios match', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null, count: 0 })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/discover/studios?discipline=underwater-basket-weaving')

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.studios).toEqual([])
    expect(body.total).toBe(0)
  })

  it('returns empty list when query errors', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: { message: 'db error' }, count: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/discover/studios')

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.studios).toEqual([])
    expect(body.total).toBe(0)
  })
})

describe('GET /api/discover/studios/:slug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns full studio profile with classes, plans, and member count', async () => {
    const studio = {
      id: 's1', name: 'Yoga Studio', slug: 'yoga-studio', discipline: 'yoga',
      description: 'Great yoga', logo_url: null, country_code: 'US', region: 'CA',
      city: 'SF', address: '123 Main St', latitude: 37.7, longitude: -122.4,
      settings: { phone: '555-1234', website: 'https://example.com', email: 'info@example.com', instagram: '@yoga', facebook: null },
    }

    let callCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: studio, error: null })
        }
        if (table === 'class_instances') {
          return makeAsyncChain({ data: [{ id: 'ci-1', date: '2026-03-15' }], error: null })
        }
        if (table === 'membership_plans') {
          return makeAsyncChain({ data: [{ id: 'plan-1', name: 'Monthly', type: 'subscription' }], error: null })
        }
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 42 })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/discover/studios/yoga-studio')

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.studio.name).toBe('Yoga Studio')
    expect(body.studio.phone).toBe('555-1234')
    expect(body.classes).toHaveLength(1)
    expect(body.plans).toHaveLength(1)
    expect(body.member_count).toBe(42)
  })

  it('returns 404 when studio slug not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/discover/studios/nonexistent')

    expect(res.status).toBe(404)
  })
})
