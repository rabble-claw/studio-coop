import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock stripe module before any imports
vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => mockStripeInstance)
  return { default: MockStripe }
})

vi.mock('../lib/supabase', () => ({
  createServiceClient: vi.fn(),
}))

const mockStripeInstance = {
  products: {
    create: vi.fn(),
  },
  prices: {
    create: vi.fn(),
    update: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  paymentIntents: {
    create: vi.fn(),
  },
  subscriptions: {
    update: vi.fn(),
  },
  customers: {
    create: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
}

import {
  createStripePrice,
  archiveStripePrice,
  createCheckoutSession,
  createPaymentIntent,
  cancelStripeSubscription,
  pauseStripeSubscription,
  resumeStripeSubscription,
  constructWebhookEvent,
  createStripeClient,
  calculateApplicationFee,
} from '../lib/stripe'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
})

// ─── createStripePrice ──────────────────────────────────────────────────────

describe('createStripePrice', () => {
  it('creates a product and price on connected account', async () => {
    mockStripeInstance.products.create.mockResolvedValue({ id: 'prod_test' })
    mockStripeInstance.prices.create.mockResolvedValue({
      id: 'price_test',
      object: 'price',
      active: true,
      currency: 'nzd',
      unit_amount: 18000,
      recurring: { interval: 'month' },
      product: 'prod_test',
    })

    const result = await createStripePrice({
      name: 'Unlimited Monthly',
      unitAmount: 18000,
      currency: 'nzd',
      interval: 'month',
      connectedAccountId: 'acct_123',
    })

    expect(result.id).toBe('price_test')
    expect(result.product).toBe('prod_test')
    expect(mockStripeInstance.products.create).toHaveBeenCalledWith(
      { name: 'Unlimited Monthly' },
      { stripeAccount: 'acct_123' },
    )
    expect(mockStripeInstance.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_test',
        unit_amount: 18000,
        currency: 'nzd',
        recurring: { interval: 'month' },
      }),
      { stripeAccount: 'acct_123' },
    )
  })

  it('creates a one-time price when no interval provided', async () => {
    mockStripeInstance.products.create.mockResolvedValue({ id: 'prod_once' })
    mockStripeInstance.prices.create.mockResolvedValue({
      id: 'price_once',
      object: 'price',
      active: true,
      currency: 'nzd',
      unit_amount: 2500,
      recurring: null,
      product: 'prod_once',
    })

    const result = await createStripePrice({
      name: 'Drop-in',
      unitAmount: 2500,
      currency: 'nzd',
      connectedAccountId: 'acct_123',
    })

    expect(result.id).toBe('price_once')
    expect(result.recurring).toBeNull()
    // Should NOT include recurring in params
    const priceCreateCall = mockStripeInstance.prices.create.mock.calls[0][0]
    expect(priceCreateCall.recurring).toBeUndefined()
  })
})

// ─── archiveStripePrice ─────────────────────────────────────────────────────

describe('archiveStripePrice', () => {
  it('deactivates price on connected account', async () => {
    mockStripeInstance.prices.update.mockResolvedValue({ id: 'price_test', active: false })

    await archiveStripePrice('price_test', 'acct_123')

    expect(mockStripeInstance.prices.update).toHaveBeenCalledWith(
      'price_test',
      { active: false },
      { stripeAccount: 'acct_123' },
    )
  })
})

// ─── createCheckoutSession ──────────────────────────────────────────────────

describe('createCheckoutSession', () => {
  it('creates checkout session with subscription mode and application fee', async () => {
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test',
      object: 'checkout.session',
      url: 'https://checkout.stripe.com/pay/cs_test',
      payment_intent: null,
      subscription: null,
      customer: 'cus_test',
      metadata: { userId: 'user-1', studioId: 'studio-1' },
    })

    const result = await createCheckoutSession({
      priceId: 'price_test',
      customerId: 'cus_test',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      connectedAccountId: 'acct_123',
      metadata: { userId: 'user-1', studioId: 'studio-1' },
    })

    expect(result.id).toBe('cs_test')
    expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test')
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_test',
        line_items: [{ price: 'price_test', quantity: 1 }],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: expect.objectContaining({ userId: 'user-1' }),
        subscription_data: expect.objectContaining({
          application_fee_percent: expect.any(Number),
        }),
      }),
      { stripeAccount: 'acct_123' },
    )
  })

  it('includes coupon discount when couponId provided', async () => {
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      id: 'cs_coupon',
      object: 'checkout.session',
      url: 'https://checkout.stripe.com/pay/cs_coupon',
      payment_intent: null,
      subscription: null,
      customer: 'cus_test',
      metadata: {},
    })

    await createCheckoutSession({
      priceId: 'price_test',
      customerId: 'cus_test',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      connectedAccountId: 'acct_123',
      couponId: 'coupon_abc',
    })

    const call = mockStripeInstance.checkout.sessions.create.mock.calls[0][0]
    expect(call.discounts).toEqual([{ coupon: 'coupon_abc' }])
  })
})

