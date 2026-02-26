import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({ createStripeClient: vi.fn() }))

import { createServiceClient } from '../lib/supabase'
import { createStripeClient } from '../lib/stripe'
import { webhookRoutes, handleEvent } from '../routes/webhooks'
import { errorHandler } from '../middleware/error-handler'

const app = new Hono()
app.onError(errorHandler)
app.route('/api/webhooks', webhookRoutes)

// Stripe mock
const mockConstructEvent = vi.fn()
const mockStripe = {
  webhooks: { constructEvent: mockConstructEvent },
}

// Supabase mock builder
function makeSupa() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_abc'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  vi.mocked(createStripeClient).mockReturnValue(mockStripe as any)
})

// ─── Signature verification ───────────────────────────────────────────────────

describe('POST /api/webhooks/stripe — signature verification', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/stripe-signature/i)
  })

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error('Invalid signature') })

    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'bad-sig' },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid signature')
  })

  it('returns 200 received:true on valid signature', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'some.unknown.event',
      data: { object: {} },
    })
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'valid-sig' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })
})

// ─── Event handlers via handleEvent ──────────────────────────────────────────

describe('handleEvent — account.updated', () => {
  it('updates studio stripe status', async () => {
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    await handleEvent({
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_123',
          charges_enabled: true,
          details_submitted: true,
          metadata: { studioId: 'studio-1' },
        },
      },
    } as any)

    expect(supabase.from).toHaveBeenCalledWith('studios')
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_charges_enabled: true, stripe_details_submitted: true })
    )
  })
})

describe('handleEvent — checkout.session.completed', () => {
  it('inserts payment record on paid session', async () => {
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    await handleEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test',
          payment_intent: 'pi_123',
          payment_status: 'paid',
          amount_total: 5000,
          currency: 'usd',
          metadata: { studioId: 'studio-1', userId: 'user-1' },
        },
      },
    } as any)

    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_payment_intent_id: 'pi_123',
        status: 'succeeded',
        amount_cents: 5000,
      })
    )
  })
})

describe('handleEvent — customer.subscription.created', () => {
  it('upserts subscription record', async () => {
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    await handleEvent({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_abc',
          status: 'active',
          current_period_start: 1700000000,
          current_period_end: 1702678400,
          metadata: { planId: 'plan-1', userId: 'user-1', studioId: 'studio-1' },
        },
      },
    } as any)

    expect(supabase.from).toHaveBeenCalledWith('subscriptions')
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_subscription_id: 'sub_123', status: 'active' }),
      expect.objectContaining({ onConflict: 'stripe_subscription_id' })
    )
  })
})

describe('handleEvent — customer.subscription.deleted', () => {
  it('marks subscription as cancelled', async () => {
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    await handleEvent({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123' } },
    } as any)

    expect(supabase.update).toHaveBeenCalledWith({ status: 'cancelled' })
  })
})

describe('handleEvent — invoice.payment_succeeded', () => {
  it('resets classes_used_this_period on renewal', async () => {
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    await handleEvent({
      type: 'invoice.payment_succeeded',
      data: { object: { subscription: 'sub_123' } },
    } as any)

    expect(supabase.update).toHaveBeenCalledWith({ classes_used_this_period: 0 })
  })
})

describe('handleEvent — invoice.payment_failed', () => {
  it('marks subscription as past_due', async () => {
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    await handleEvent({
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_123' } },
    } as any)

    expect(supabase.update).toHaveBeenCalledWith({ status: 'past_due' })
  })
})

describe('handleEvent — payment_intent.succeeded', () => {
  it('upserts payment record', async () => {
    const supabase = makeSupa()
    vi.mocked(createServiceClient).mockReturnValue(supabase as any)

    await handleEvent({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_456',
          amount: 2500,
          currency: 'usd',
          metadata: { studioId: 'studio-1', userId: 'user-1' },
        },
      },
    } as any)

    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_payment_intent_id: 'pi_456', amount_cents: 2500 }),
      expect.objectContaining({ onConflict: 'stripe_payment_intent_id' })
    )
  })
})
