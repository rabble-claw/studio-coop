import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import templates from '../routes/templates'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
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
  app.route('/api/studios', templates)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/studios/:studioId/templates
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/studios/:studioId/templates', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns templates filtered to active by default', async () => {
    const templateData = [
      { id: 't1', name: 'Yoga Basics', active: true },
      { id: 't2', name: 'Power Flow', active: true },
    ]
    const chain = makeAsyncChain({ data: templateData, error: null })
    const mock = { from: vi.fn(() => chain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.templates).toHaveLength(2)
    expect(body.templates[0].name).toBe('Yoga Basics')
    // eq should be called for studio_id and active=true
    expect(chain.eq).toHaveBeenCalledWith('studio_id', STUDIO_ID)
    expect(chain.eq).toHaveBeenCalledWith('active', true)
  })

  it('returns all templates when active=false', async () => {
    const templateData = [
      { id: 't1', name: 'Yoga Basics', active: true },
      { id: 't2', name: 'Old Class', active: false },
    ]
    const chain = makeAsyncChain({ data: templateData, error: null })
    const mock = { from: vi.fn(() => chain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates?active=false`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.templates).toHaveLength(2)
    // eq should only be called once for studio_id, not for active
    const activeCalls = chain.eq.mock.calls.filter((c: any) => c[0] === 'active')
    expect(activeCalls).toHaveLength(0)
  })

  it('returns empty array when no templates exist', async () => {
    const chain = makeAsyncChain({ data: [], error: null })
    const mock = { from: vi.fn(() => chain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.templates).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/studios/:studioId/templates
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/templates', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a template with valid data', async () => {
    const created = {
      id: 't-new',
      name: 'Morning Flow',
      start_time: '09:00',
      duration_min: 60,
      studio_id: STUDIO_ID,
    }
    const chain = makeAsyncChain({ data: created, error: null })
    const mock = { from: vi.fn(() => chain) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Morning Flow',
        start_time: '09:00',
        duration_min: 60,
        description: 'A gentle morning class',
        day_of_week: 1,
        max_capacity: 20,
        location: 'Studio A',
        recurrence: 'weekly',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.template.name).toBe('Morning Flow')
    expect(chain.insert).toHaveBeenCalled()
  })

  it('returns 400 when name is missing', async () => {
    const mock = { from: vi.fn(() => makeAsyncChain({ data: null, error: null })) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: '09:00', duration_min: 60 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/name/i)
  })

  it('returns 400 when duration_min is out of range', async () => {
    const mock = { from: vi.fn(() => makeAsyncChain({ data: null, error: null })) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', start_time: '09:00', duration_min: 5 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/duration_min/i)
  })

  it('returns 400 when duration_min exceeds max', async () => {
    const mock = { from: vi.fn(() => makeAsyncChain({ data: null, error: null })) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', start_time: '09:00', duration_min: 300 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/duration_min/i)
  })

  it('returns 400 for invalid recurrence', async () => {
    const mock = { from: vi.fn(() => makeAsyncChain({ data: null, error: null })) }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', start_time: '09:00', duration_min: 60, recurrence: 'daily' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/recurrence/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/studios/:studioId/templates/:templateId
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/studios/:studioId/templates/:templateId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates template fields', async () => {
    const updated = { id: 't1', name: 'Updated Name', duration_min: 90 }
    // First call: from('class_templates').select().eq().eq().maybeSingle() → existing
    // Second call: from('class_templates').update().eq().eq().select().single() → updated
    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return makeAsyncChain({ data: { id: 't1' }, error: null })
        }
        return makeAsyncChain({ data: updated, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates/t1`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', duration_min: 90 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.template.name).toBe('Updated Name')
  })

  it('returns 404 when template does not exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates/nonexistent`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/not found/i)
  })

  it('returns 400 when no valid fields provided', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: { id: 't1' }, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates/t1`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: 'value' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/no valid fields/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/studios/:studioId/templates/:templateId
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/studios/:studioId/templates/:templateId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('soft-deletes a template by setting active=false', async () => {
    let callCount = 0
    const updateChain = makeAsyncChain({ data: null, error: null })
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return makeAsyncChain({ data: { id: 't1' }, error: null })
        }
        return updateChain
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates/t1`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    // Verify update was called with active: false
    expect(updateChain.update).toHaveBeenCalledWith({ active: false })
  })

  it('returns 404 when template does not exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/templates/nonexistent`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/not found/i)
  })
})
