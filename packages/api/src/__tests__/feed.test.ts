import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { classFeed, postFeed } from '../routes/feed'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-attendee', email: 'member@example.com' })
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const CLASS_ID = 'class-1'
const STUDIO_ID = 'studio-1'
const POST_ID = 'post-1'
const ATTENDEE_ID = 'user-attendee'
const STAFF_ID = 'user-staff'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/classes', classFeed)
  app.route('/api/feed', postFeed)
  return app
}

// ─── Mock chain factory ───────────────────────────────────────────────────────

function makeChain(result: { data: unknown; error: null | object }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

// ─── GET /api/classes/:classId/feed ──────────────────────────────────────────

describe('GET /api/classes/:classId/feed', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns feed posts for a checked-in attendee', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'class_instances') {
          return makeChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, feed_enabled: true }, error: null })
        }
        if (table === 'attendance') {
          return makeChain({ data: { id: 'att-1' }, error: null })
        }
        if (table === 'feed_posts') {
          return makeChain({
            data: [{
              id: POST_ID,
              content: 'Great class!',
              media_urls: [],
              post_type: 'post',
              created_at: '2026-02-27T10:00:00Z',
              user: { id: ATTENDEE_ID, name: 'Alice', avatar_url: null },
            }],
            error: null,
          })
        }
        if (table === 'feed_reactions') {
          return makeChain({ data: [], error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/feed`, {
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(POST_ID)
    expect(body[0].author.name).toBe('Alice')
    expect(body[0].reactions).toEqual([])
  })

  it('blocks non-attendee non-staff users', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'class_instances') {
          return makeChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, feed_enabled: true }, error: null })
        }
        if (table === 'attendance') {
          return makeChain({ data: null, error: null })
        }
        if (table === 'memberships') {
          return makeChain({ data: null, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/feed`, {
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(403)
    const body = await res.json() as any
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('allows staff to view feed without attendance record', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'class_instances') {
          return makeChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, feed_enabled: true }, error: null })
        }
        if (table === 'attendance') {
          return makeChain({ data: null, error: null })
        }
        if (table === 'memberships') {
          return makeChain({ data: { role: 'teacher' }, error: null })
        }
        if (table === 'feed_posts') {
          return makeChain({ data: [], error: null })
        }
        if (table === 'feed_reactions') {
          return makeChain({ data: [], error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/feed`, {
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(Array.isArray(body)).toBe(true)
  })
})

// ─── POST /api/classes/:classId/feed ─────────────────────────────────────────

describe('POST /api/classes/:classId/feed', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a post for an attendee', async () => {
    const newPost = {
      id: POST_ID,
      content: 'Amazing session!',
      media_urls: [],
      post_type: 'post',
      created_at: '2026-02-27T10:00:00Z',
      user: { id: ATTENDEE_ID, name: 'Alice', avatar_url: null },
    }
    const insertChain: any = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: newPost, error: null }),
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'class_instances') {
          return makeChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, feed_enabled: true }, error: null })
        }
        if (table === 'attendance') {
          return makeChain({ data: { id: 'att-1' }, error: null })
        }
        if (table === 'feed_posts') {
          const chain: any = {
            ...makeChain({ data: newPost, error: null }),
            insert: vi.fn().mockReturnValue(insertChain),
          }
          return chain
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/feed`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Amazing session!' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.content).toBe('Amazing session!')
    expect(body.reactions).toEqual([])
  })

  it('rejects empty posts (no content, no media)', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'class_instances') {
          return makeChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, feed_enabled: true }, error: null })
        }
        if (table === 'attendance') {
          return makeChain({ data: { id: 'att-1' }, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/classes/${CLASS_ID}/feed`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})

// ─── DELETE /api/feed/:postId ─────────────────────────────────────────────────

describe('DELETE /api/feed/:postId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('allows user to delete their own post', async () => {
    const deleteChain: any = {
      eq: vi.fn().mockReturnThis(),
      then: (res: any) => Promise.resolve({ data: null, error: null }).then(res),
      catch: (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej),
      [Symbol.toStringTag]: 'Promise',
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'feed_posts') {
          return {
            ...makeChain({ data: { id: POST_ID, user_id: ATTENDEE_ID, class_instance_id: CLASS_ID }, error: null }),
            delete: vi.fn().mockReturnValue(deleteChain),
          }
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/feed/${POST_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })

  it('blocks user from deleting another user\'s post (non-staff)', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'feed_posts') {
          return makeChain({ data: { id: POST_ID, user_id: 'other-user', class_instance_id: CLASS_ID }, error: null })
        }
        if (table === 'class_instances') {
          return makeChain({ data: { studio_id: STUDIO_ID }, error: null })
        }
        if (table === 'memberships') {
          return makeChain({ data: { role: 'member' }, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/feed/${POST_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    })

    expect(res.status).toBe(403)
  })
})

// ─── POST /api/feed/:postId/react ─────────────────────────────────────────────

describe('POST /api/feed/:postId/react', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('adds a reaction to a post', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'feed_posts') {
          return makeChain({ data: { id: POST_ID, class_instance_id: CLASS_ID }, error: null })
        }
        if (table === 'class_instances') {
          return makeChain({ data: { id: CLASS_ID, studio_id: STUDIO_ID, feed_enabled: true }, error: null })
        }
        if (table === 'attendance') {
          return makeChain({ data: { id: 'att-1' }, error: null })
        }
        if (table === 'feed_reactions') {
          return makeChain({ data: null, error: null })
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/feed/${POST_ID}/react`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '❤️' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })

  it('rejects invalid emoji', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/feed/${POST_ID}/react`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '😭' }),
    })

    expect(res.status).toBe(400)
  })
})

// ─── DELETE /api/feed/:postId/react ──────────────────────────────────────────

describe('DELETE /api/feed/:postId/react', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('removes a reaction', async () => {
    const deleteChain: any = {
      eq: vi.fn().mockReturnThis(),
      then: (res: any) => Promise.resolve({ data: null, error: null }).then(res),
      catch: (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej),
      [Symbol.toStringTag]: 'Promise',
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'feed_reactions') {
          return { delete: vi.fn().mockReturnValue(deleteChain) }
        }
        return makeChain({ data: null, error: null })
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mockSupabase)

    const app = makeApp()
    const res = await app.request(`/api/feed/${POST_ID}/react`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '❤️' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.ok).toBe(true)
  })
})
