import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

vi.mock('toucan-js', () => ({
  Toucan: vi.fn().mockImplementation(() => ({
    setUser: vi.fn(),
    captureException: vi.fn(),
  })),
}))

import { sentryMiddleware } from '../middleware/sentry'
import { Toucan } from 'toucan-js'

describe('sentryMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SENTRY_DSN = 'https://test@sentry.io/123'
  })

  function makeApp(handler: (c: any) => Response | Promise<Response>) {
    const app = new Hono()
    app.use('*', sentryMiddleware)
    app.get('/test', handler)
    return app
  }

  it('creates Sentry instance when DSN is set', async () => {
    const app = makeApp((c) => c.json({ ok: true }))
    await app.request('/test')
    expect(Toucan).toHaveBeenCalled()
  })

  it('skips Sentry when DSN is not set', async () => {
    delete process.env.SENTRY_DSN
    const app = makeApp((c) => c.json({ ok: true }))
    await app.request('/test')
    expect(Toucan).not.toHaveBeenCalled()
  })

  it('provides sentry on context so error handler can capture exceptions', async () => {
    const mockCapture = vi.fn()
    vi.mocked(Toucan).mockImplementation(() => ({
      setUser: vi.fn(),
      captureException: mockCapture,
    }) as any)

    const app = new Hono()
    app.use('*', sentryMiddleware)
    app.onError((err, c) => {
      const sentry = (c as any).get('sentry')
      if (sentry) {
        sentry.captureException(err)
      }
      return c.json({ error: err.message }, 500)
    })
    app.get('/test', () => { throw new Error('test error') })

    const res = await app.request('/test')
    expect(res.status).toBe(500)
    expect(mockCapture).toHaveBeenCalledWith(expect.any(Error))
  })

  it('sets user context when available', async () => {
    const mockSetUser = vi.fn()
    vi.mocked(Toucan).mockImplementation(() => ({
      setUser: mockSetUser,
      captureException: vi.fn(),
    }) as any)

    const app = new Hono()
    app.use('*', async (c, next) => {
      ;(c as any).set('user', { id: 'user-1', email: 'test@example.com' })
      await next()
    })
    app.use('*', sentryMiddleware)
    app.get('/test', (c) => c.json({ ok: true }))

    await app.request('/test')
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'user-1', email: 'test@example.com' })
  })

  it('passes through on success without capturing', async () => {
    const mockCapture = vi.fn()
    vi.mocked(Toucan).mockImplementation(() => ({
      setUser: vi.fn(),
      captureException: mockCapture,
    }) as any)

    const app = makeApp((c) => c.json({ ok: true }))
    const res = await app.request('/test')
    expect(res.status).toBe(200)
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('stores sentry instance on context', async () => {
    let hasSentry = false
    const app = new Hono()
    app.use('*', sentryMiddleware)
    app.get('/test', (c) => {
      hasSentry = !!(c as any).get('sentry')
      return c.json({ ok: true })
    })

    await app.request('/test')
    expect(hasSentry).toBe(true)
  })
})
