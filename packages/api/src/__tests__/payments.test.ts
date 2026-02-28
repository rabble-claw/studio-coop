import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({
  createStripeClient: vi.fn(),
  getPlatformFeePercent: vi.fn(() => 2.5),
}))

import { createServiceClient } from '../lib/supabase'
import { createStripeClient, getPlatformFeePercent } from '../lib/stripe'
import {
  calculateApplicationFee,
  createCheckoutSession,
  createPaymentIntent,
  processRefund,
} from '../lib/payments'

const mockStripe = {
  checkout: {
    sessions: { create: vi.fn() },
  },
  paymentIntents: {
    create: vi.fn(),
  },
  refunds: {
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

// ─── calculateApplicationFee ─────────────────────────────────────────────────

describe.skip('calculateApplicationFee', () => {
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

// ─── createCheckoutSession ───────────────────────────────────────────────────

describe.skip('createCheckoutSession', () => {
  it('creates a Stripe Checkout session on connected account', async () => {
    const mockSession = { id: 'cs_test', url: 'https://checkout.stripe.com/pay/xxx' }
    mockStripe.checkout.sessions.create.mockResolvedValue(mockSession)

    // We need the supabase mock to support chained calls for two tables
    // (studios and plans), called via Promise.all
    let callCount = 0
    const mockSupa = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        const row =
          callCount === 1
            ? { stripe_account_id: 'acct_123' }
            : { stripe_price_id: 'price_abc', price_cents: 5000 }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: row, error: null }),
        }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    const session = await createCheckoutSession('studio-1', 'user-1', 'plan-1')
    expect(session).toBe(mockSession)
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        metadata: expect.objectContaining({ studioId: 'studio-1' }),
      }),
      { stripeAccount: 'acct_123' }
    )
  })

  it('throws when studio has no Stripe account', async () => {
    const mockSupa = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { stripe_account_id: null }, error: null }),
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    await expect(createCheckoutSession('studio-1', 'user-1', 'plan-1')).rejects.toThrow(
      'Studio has no Stripe account'
    )
  })
})

// ─── createPaymentIntent ─────────────────────────────────────────────────────

describe.skip('createPaymentIntent', () => {
  it('creates payment intent with correct fee and records in DB', async () => {
    const mockPI = { id: 'pi_test', amount: 5000, currency: 'usd', client_secret: 'sec' }
    mockStripe.paymentIntents.create.mockResolvedValue(mockPI)

    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockSupa = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'studios') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { stripe_account_id: 'acct_123' } }),
          }
        }
        return { insert: mockInsert }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    const pi = await createPaymentIntent('studio-1', 'user-1', 5000, { type: 'drop-in' })
    expect(pi).toBe(mockPI)

    // 2.5% of 5000 = 125
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        application_fee_amount: 125,
        currency: 'usd',
      }),
      { stripeAccount: 'acct_123' }
    )

    // DB record created
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_payment_intent_id: 'pi_test',
        status: 'pending',
        amount_cents: 5000,
      })
    )
  })
})

// ─── processRefund ───────────────────────────────────────────────────────────

describe.skip('processRefund', () => {
  it('issues a full refund and updates DB status to refunded', async () => {
    const mockRefund = { id: 'ref_test', amount: 5000 }
    mockStripe.refunds.create.mockResolvedValue(mockRefund)

    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockSupa = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { studio_id: 'studio-1' } }),
            update: mockUpdate,
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { stripe_account_id: 'acct_123' } }),
        }
      }),
    }
    // Make the update chain work
    mockUpdate.mockReturnValue({ eq: mockEq })
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    const refund = await processRefund('pi_test')
    expect(refund).toBe(mockRefund)
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      { payment_intent: 'pi_test' },
      { stripeAccount: 'acct_123' }
    )
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'refunded' })
  })

  it('issues a partial refund and updates DB status to partially_refunded', async () => {
    const mockRefund = { id: 'ref_partial', amount: 2500 }
    mockStripe.refunds.create.mockResolvedValue(mockRefund)

    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockResolvedValue({ error: null })
    const mockSupa = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'payments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { studio_id: 'studio-1' } }),
            update: mockUpdate,
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { stripe_account_id: 'acct_123' } }),
        }
      }),
    }
    mockUpdate.mockReturnValue({ eq: mockEq })
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    await processRefund('pi_test', 2500)
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      { payment_intent: 'pi_test', amount: 2500 },
      expect.any(Object)
    )
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'partially_refunded' })
  })

  it('throws when payment is not found', async () => {
    const mockSupa = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mockSupa as any)

    await expect(processRefund('pi_missing')).rejects.toThrow('Payment not found')
  })
})
