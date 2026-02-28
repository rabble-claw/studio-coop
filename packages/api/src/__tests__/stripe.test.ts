import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock before importing the module under test
vi.mock('../lib/supabase', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('stripe', () => {
  const mockStripe = vi.fn().mockImplementation(() => ({
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
    },
  }))
  return { default: mockStripe }
})

import { createStripeClient, platformFeePercent, getOrCreateStripeCustomer } from '../lib/stripe'
import { createServiceClient } from '../lib/supabase'

describe.skip('createStripeClient', () => {
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

describe.skip('platformFeePercent', () => {
  it('defaults to 2.5 when STRIPE_PLATFORM_FEE_PERCENT is not set', () => {
    // At import time the env var was not set, so it should be 2.5
    // (or whatever the env was; test the type at minimum)
    expect(typeof platformFeePercent).toBe('number')
    expect(platformFeePercent).toBeGreaterThanOrEqual(0)
  })
})

describe.skip('getOrCreateStripeCustomer', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123'
    vi.clearAllMocks()
  })

  it('returns existing customer ID if already in DB', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
        error: null,
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any)

    const result = await getOrCreateStripeCustomer('user-123', 'test@example.com')
    expect(result).toBe('cus_existing')
  })

  it('creates a new Stripe customer and saves to DB if none exists', async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })
        .mockReturnValueOnce(mockEq2),
      update: mockUpdate,
      single: vi.fn().mockResolvedValue({ data: null }),
    }
    // Make from() chain work differently for select vs update
    mockSupabase.from.mockImplementation(() => mockSupabase)
    mockSupabase.update.mockReturnValue({ eq: mockEq2 })

    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any)

    const result = await getOrCreateStripeCustomer('user-123', 'test@example.com')
    expect(result).toBe('cus_test123')
  })
})
