import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import invitations from '../routes/invitations'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-admin', email: 'admin@example.com' })
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
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
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

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', invitations)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

describe('POST /api/studios/:studioId/members/invite', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when email is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/email/i)
  })

  it('returns 400 when invalid role is provided', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@e.com', role: 'superadmin' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/role/i)
  })

  it('adds existing user as new member', async () => {
    const insertChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { name: 'Test Studio' }, error: null })
        }
        if (table === 'users') {
          return makeAsyncChain({ data: { id: 'existing-user', name: 'Alice', email: 'alice@example.com' }, error: null })
        }
        if (table === 'memberships') {
          const chain = makeAsyncChain({ data: null, error: null })
          chain.insert = vi.fn().mockResolvedValue({ error: null })
          return chain
        }
        if (table === 'notifications') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', role: 'member' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.invited).toBe(true)
    expect(body.userExists).toBe(true)
    expect(body.role).toBe('member')
  })

  it('returns 400 when user is already an active member', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { name: 'Test Studio' }, error: null })
        }
        if (table === 'users') {
          return makeAsyncChain({ data: { id: 'existing-user', name: 'Alice', email: 'alice@example.com' }, error: null })
        }
        if (table === 'memberships') {
          return makeAsyncChain({ data: { id: 'mem-1', status: 'active' }, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/already.*active/i)
  })

  it('reactivates cancelled membership for existing user', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { name: 'Test Studio' }, error: null })
        }
        if (table === 'users') {
          return makeAsyncChain({ data: { id: 'existing-user', name: 'Bob', email: 'bob@example.com' }, error: null })
        }
        if (table === 'memberships') {
          const chain = makeAsyncChain({ data: { id: 'mem-1', status: 'cancelled' }, error: null })
          chain.update = vi.fn().mockReturnValue(updateChain)
          return chain
        }
        if (table === 'notifications') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', role: 'teacher' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.invited).toBe(true)
    expect(body.userExists).toBe(true)
    expect(body.role).toBe('teacher')
  })

  it('invites new user via Supabase auth', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { name: 'Test Studio' }, error: null })
        }
        if (table === 'users') {
          return {
            ...makeAsyncChain({ data: null, error: null }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === 'memberships') {
          const chain = makeAsyncChain({ data: null, error: null })
          chain.insert = vi.fn().mockResolvedValue({ error: null })
          return chain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-user-id' } },
            error: null,
          }),
        },
      },
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@example.com', name: 'New User', role: 'member' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.invited).toBe(true)
    expect(body.userExists).toBe(false)
  })

  it('handles Supabase auth invite failure gracefully', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { name: 'Test Studio' }, error: null })
        }
        if (table === 'users') {
          return makeAsyncChain({ data: null, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockRejectedValue(new Error('Email not configured')),
        },
      },
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/members/invite`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@example.com' }),
    })
    // Should still return 201 with a note
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.invited).toBe(true)
    expect(body.note).toBeDefined()
  })
})
