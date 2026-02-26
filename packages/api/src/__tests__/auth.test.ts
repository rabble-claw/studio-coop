import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth'

describe('authMiddleware', () => {
  const app = new Hono<AuthEnv>()
  app.use('/*', authMiddleware)
  app.get('/protected', (c) => {
    const user = c.get('user')
    return c.json({ userId: user.id })
  })

  it('rejects requests without Authorization header', async () => {
    const res = await app.request('/protected')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects requests with invalid token format', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: 'InvalidFormat' },
    })
    expect(res.status).toBe(401)
  })
})
