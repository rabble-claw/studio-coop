import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import webhooks from '../routes/webhooks'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({
  constructWebhookEvent: vi.fn(),
}))

import { createServiceClient } from '../lib/supabase'
import { constructWebhookEvent } from '../lib/stripe'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/webhooks', webhooks)
  return app
}

function makeChain(responses: Record<string, unknown> = {}) {
  const insertedRows: unknown[] = []
  const updatedRows: unknown[] = []
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data: responses['single'] ?? null, error: null })),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    _inserts: insertedRows,
    _updates: updatedRows,
  }
  // Make insert and update resolve
  chain.insert = vi.fn().mockResolvedValue({ error: null })
  chain.update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  return chain
}

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rejects requests without stripe-signature header', async () => {
    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    })
    expect(res.status).toBe(400)
  })

  it('rejects invalid webhook signatures', async () => {
    vi.mocked(constructWebhookEvent).mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad-sig' },
      body: '{}',
    })
    expect(res.status).toBe(400)
  })

  it('handles checkout.session.completed for a subscription', async () => {
    const event = {
      id: 'evt_test',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test',
          subscription: 'sub_test',
          payment_intent: 'pi_test',
          customer: 'cus_test',
          amount_total: 18000,
          currency: 'nzd',
          metadata: {
            userId: 'user-123',
            studioId: 'studio-abc',
            planId: 'plan-xyz',
            type: 'subscription',
            couponCode: '',
          },
        },
      },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain()
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
    // Should have inserted subscription and payment
    expect(chain.insert).toHaveBeenCalledTimes(2)
  })

  it('handles invoice.payment_succeeded (resets usage counters)', async () => {
    const subRecord = { id: 'sub-db-id', user_id: 'user-123', studio_id: 'studio-abc', plan_id: 'plan-xyz' }
    const event = {
      id: 'evt_invoice',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription: 'sub_stripe_id',
          amount_paid: 18000,
          currency: 'nzd',
          customer: 'cus_test',
          lines: { data: [{ period: { start: 1700000000, end: 1702678400 } }] },
          metadata: {},
        },
      },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain({ single: subRecord })
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    // Should update subscription and insert payment
    expect(chain.update).toHaveBeenCalled()
    expect(chain.insert).toHaveBeenCalled()
  })

  it('handles payment_intent.succeeded for class pack (sets remaining_classes)', async () => {
    const plan = { class_limit: 8, validity_days: 60 }
    const event = {
      id: 'evt_pi',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test',
          amount: 16000,
          currency: 'nzd',
          customer: 'cus_test',
          metadata: {
            userId: 'user-123',
            studioId: 'studio-abc',
            planId: 'plan-xyz',
            type: 'class_pack',
          },
        },
      },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain({ single: plan })
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    // Should insert class_pass and payment
    expect(chain.insert).toHaveBeenCalledTimes(2)
  })

  it('handles customer.subscription.deleted (marks cancelled)', async () => {
    const event = {
      id: 'evt_del',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_stripe_id' } },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain()
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalled()
  })

  it('handles customer.subscription.updated (syncs status)', async () => {
    const event = {
      id: 'evt_upd',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_stripe_id',
          status: 'active',
          cancel_at_period_end: false,
          current_period_start: 1700000000,
          current_period_end: 1702678400,
        },
      },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain()
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalled()
  })

  // ─── A6: account.updated ─────────────────────────────────────────────────
  it('handles account.updated → updates studio Stripe status', async () => {
    const event = {
      id: 'evt_acct',
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_connected_123',
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
        },
      },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain()
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_charges_enabled: true,
        stripe_payouts_enabled: true,
        stripe_details_submitted: true,
      }),
    )
  })

  // ─── A6: invoice.payment_failed ────────────────────────────────────────────
  it('handles invoice.payment_failed → marks subscription past_due', async () => {
    const event = {
      id: 'evt_inv_fail',
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: 'sub_stripe_123',
          attempt_count: 1,
        },
      },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain()
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalledWith({ status: 'past_due' })
  })

  it('handles invoice.payment_failed without subscription (no-op)', async () => {
    const event = {
      id: 'evt_inv_fail_nosub',
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: null,
          attempt_count: 1,
        },
      },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

    const chain = makeChain()
    vi.mocked(createServiceClient).mockReturnValue(chain as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: JSON.stringify(event),
    })
    expect(res.status).toBe(200)
    // Should not have called update since there's no subscription
    expect(chain.update).not.toHaveBeenCalled()
  })

  it('acknowledges unknown event types without error', async () => {
    const event = {
      id: 'evt_unk',
      type: 'some.unknown.event',
      data: { object: {} },
    }
    vi.mocked(constructWebhookEvent).mockReturnValue(event as any)
    vi.mocked(createServiceClient).mockReturnValue(makeChain() as any)

    const app = makeApp()
    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: '{}',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })
})
