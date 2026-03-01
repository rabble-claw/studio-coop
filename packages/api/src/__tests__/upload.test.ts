import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import upload from '../routes/upload'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'member@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/upload', upload)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

function makeFormData(fields: Record<string, string | File>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const buffer = new ArrayBuffer(sizeBytes)
  return new File([buffer], name, { type })
}

const headers = { Authorization: 'Bearer tok' }

describe('POST /api/upload', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when no file is provided', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const fd = makeFormData({ studioId: 'studio-1', classId: 'class-1' })
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers,
      body: fd,
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/file/i)
  })

  it('returns 400 when studioId is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const fd = makeFormData({
      file: makeFile('test.jpg', 'image/jpeg', 1024),
      classId: 'class-1',
    })
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers,
      body: fd,
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/studioId/i)
  })

  it('returns 400 when classId is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const fd = makeFormData({
      file: makeFile('test.jpg', 'image/jpeg', 1024),
      studioId: 'studio-1',
    })
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers,
      body: fd,
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/classId/i)
  })

  it('returns 403 when user is not a member of the studio', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const fd = makeFormData({
      file: makeFile('test.jpg', 'image/jpeg', 1024),
      studioId: 'studio-1',
      classId: 'class-1',
    })
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers,
      body: fd,
    })

    expect(res.status).toBe(403)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/member/i)
  })

  it('returns 400 when file type is not allowed', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: { id: 'mem-1' }, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const fd = makeFormData({
      file: makeFile('malicious.exe', 'application/x-executable', 1024),
      studioId: 'studio-1',
      classId: 'class-1',
    })
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers,
      body: fd,
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/file type/i)
  })

  it('returns 400 when file exceeds 10MB', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: { id: 'mem-1' }, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const fd = makeFormData({
      file: makeFile('huge.jpg', 'image/jpeg', 11 * 1024 * 1024),
      studioId: 'studio-1',
      classId: 'class-1',
    })
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers,
      body: fd,
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/too large/i)
  })

  it('uploads a valid file and returns the public URL', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: { id: 'mem-1' }, error: null })),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/feed/studio-1/class-1/user-1/abc.jpg' },
          }),
        }),
      },
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const fd = makeFormData({
      file: makeFile('photo.jpg', 'image/jpeg', 5000),
      studioId: 'studio-1',
      classId: 'class-1',
    })
    const res = await app.request('/api/upload', {
      method: 'POST',
      headers,
      body: fd,
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.url).toContain('https://storage.example.com')
  })
})
