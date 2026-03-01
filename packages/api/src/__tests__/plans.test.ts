import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import plans from '../routes/plans'
import { errorHandler } from '../middleware/error-handler'

// Mock the supabase module so no real DB calls are made
vi.mock('../lib/supabase', () => ({
  createServiceClient: vi.fn(),
}))

// Mock Stripe helpers — stubs throw by default; individual tests override as needed
vi.mock('../lib/stripe', () => ({
  createStripePrice: vi.fn().mockRejectedValue(new Error('stripe not configured')),
  archiveStripePrice: vi.fn().mockRejectedValue(new Error('stripe not configured')),
  createCheckoutSession: vi.fn().mockRejectedValue(new Error('stripe not configured')),
  createPaymentIntent: vi.fn().mockRejectedValue(new Error('stripe not configured')),
}))

vi.mock('../lib/payments', () => ({
  getConnectedAccountId: vi.fn().mockRejectedValue(new Error('no stripe account')),
  getOrCreateStripeCustomer: vi.fn().mockRejectedValue(new Error('stripe not configured')),
}))

// Mock auth + studio-access middleware to inject user/role context
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))

vi.mock('../middleware/studio-access', () => ({
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
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'staff')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'
const PLAN_ID = 'plan-xyz'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', plans)
  return app
}

function makeMockChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  const terminal = { data, error }
  const methods = ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle', 'limit']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain['single'] = vi.fn(() => Promise.resolve(terminal))
  chain['maybeSingle'] = vi.fn(() => Promise.resolve(terminal))
  // make the chain itself awaitable (for .order() terminal)
  ;(chain as any)[Symbol.iterator] = undefined
  Object.defineProperty(chain, 'then', {
    get: () => undefined, // not a promise by default
  })
  return chain
}

describe('GET /api/studios/:studioId/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns active plans for a studio (no auth required)', async () => {
    const mockPlans = [
      { id: PLAN_ID, name: 'Unlimited Monthly', type: 'unlimited', active: true },
    ]
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockPlans, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plans).toHaveLength(1)
    expect(body.plans[0].name).toBe('Unlimited Monthly')
  })

  it('returns empty array when studio has no plans', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plans).toEqual([])
  })
})

describe('POST /api/studios/:studioId/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a plan without Stripe sync when Stripe is not configured', async () => {
    const newPlan = {
      id: PLAN_ID,
      name: 'Unlimited Monthly',
      type: 'unlimited',
      price_cents: 18000,
      currency: 'NZD',
      interval: 'month',
      active: true,
      sort_order: 0,
    }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: newPlan, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        name: 'Unlimited Monthly',
        type: 'unlimited',
        priceCents: 18000,
        currency: 'NZD',
        interval: 'month',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.plan.name).toBe('Unlimited Monthly')
  })

  it('rejects invalid plan data with 400', async () => {
    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ name: '' }), // invalid: name too short, missing required fields
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })
})

describe('PUT /api/studios/:studioId/plans/:planId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates a plan', async () => {
    const existing = {
      id: PLAN_ID,
      studio_id: STUDIO_ID,
      name: 'Old Name',
      price_cents: 18000,
      currency: 'NZD',
      interval: 'month',
      stripe_price_id: null,
    }
    const updated = { ...existing, name: 'New Name' }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: existing, error: null }) // fetch existing
        .mockResolvedValueOnce({ data: updated, error: null }), // after update
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.plan.name).toBe('New Name')
  })

  it('returns 404 when plan not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/nonexistent`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ name: 'New Name' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/studios/:studioId/plans/:planId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('soft-deletes a plan (sets active=false)', async () => {
    const existing = { id: PLAN_ID, stripe_price_id: null }
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: existing, error: null }),
    }
    // Make update chain resolve to success
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when plan not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/nonexistent`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/studios/:studioId/plans/:planId/subscribers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when plan not found', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribers`, {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(404)
  })

  it('returns subscribers for a valid plan', async () => {
    const plan = { id: PLAN_ID, name: 'Unlimited Monthly' }
    const subscribers = [
      { id: 'sub-1', status: 'active', created_at: '2026-01-01', member: { id: 'u1', name: 'Alice', email: 'a@e.com', avatar_url: null } },
    ]

    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: subscribers, error: null }),
      single: vi.fn().mockResolvedValue({ data: plan, error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/plans/${PLAN_ID}/subscribers`, {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.plan.name).toBe('Unlimited Monthly')
    expect(body.subscribers).toHaveLength(1)
    expect(body.subscribers[0].member.name).toBe('Alice')
  })
})
