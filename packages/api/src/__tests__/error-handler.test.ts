import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from '../middleware/error-handler'
import { notFound, badRequest } from '../lib/errors'

function createTestApp() {
  const app = new Hono()
  app.onError(errorHandler)

  app.get('/not-found', () => { throw notFound('Studio') })
  app.get('/bad-request', () => { throw badRequest('Invalid email') })
  app.get('/unexpected', () => { throw new Error('Something broke') })

  return app
}

describe('errorHandler middleware', () => {
  const app = createTestApp()

  it('handles AppError with correct status and body', async () => {
    const res = await app.request('/not-found')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Studio not found')
  })

  it('handles bad request', async () => {
    const res = await app.request('/bad-request')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('handles unexpected errors as 500', async () => {
    const res = await app.request('/unexpected')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
