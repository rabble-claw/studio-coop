import { describe, it, expect } from 'vitest'
import { AppError, notFound, unauthorized, forbidden, badRequest } from '../lib/errors'

describe('AppError', () => {
  it('creates a structured error', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Studio not found')
    expect(err.status).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Studio not found')
  })

  it('has convenience constructors', () => {
    expect(notFound('Studio').status).toBe(404)
    expect(unauthorized().status).toBe(401)
    expect(forbidden().status).toBe(403)
    expect(badRequest('Invalid email').status).toBe(400)
  })
})
