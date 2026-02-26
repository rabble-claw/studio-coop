import { describe, it, expect } from 'vitest'
import { app } from '../index'

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})