// ─── createPaymentIntent ────────────────────────────────────────────────────

describe('createPaymentIntent', () => {
  it('creates payment intent with application fee on connected account', async () => {
    mockStripeInstance.paymentIntents.create.mockResolvedValue({
      id: 'pi_test',
      object: 'payment_intent',
      client_secret: 'pi_test_secret',
      amount: 5000,
      currency: 'nzd',
      status: 'requires_payment_method',
      customer: 'cus_test',
      metadata: { studioId: 'studio-1' },
    })

    const result = await createPaymentIntent({
      amount: 5000,
      currency: 'nzd',
      customerId: 'cus_test',
      connectedAccountId: 'acct_123',
      metadata: { studioId: 'studio-1' },
    })

    expect(result.id).toBe('pi_test')
    expect(result.client_secret).toBe('pi_test_secret')
    expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'nzd',
        customer: 'cus_test',
        application_fee_amount: calculateApplicationFee(5000),
        metadata: expect.objectContaining({ studioId: 'studio-1' }),
      }),
      { stripeAccount: 'acct_123' },
    )
  })
})

// ─── cancelStripeSubscription ───────────────────────────────────────────────

describe('cancelStripeSubscription', () => {
  it('sets cancel_at_period_end on connected account', async () => {
    mockStripeInstance.subscriptions.update.mockResolvedValue({
      id: 'sub_test',
      object: 'subscription',
      status: 'active',
      cancel_at_period_end: true,
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      customer: 'cus_test',
      items: { data: [{ price: { id: 'price_test' } }] },
      metadata: {},
    })

    const result = await cancelStripeSubscription('sub_test', 'acct_123')

    expect(result.id).toBe('sub_test')
    expect(result.cancel_at_period_end).toBe(true)
    expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
      'sub_test',
      { cancel_at_period_end: true },
      { stripeAccount: 'acct_123' },
    )
  })
})

// ─── pauseStripeSubscription ────────────────────────────────────────────────

describe('pauseStripeSubscription', () => {
  it('sets trial_end far in the future on connected account', async () => {
    mockStripeInstance.subscriptions.update.mockResolvedValue({
      id: 'sub_test',
      object: 'subscription',
      status: 'trialing',
      cancel_at_period_end: false,
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      customer: 'cus_test',
      items: { data: [{ price: { id: 'price_test' } }] },
      metadata: {},
    })

    const result = await pauseStripeSubscription('sub_test', 'acct_123')

    expect(result.id).toBe('sub_test')
    const call = mockStripeInstance.subscriptions.update.mock.calls[0]
    expect(call[0]).toBe('sub_test')
    expect(call[1].trial_end).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(call[2]).toEqual({ stripeAccount: 'acct_123' })
  })
})

// ─── resumeStripeSubscription ───────────────────────────────────────────────

describe('resumeStripeSubscription', () => {
  it('removes trial_end on connected account', async () => {
    mockStripeInstance.subscriptions.update.mockResolvedValue({
      id: 'sub_test',
      object: 'subscription',
      status: 'active',
      cancel_at_period_end: false,
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      customer: 'cus_test',
      items: { data: [{ price: { id: 'price_test' } }] },
      metadata: {},
    })

    const result = await resumeStripeSubscription('sub_test', 'acct_123')

    expect(result.id).toBe('sub_test')
    expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
      'sub_test',
      { trial_end: 'now' },
      { stripeAccount: 'acct_123' },
    )
  })
})

// ─── constructWebhookEvent ──────────────────────────────────────────────────

describe('constructWebhookEvent', () => {
  it('verifies signature and returns event', () => {
    const mockEvent = { id: 'evt_test', type: 'checkout.session.completed', data: { object: {} } }
    mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent)

    const result = constructWebhookEvent('payload', 'sig', 'whsec_test')

    expect(result).toEqual(mockEvent)
    expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith('payload', 'sig', 'whsec_test')
  })

  it('throws on invalid signature', () => {
    mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    expect(() => constructWebhookEvent('payload', 'bad-sig', 'whsec_test')).toThrow('Invalid signature')
  })
})
