/**
 * End-to-End API Journey Test
 *
 * Walks through the complete studio lifecycle at the API layer:
 *   Owner creates studio → connects Stripe → templates → schedule → plans
 *   Student discovers → subscribes → books → cancels
 *   Teacher checks in students
 *   Owner manages finances → views reports → views members
 *
 * Uses the same mock patterns as existing tests (makeAsyncChain, auth middleware, etc.)
 * but shares a journeyState object across describe blocks.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from '../middleware/error-handler'

// ─── Route imports ────────────────────────────────────────────────────────────

import studioSettings from '../routes/studio-settings'
import { stripeRoutes } from '../routes/stripe'
import templates from '../routes/templates'
import schedule from '../routes/schedule'
import plans from '../routes/plans'
import discover from '../routes/discover'
import bookings from '../routes/bookings'
import webhooks from '../routes/webhooks'
import checkin from '../routes/checkin'
import finances from '../routes/finances'
import reports from '../routes/reports'
import memberRoutes from '../routes/members'

// ─── Shared journey state ─────────────────────────────────────────────────────

const journeyState = {
  ownerId: 'owner-001',
  ownerEmail: 'owner@studio.coop',
  studentId: 'student-001',
  studentEmail: 'student@example.com',
  teacherId: 'teacher-001',
  teacherEmail: 'teacher@studio.coop',

  studioId: 'studio-journey-1',
  studioSlug: 'journey-dance',
  stripeAccountId: 'acct_journey',
  templateId: 'tmpl-journey-1',
  classId: 'class-journey-1',
  planId: 'plan-journey-1',
  stripePriceId: 'price_journey',
  subscriptionId: 'sub-journey-1',
  stripeSubId: 'sub_stripe_journey',
  bookingId: 'booking-journey-1',
  expenseId: 'exp-journey-1',
}

// ─── Dynamic user switching ───────────────────────────────────────────────────

let currentUser = { id: journeyState.ownerId, email: journeyState.ownerEmail }

function setCurrentUser(role: 'owner' | 'student' | 'teacher') {
  if (role === 'owner') {
    currentUser = { id: journeyState.ownerId, email: journeyState.ownerEmail }
  } else if (role === 'student') {
    currentUser = { id: journeyState.studentId, email: journeyState.studentEmail }
  } else {
    currentUser = { id: journeyState.teacherId, email: journeyState.teacherEmail }
  }
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/stripe', () => ({
  createStripeClient: vi.fn(),
  constructWebhookEvent: vi.fn(),
  createStripePrice: vi.fn(),
  createCheckoutSession: vi.fn(),
}))
vi.mock('../lib/payments', () => ({
  getConnectedAccountId: vi.fn().mockResolvedValue('acct_journey'),
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue({
    id: 'cus_student',
    object: 'customer',
    email: 'student@example.com',
    metadata: {},
  }),
}))
vi.mock('../lib/credits', () => ({
  checkBookingCredits: vi.fn(),
  deductCredit: vi.fn(),
  refundCredit: vi.fn(),
}))
vi.mock('../lib/waitlist', () => ({
  addToWaitlist: vi.fn(),
  promoteFromWaitlist: vi.fn(),
}))
vi.mock('../lib/calendar', () => ({
  buildBookingCalEvent: vi.fn().mockReturnValue('BEGIN:VCALENDAR...'),
}))
vi.mock('../lib/class-generator', () => ({
  generateClassInstances: vi.fn(),
}))
vi.mock('../lib/milestones', () => ({
  checkAndCreateMilestones: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../lib/finance-helpers', () => ({
  computeMonthlyRevenue: vi.fn(),
  computeMonthlyExpenses: vi.fn(),
  computeInstructorCosts: vi.fn(),
  computeHealthScore: vi.fn(),
  getIndustryBenchmarks: vi.fn(),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', currentUser)
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
    await next()
  }),
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'staff')
    await next()
  }),
  requireAdmin: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
}))

// ─── Mock imports (after vi.mock calls) ───────────────────────────────────────

import { createServiceClient } from '../lib/supabase'
import { createStripeClient, constructWebhookEvent, createStripePrice, createCheckoutSession } from '../lib/stripe'
import { checkBookingCredits, deductCredit, refundCredit } from '../lib/credits'
import { promoteFromWaitlist } from '../lib/waitlist'
import { generateClassInstances } from '../lib/class-generator'
import {
  computeMonthlyRevenue,
  computeMonthlyExpenses,
  computeInstructorCosts,
  computeHealthScore,
  getIndustryBenchmarks,
} from '../lib/finance-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAsyncChain(result: { data: unknown; error: unknown; count?: number }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  }
  if (result.count !== undefined) {
    chain.count = result.count
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  // Mount all routes matching packages/api/src/index.ts
  app.route('/api/studios', studioSettings)
  app.route('/api/studios', stripeRoutes)
  app.route('/api/studios', templates)
  app.route('/api/studios', schedule)
  app.route('/api/studios', plans)
  app.route('/api/studios', bookings)
  app.route('/api/studios', finances)
  app.route('/api/studios', reports)
  app.route('/api/studios', memberRoutes)
  app.route('/api/webhooks', webhooks)
  app.route('/api/classes', checkin)
  app.route('/api/discover', discover)
  return app
}

const headers = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }
const SID = journeyState.studioId

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
process.env.STRIPE_SECRET_KEY = 'sk_test_journey'

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNEY START
// ═══════════════════════════════════════════════════════════════════════════════

describe('Full User Journey', () => {
  beforeAll(() => {
    setCurrentUser('owner')
  })

  // ─── 1. Owner creates studio / configures settings ────────────────────────

  describe('1. Owner configures studio settings', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('GET settings returns studio configuration', async () => {
      const studioData = {
        id: SID,
        name: 'Journey Dance Studio',
        slug: journeyState.studioSlug,
        settings: { notifications: { email: true }, cancellation: { window_hours: 12 } },
      }
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: studioData, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/settings`, { method: 'GET', headers })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.studioId || body.general || body.cancellation).toBeDefined()
    })

    it('PUT updates studio general settings', async () => {
      const updated = {
        id: SID,
        name: 'Journey Dance Studio',
        slug: journeyState.studioSlug,
        discipline: 'dance',
      }
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: updated, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/settings/general`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: 'Journey Dance Studio', discipline: 'dance' }),
      })

      expect(res.status).toBe(200)
    })
  })

  // ─── 2. Owner connects Stripe ─────────────────────────────────────────────

  describe('2. Owner connects Stripe', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('POST onboard creates Stripe Connect account', async () => {
      const supabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: SID, stripe_account_id: null },
          error: null,
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(supabase as any)

      const mockStripe = {
        accounts: {
          create: vi.fn().mockResolvedValue({ id: journeyState.stripeAccountId }),
          retrieve: vi.fn(),
          createLoginLink: vi.fn(),
        },
        accountLinks: {
          create: vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/setup/journey' }),
        },
      }
      vi.mocked(createStripeClient).mockReturnValue(mockStripe as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/stripe/onboard`, {
        method: 'POST',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.url).toContain('stripe.com')
    })

    it('GET status returns Stripe connection status', async () => {
      const supabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { stripe_account_id: journeyState.stripeAccountId },
          error: null,
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(supabase as any)

      const mockStripe = {
        accounts: {
          create: vi.fn(),
          retrieve: vi.fn().mockResolvedValue({
            id: journeyState.stripeAccountId,
            charges_enabled: true,
            details_submitted: true,
          }),
          createLoginLink: vi.fn(),
        },
        accountLinks: { create: vi.fn() },
      }
      vi.mocked(createStripeClient).mockReturnValue(mockStripe as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/stripe/status`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.connected).toBe(true)
      expect(body.chargesEnabled).toBe(true)
    })
  })

  // ─── 3. Owner creates class templates ─────────────────────────────────────

  describe('3. Owner creates class templates', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('POST creates a new template', async () => {
      const newTemplate = {
        id: journeyState.templateId,
        studio_id: SID,
        name: 'Beginner Aerial Silks',
        duration_min: 60,
        max_capacity: 12,
        location: 'Studio A',
      }
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: newTemplate, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Beginner Aerial Silks',
          start_time: '10:00',
          duration_min: 60,
          max_capacity: 12,
          location: 'Studio A',
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.template || body.id).toBeDefined()
    })

    it('GET lists templates', async () => {
      const templateList = [
        { id: journeyState.templateId, name: 'Beginner Aerial Silks', duration_min: 60, max_capacity: 12 },
        { id: 'tmpl-2', name: 'Advanced Trapeze', duration_min: 75, max_capacity: 8 },
      ]
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: templateList, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/templates`, { method: 'GET', headers })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.templates).toHaveLength(2)
    })

    it('PUT updates a template', async () => {
      const updated = {
        id: journeyState.templateId,
        name: 'Beginner Aerial Silks',
        duration_min: 75,
        max_capacity: 14,
      }
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: updated, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/templates/${journeyState.templateId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ duration_min: 75, max_capacity: 14 }),
      })

      expect(res.status).toBe(200)
    })
  })

  // ─── 4. Owner generates schedule ──────────────────────────────────────────

  describe('4. Owner generates schedule', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('POST generate-classes creates class instances', async () => {
      vi.mocked(generateClassInstances).mockResolvedValue({
        created: 4,
        skipped: 0,
      } as any)

      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/generate-classes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ weeks: 2 }),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.generated).toBeDefined()
    })

    it('GET schedule returns class instances', async () => {
      const classes = [
        {
          id: journeyState.classId,
          date: '2026-03-05',
          start_time: '10:00:00',
          status: 'scheduled',
          template: { id: journeyState.templateId, name: 'Beginner Aerial Silks' },
          teacher: { id: journeyState.teacherId, name: 'Jane' },
          max_capacity: 12,
          booked_count: 0,
        },
      ]
      const mock = {
        from: vi.fn(() => {
          const chain = makeAsyncChain({ data: classes, error: null })
          chain.gte = vi.fn().mockReturnThis()
          chain.lte = vi.fn().mockReturnThis()
          chain.then = (res: any) => Promise.resolve({ data: classes, error: null }).then(res)
          return chain
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/schedule?from=2026-03-01&to=2026-03-14`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(Array.isArray(body)).toBe(true)
    })
  })

  // ─── 5. Owner creates membership plan ─────────────────────────────────────

  describe('5. Owner creates membership plan', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('POST creates a new plan with Stripe price', async () => {
      const newPlan = {
        id: journeyState.planId,
        studio_id: SID,
        name: 'Unlimited Monthly',
        type: 'unlimited',
        price_cents: 18000,
        stripe_price_id: journeyState.stripePriceId,
        active: true,
      }
      vi.mocked(createStripePrice).mockResolvedValue({ id: journeyState.stripePriceId } as any)
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: newPlan, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/plans`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Unlimited Monthly',
          type: 'unlimited',
          priceCents: 18000,
          interval: 'month',
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.plan || body.id).toBeDefined()
    })

    it('GET lists plans', async () => {
      const planList = [
        { id: journeyState.planId, name: 'Unlimited Monthly', type: 'unlimited', price_cents: 18000, active: true },
        { id: 'plan-2', name: '10-Class Pack', type: 'class_pack', price_cents: 16000, active: true },
      ]
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: planList, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/plans`, { method: 'GET', headers })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.plans).toHaveLength(2)
    })

    it('GET plan subscribers returns subscriber list', async () => {
      const subscribers = [
        { id: 'sub-1', user_id: journeyState.studentId, status: 'active', user: { name: 'Student One' } },
      ]
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: subscribers, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/plans/${journeyState.planId}/subscribers`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.subscribers).toBeDefined()
    })
  })

  // ─── 6. Student discovers studio ──────────────────────────────────────────

  describe('6. Student discovers studio', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('student')
    })

    it('GET /discover/studios returns studio listings', async () => {
      const studios = [
        { id: SID, name: 'Journey Dance Studio', slug: journeyState.studioSlug, discipline: 'dance', city: 'Auckland' },
      ]
      const mock = {
        from: vi.fn(() => {
          const chain = makeAsyncChain({ data: studios, error: null, count: 1 })
          chain.textSearch = vi.fn().mockReturnThis()
          chain.ilike = vi.fn().mockReturnThis()
          chain.range = vi.fn().mockReturnThis()
          chain.then = (res: any) => Promise.resolve({ data: studios, error: null, count: 1 }).then(res)
          return chain
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request('/api/discover/studios', { method: 'GET', headers })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.studios || body.data).toBeDefined()
    })

    it('GET /discover/studios/:slug returns studio profile', async () => {
      const studioProfile = {
        id: SID,
        name: 'Journey Dance Studio',
        slug: journeyState.studioSlug,
        discipline: 'dance',
        description: 'A great dance studio',
      }
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'studios') {
            return makeAsyncChain({ data: studioProfile, error: null })
          }
          // classes, plans, member count
          return makeAsyncChain({ data: [], error: null, count: 25 })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/discover/studios/${journeyState.studioSlug}`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.name || body.studio).toBeDefined()
    })

    it('GET /discover/filters returns available filters', async () => {
      const mock = {
        from: vi.fn(() => {
          const chain = makeAsyncChain({ data: [], error: null })
          chain.then = (res: any) => Promise.resolve({ data: [{ discipline: 'dance', city: 'Auckland' }], error: null }).then(res)
          return chain
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request('/api/discover/filters', { method: 'GET', headers })

      expect(res.status).toBe(200)
    })
  })

  // ─── 7. Student subscribes to plan ────────────────────────────────────────

  describe('7. Student subscribes to plan', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('student')
    })

    it('POST subscribe creates checkout session', async () => {
      const mockPlan = {
        id: journeyState.planId,
        stripe_price_id: journeyState.stripePriceId,
        type: 'unlimited',
        active: true,
      }
      const chain = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPlan, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      }
      vi.mocked(createServiceClient).mockReturnValue(chain as any)
      vi.mocked(createCheckoutSession).mockResolvedValue({
        id: 'cs_journey',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/pay/cs_journey',
        payment_intent: null,
        subscription: null,
        customer: 'cus_student',
        metadata: {},
      } as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/plans/${journeyState.planId}/subscribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          successUrl: 'https://studio.coop/success',
          cancelUrl: 'https://studio.coop/cancel',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.checkoutUrl).toContain('stripe.com')
    })

    it('webhook processes checkout.session.completed', async () => {
      const event = {
        id: 'evt_journey',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_journey',
            subscription: journeyState.stripeSubId,
            payment_intent: 'pi_journey',
            customer: 'cus_student',
            amount_total: 18000,
            currency: 'nzd',
            metadata: {
              userId: journeyState.studentId,
              studioId: SID,
              planId: journeyState.planId,
              type: 'subscription',
              couponCode: '',
            },
          },
        },
      }
      vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

      const chain = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      }
      vi.mocked(createServiceClient).mockReturnValue(chain as any)

      const app = makeApp()
      const res = await app.request('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid-sig' },
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.received).toBe(true)
      expect(chain.insert).toHaveBeenCalled()
    })

    it('webhook handles invoice.payment_succeeded', async () => {
      const subRecord = {
        id: journeyState.subscriptionId,
        user_id: journeyState.studentId,
        studio_id: SID,
        plan_id: journeyState.planId,
      }
      const event = {
        id: 'evt_invoice_journey',
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: journeyState.stripeSubId,
            amount_paid: 18000,
            currency: 'nzd',
            customer: 'cus_student',
            lines: { data: [{ period: { start: 1700000000, end: 1702678400 } }] },
            metadata: {},
          },
        },
      }
      vi.mocked(constructWebhookEvent).mockReturnValue(event as any)

      const chain = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        single: vi.fn().mockResolvedValue({ data: subRecord, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      }
      vi.mocked(createServiceClient).mockReturnValue(chain as any)

      const app = makeApp()
      const res = await app.request('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid-sig' },
        body: JSON.stringify(event),
      })

      expect(res.status).toBe(200)
    })
  })

  // ─── 8. Student books a class ─────────────────────────────────────────────

  describe('8. Student books a class', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('student')
    })

    const scheduledClass = {
      id: journeyState.classId,
      studio_id: SID,
      status: 'scheduled',
      max_capacity: 12,
      date: '2026-03-05',
      start_time: '10:00:00',
      template: { name: 'Beginner Aerial Silks', location: 'Studio A', duration_min: 60 },
      teacher: { name: 'Jane' },
      studio: { name: 'Journey Dance Studio', timezone: 'Pacific/Auckland', settings: {} },
    }

    it('POST book creates a booking with subscription credit', async () => {
      let bookingsCallCount = 0
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'class_instances') {
            return makeAsyncChain({ data: scheduledClass, error: null })
          }
          if (table === 'bookings') {
            bookingsCallCount++
            if (bookingsCallCount === 1) return makeAsyncChain({ data: null, error: null })
            if (bookingsCallCount === 2) return makeAsyncChain({ data: null, error: null, count: 3 })
            if (bookingsCallCount === 3) {
              const insertChain: any = {
                insert: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: journeyState.bookingId },
                      error: null,
                    }),
                  }),
                }),
              }
              return insertChain
            }
            return makeAsyncChain({ data: null, error: null, count: 4 })
          }
          return makeAsyncChain({ data: null, error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)
      vi.mocked(checkBookingCredits).mockResolvedValue({
        hasCredits: true,
        source: 'subscription_unlimited',
        sourceId: journeyState.subscriptionId,
      })
      vi.mocked(deductCredit).mockResolvedValue()

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/classes/${journeyState.classId}/book`, {
        method: 'POST',
        headers,
      })

      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.status).toBe('booked')
      expect(body.creditSource).toBe('subscription_unlimited')
      expect(deductCredit).toHaveBeenCalled()
    })

    it('returns 409 when already booked', async () => {
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'class_instances') {
            return makeAsyncChain({ data: scheduledClass, error: null })
          }
          if (table === 'bookings') {
            return makeAsyncChain({ data: { id: journeyState.bookingId, status: 'booked' }, error: null })
          }
          return makeAsyncChain({ data: null, error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/classes/${journeyState.classId}/book`, {
        method: 'POST',
        headers,
      })

      expect(res.status).toBe(409)
    })

    it('GET class detail returns class info', async () => {
      const classDetail = {
        id: journeyState.classId,
        date: '2026-03-05',
        start_time: '10:00:00',
        status: 'scheduled',
        max_capacity: 12,
        booked_count: 4,
        template: { id: journeyState.templateId, name: 'Beginner Aerial Silks', location: 'Studio A', duration_min: 60 },
        teacher: { id: journeyState.teacherId, name: 'Jane' },
      }
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: classDetail, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/classes/${journeyState.classId}`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.id || body.class).toBeDefined()
    })
  })

  // ─── 9. Student cancels booking ───────────────────────────────────────────

  describe('9. Student cancels booking', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('student')
    })

    it('DELETE cancels the booking and refunds credit', async () => {
      const updateChain = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'bookings') {
            return {
              ...makeAsyncChain({
                data: {
                  id: journeyState.bookingId,
                  user_id: journeyState.studentId,
                  status: 'booked',
                  credit_source: 'subscription_unlimited',
                  credit_source_id: journeyState.subscriptionId,
                  class_instance_id: journeyState.classId,
                },
                error: null,
              }),
              update: vi.fn().mockReturnValue(updateChain),
            }
          }
          if (table === 'class_instances') {
            return makeAsyncChain({ data: { id: journeyState.classId }, error: null })
          }
          return makeAsyncChain({ data: null, error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)
      vi.mocked(promoteFromWaitlist).mockResolvedValue()

      const app = makeApp()
      const res = await app.request(
        `/api/studios/${SID}/classes/${journeyState.classId}/bookings/${journeyState.bookingId}`,
        { method: 'DELETE', headers },
      )

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('cancelled')
      expect(promoteFromWaitlist).toHaveBeenCalledWith(journeyState.classId)
    })

    it('DELETE returns 400 when already cancelled', async () => {
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'bookings') {
            return makeAsyncChain({
              data: {
                id: journeyState.bookingId,
                user_id: journeyState.studentId,
                status: 'cancelled',
                credit_source: null,
                credit_source_id: null,
                class_instance_id: journeyState.classId,
              },
              error: null,
            })
          }
          return makeAsyncChain({ data: null, error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(
        `/api/studios/${SID}/classes/${journeyState.classId}/bookings/${journeyState.bookingId}`,
        { method: 'DELETE', headers },
      )

      expect(res.status).toBe(400)
    })
  })

  // ─── 10. Teacher checks in students ───────────────────────────────────────

  describe('10. Teacher checks in students', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('teacher')
    })

    it('GET roster returns class roster', async () => {
      const rosterData = [
        { id: 'b-1', status: 'booked', spot: 1, user: { id: journeyState.studentId, name: 'Student One', avatar_url: null } },
      ]
      let membershipsCallCount = 0
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'class_instances') {
            return makeAsyncChain({
              data: { id: journeyState.classId, studio_id: SID, max_capacity: 12, status: 'scheduled' },
              error: null,
            })
          }
          if (table === 'memberships') {
            membershipsCallCount++
            if (membershipsCallCount === 1) {
              // getClassAndVerifyStaff: .single() returns single object
              return makeAsyncChain({
                data: { role: 'teacher', user_id: journeyState.teacherId },
                error: null,
              })
            }
            // Second call: roster notes query — no .single(), returns array
            const notesResult = { data: [{ user_id: journeyState.studentId, notes: null }], error: null }
            const chain = makeAsyncChain(notesResult)
            chain.then = (res: any) => Promise.resolve(notesResult).then(res)
            return chain
          }
          if (table === 'bookings') {
            const chain = makeAsyncChain({ data: rosterData, error: null })
            chain.then = (res: any) => Promise.resolve({ data: rosterData, error: null }).then(res)
            return chain
          }
          if (table === 'attendance') {
            const chain = makeAsyncChain({ data: [], error: null })
            chain.then = (res: any) => Promise.resolve({ data: [], error: null }).then(res)
            return chain
          }
          return makeAsyncChain({ data: null, error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/classes/${journeyState.classId}/roster`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(Array.isArray(body)).toBe(true)
      expect(body).toHaveLength(1)
    })

    it('POST checkin marks students as checked in', async () => {
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'class_instances') {
            return makeAsyncChain({
              data: { id: journeyState.classId, studio_id: SID, status: 'scheduled' },
              error: null,
            })
          }
          if (table === 'memberships') {
            return makeAsyncChain({
              data: { role: 'teacher', user_id: journeyState.teacherId },
              error: null,
            })
          }
          if (table === 'attendance') {
            // existing attendance query returns empty, then insert resolves
            const chain = makeAsyncChain({ data: [], error: null })
            chain.insert = vi.fn().mockResolvedValue({ error: null })
            chain.then = (res: any) => Promise.resolve({ data: [], error: null }).then(res)
            return chain
          }
          return makeAsyncChain({ data: null, error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/classes/${journeyState.classId}/checkin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          attendees: [{ userId: journeyState.studentId, checkedIn: true }],
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.ok).toBe(true)
      expect(body.processed).toBe(1)
    })

    it('POST complete marks class as completed', async () => {
      let classInstancesCallCount = 0
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'class_instances') {
            classInstancesCallCount++
            if (classInstancesCallCount === 1) {
              // getClassAndVerifyStaff: returns class with in_progress
              return makeAsyncChain({
                data: { id: journeyState.classId, studio_id: SID, status: 'in_progress', max_capacity: 12 },
                error: null,
              })
            }
            // Second call: update status to completed
            return {
              ...makeAsyncChain({ data: null, error: null }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }
          }
          if (table === 'memberships') {
            return makeAsyncChain({
              data: { role: 'teacher', user_id: journeyState.teacherId },
              error: null,
            })
          }
          if (table === 'bookings') {
            // Active bookings query — returns empty (all checked in)
            const chain = makeAsyncChain({ data: [], error: null })
            chain.then = (res: any) => Promise.resolve({ data: [], error: null }).then(res)
            chain.update = vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            })
            return chain
          }
          if (table === 'attendance') {
            // Attendance records — student checked in
            const attData = [{ user_id: journeyState.studentId, checked_in: true }]
            const chain = makeAsyncChain({ data: attData, error: null })
            chain.then = (res: any) => Promise.resolve({ data: attData, error: null }).then(res)
            return chain
          }
          if (table === 'notifications') {
            return {
              ...makeAsyncChain({ data: null, error: null }),
              insert: vi.fn().mockResolvedValue({ error: null }),
            }
          }
          return makeAsyncChain({ data: null, error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/classes/${journeyState.classId}/complete`, {
        method: 'POST',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.ok).toBe(true)
      expect(body.no_shows).toBeDefined()
    })
  })

  // ─── 11. Owner creates expenses ───────────────────────────────────────────

  describe('11. Owner creates expenses', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('GET expense categories returns list', async () => {
      const categories = [
        { id: 'cat-1', name: 'Rent', icon: 'home', sort_order: 0 },
        { id: 'cat-2', name: 'Utilities', icon: 'zap', sort_order: 1 },
      ]
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: categories, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/finances/expense-categories`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.categories).toHaveLength(2)
    })

    it('POST creates an expense', async () => {
      const newExpense = {
        id: journeyState.expenseId,
        studio_id: SID,
        name: 'Studio Rent',
        amount_cents: 200000,
        category: { id: 'cat-1', name: 'Rent', icon: 'home' },
      }
      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: newExpense, error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/finances/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          categoryId: 'cat-1',
          name: 'Studio Rent',
          amountCents: 200000,
          recurrence: 'monthly',
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.expense).toBeDefined()
    })

    it('POST returns 400 for missing fields', async () => {
      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/finances/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })
  })

  // ─── 12. Owner views financial reports ────────────────────────────────────

  describe('12. Owner views financial reports', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('GET overview returns financial summary', async () => {
      vi.mocked(computeMonthlyRevenue).mockResolvedValue({
        total: 500000,
        subscription: 400000,
        class_pack: 50000,
        drop_in: 25000,
        private_booking: 25000,
      } as any)
      vi.mocked(computeMonthlyExpenses).mockReturnValue({ total: 250000, byCategory: {} } as any)
      vi.mocked(computeInstructorCosts).mockResolvedValue({ total: 100000, instructors: [] } as any)

      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/finances/overview`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.revenue).toBeDefined()
      expect(body.expenses).toBeDefined()
      expect(body.netIncome).toBeDefined()
    })

    it('GET pnl returns monthly P&L', async () => {
      vi.mocked(computeMonthlyRevenue).mockResolvedValue({
        total: 500000,
        subscription: 400000,
        class_pack: 50000,
        drop_in: 25000,
        private_booking: 25000,
      } as any)
      vi.mocked(computeMonthlyExpenses).mockReturnValue({ total: 300000, byCategory: {} } as any)
      vi.mocked(computeInstructorCosts).mockResolvedValue({ total: 50000, instructors: [] } as any)

      const mock = {
        from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/finances/pnl?months=3`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.pnl).toBeDefined()
      expect(Array.isArray(body.pnl)).toBe(true)
    })

    it('GET health-check returns financial health', async () => {
      vi.mocked(computeMonthlyRevenue).mockResolvedValue({ total: 500000 } as any)
      vi.mocked(computeMonthlyExpenses).mockReturnValue({ total: 200000, byCategory: {} } as any)
      vi.mocked(computeInstructorCosts).mockResolvedValue({ total: 100000, instructors: [] } as any)
      vi.mocked(computeHealthScore).mockReturnValue({
        score: 82,
        grade: 'A',
        indicators: [{ name: 'Profit Margin', status: 'good', detail: 'Above target' }],
      } as any)
      vi.mocked(getIndustryBenchmarks).mockReturnValue({ profitMarginTarget: 0.2 } as any)

      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'studios') {
            return makeAsyncChain({ data: { discipline: 'dance' }, error: null })
          }
          if (table === 'memberships') {
            return makeAsyncChain({ data: null, error: null, count: 45 })
          }
          if (table === 'class_instances') {
            return makeAsyncChain({
              data: [{ max_capacity: 12, booked_count: 9 }, { max_capacity: 12, booked_count: 10 }],
              error: null,
            })
          }
          return makeAsyncChain({ data: [], error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/finances/health-check`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.healthScore).toBeDefined()
      expect(body.healthScore.score).toBe(82)
    })
  })

  // ─── 13. Owner views analytics reports ────────────────────────────────────

  describe('13. Owner views analytics', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('GET reports/overview returns summary', async () => {
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'memberships') {
            return makeAsyncChain({ data: null, error: null, count: 45 })
          }
          if (table === 'payments') {
            const chain = makeAsyncChain({ data: [{ amount_cents: 500000 }], error: null })
            chain.gte = vi.fn().mockReturnThis()
            chain.then = (res: any) =>
              Promise.resolve({ data: [{ amount_cents: 500000 }], error: null }).then(res)
            return chain
          }
          if (table === 'bookings') {
            return makeAsyncChain({ data: null, error: null, count: 120 })
          }
          return makeAsyncChain({ data: [], error: null, count: 0 })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/reports/overview`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.activeMembers).toBeDefined()
      expect(body.totalRevenue).toBeDefined()
    })

    it('GET reports/popular-classes returns ranked classes', async () => {
      const popularClasses = [
        { template_name: 'Beginner Aerial Silks', avg_attendance: 10, total_classes: 8 },
        { template_name: 'Advanced Trapeze', avg_attendance: 7, total_classes: 4 },
      ]
      const mock = {
        from: vi.fn(() => {
          const chain = makeAsyncChain({ data: popularClasses, error: null })
          chain.gte = vi.fn().mockReturnThis()
          chain.then = (res: any) =>
            Promise.resolve({ data: popularClasses, error: null }).then(res)
          return chain
        }),
        rpc: vi.fn().mockResolvedValue({ data: popularClasses, error: null }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/reports/popular-classes`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.classes || body.popularClasses || Array.isArray(body)).toBeTruthy()
    })

    it('GET reports/at-risk returns at-risk members', async () => {
      const atRisk = [
        { id: 'u-1', name: 'Inactive User', last_attended: '2026-02-01', days_since: 30 },
      ]
      const mock = {
        from: vi.fn(() => {
          const chain = makeAsyncChain({ data: atRisk, error: null })
          chain.lt = vi.fn().mockReturnThis()
          chain.then = (res: any) => Promise.resolve({ data: atRisk, error: null }).then(res)
          return chain
        }),
        rpc: vi.fn().mockResolvedValue({ data: atRisk, error: null }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/reports/at-risk`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.members || body.atRisk || Array.isArray(body)).toBeTruthy()
    })
  })

  // ─── 14. Owner views members ──────────────────────────────────────────────

  describe('14. Owner views members', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      setCurrentUser('owner')
    })

    it('GET members returns member list', async () => {
      const members = [
        {
          id: 'mem-1',
          user_id: journeyState.studentId,
          role: 'member',
          status: 'active',
          user: { id: journeyState.studentId, name: 'Student One', email: journeyState.studentEmail },
        },
        {
          id: 'mem-2',
          user_id: journeyState.teacherId,
          role: 'staff',
          status: 'active',
          user: { id: journeyState.teacherId, name: 'Jane Teacher', email: journeyState.teacherEmail },
        },
      ]
      const mock = {
        from: vi.fn(() => {
          const chain = makeAsyncChain({ data: members, error: null, count: 2 })
          chain.ilike = vi.fn().mockReturnThis()
          chain.range = vi.fn().mockReturnThis()
          chain.then = (res: any) => Promise.resolve({ data: members, error: null, count: 2 }).then(res)
          return chain
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/members`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.members).toBeDefined()
    })

    it('GET member detail returns member info with history', async () => {
      const memberDetail = {
        id: 'mem-1',
        user_id: journeyState.studentId,
        role: 'member',
        status: 'active',
        joined_at: '2026-02-01',
        user: { id: journeyState.studentId, name: 'Student One', email: journeyState.studentEmail },
      }
      const mock = {
        from: vi.fn((table: string) => {
          if (table === 'memberships') {
            return makeAsyncChain({ data: memberDetail, error: null })
          }
          if (table === 'bookings') {
            return makeAsyncChain({ data: [], error: null, count: 5 })
          }
          if (table === 'subscriptions') {
            return makeAsyncChain({ data: [], error: null })
          }
          if (table === 'staff_notes') {
            return makeAsyncChain({ data: null, error: null })
          }
          return makeAsyncChain({ data: [], error: null })
        }),
      }
      vi.mocked(createServiceClient).mockReturnValue(mock as any)

      const app = makeApp()
      const res = await app.request(`/api/studios/${SID}/members/mem-1`, {
        method: 'GET',
        headers,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.member || body.id || body.user).toBeDefined()
    })
  })
})
