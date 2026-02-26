import { describe, it, expect } from 'vitest'
import { requireRole } from '../middleware/studio-access'

describe('requireRole', () => {
  it('exports a middleware factory', () => {
    expect(typeof requireRole).toBe('function')
    const mw = requireRole('owner', 'admin')
    expect(typeof mw).toBe('function')
  })
})
