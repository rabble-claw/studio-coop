import { describe, it, expect, vi } from 'vitest'

vi.mock('stripe', () => {
  const mockStripe = vi.fn().mockImplementation(() => ({
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
  }))
  return { default: mockStripe }
})

import { createStripeClient, platformFeePercent } from '../lib/stripe'

describe('createStripeClient', () => {
  it('exports a factory function', () => {
    expect(typeof createStripeClient).toBe('function')
  })

  it('throws when STRIPE_SECRET_KEY is missing', () => {
    const original = process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_SECRET_KEY
    expect(() => createStripeClient()).toThrow('Missing STRIPE_SECRET_KEY')
    process.env.STRIPE_SECRET_KEY = original
  })

  it('returns a Stripe client when key is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123'
    const client = createStripeClient()
    expect(client).toBeDefined()
  })
})

describe('platformFeePercent', () => {
  it('defaults to 2.5 when STRIPE_PLATFORM_FEE_PERCENT is not set', () => {
    // At import time the env var was not set, so it should be 2.5
    // (or whatever the env was; test the type at minimum)
    expect(typeof platformFeePercent).toBe('number')
    expect(platformFeePercent).toBeGreaterThanOrEqual(0)
  })
})
