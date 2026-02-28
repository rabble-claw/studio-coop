import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/stripe')>()
  return {
    ...actual,
    createStripeClient: vi.fn(),
    getPlatformFeePercent: vi.fn(() => 2.5),
  }
})

import { createServiceClient } from '../lib/supabase'
import { createStripeClient, getPlatformFeePercent } from '../lib/stripe'
import {
  calculateApplicationFee,
} from '../lib/payments'

const mockStripe = {
  customers: {
    create: vi.fn(),
  },
}

function makeSupabase(rows: Record<string, Record<string, unknown> | null> = {}) {
  // rows is a map from table name to the row returned by .single()
  const chain = {
    from: vi.fn().mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: rows[table] ?? null, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    })),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
  vi.mocked(createStripeClient).mockReturnValue(mockStripe as any)
  vi.mocked(getPlatformFeePercent).mockReturnValue(2.5)
})

// ─── getOrCreateStripeCustomer ───────────────────────────────────────────────

import { getOrCreateStripeCustomer, getConnectedAccountId } from '../lib/payments'

describe('getOrCreateStripeCustomer', () => {
  it('returns existing customer when stripe_customer_id exists on membership', async () => {
    const mockSupa = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: 'cus_existing' }, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { stripe_account_id: 'acct_123' }, error: null }),
        }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    const customer = await getOrCreateStripeCustomer('user-1', 'studio-1', 'test@example.com')
    expect(customer.id).toBe('cus_existing')
    expect(customer.object).toBe('customer')
    // Should NOT have called Stripe to create
    expect(mockStripe.customers.create).not.toHaveBeenCalled()
  })

  it('creates a new Stripe customer on connected account when none exists', async () => {
    mockStripe.customers.create.mockResolvedValue({
      id: 'cus_new',
      email: 'test@example.com',
      metadata: { userId: 'user-1', studioId: 'studio-1' },
    })

    const mockUpdate = vi.fn().mockReturnThis()
    const mockSupa = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: null }, error: null }),
            update: mockUpdate,
          }
        }
        if (table === 'studios') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { stripe_account_id: 'acct_123' }, error: null }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    const customer = await getOrCreateStripeCustomer('user-1', 'studio-1', 'test@example.com')
    expect(customer.id).toBe('cus_new')
    expect(mockStripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
      expect.objectContaining({ stripeAccount: 'acct_123' }),
    )
  })
})

// ─── getConnectedAccountId ──────────────────────────────────────────────────

describe('getConnectedAccountId', () => {
  it('returns stripe_account_id from studio', async () => {
    const mockSupa = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { stripe_account_id: 'acct_connected' }, error: null }),
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    const id = await getConnectedAccountId('studio-1')
    expect(id).toBe('acct_connected')
  })

  it('throws when studio has no connected Stripe account', async () => {
    const mockSupa = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { stripe_account_id: null }, error: null }),
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    await expect(getConnectedAccountId('studio-1')).rejects.toThrow('Studio does not have a connected Stripe account')
  })
})

// ─── calculateApplicationFee ─────────────────────────────────────────────────

describe('calculateApplicationFee', () => {
  it('calculates 2.5% fee correctly', () => {
    expect(calculateApplicationFee(10000)).toBe(250) // $100 → $2.50
    expect(calculateApplicationFee(5000)).toBe(125)  // $50  → $1.25
    expect(calculateApplicationFee(199)).toBe(5)     // $1.99 → $0.05 (rounded)
  })

  it('rounds to nearest cent', () => {
    // 1000 * 2.5% = 25 exactly
    expect(calculateApplicationFee(1000)).toBe(25)
    // 333 * 2.5% = 8.325 → 8
    expect(calculateApplicationFee(333)).toBe(8)
  })
})

