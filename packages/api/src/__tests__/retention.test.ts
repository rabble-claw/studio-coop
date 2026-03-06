import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { computeRetentionScore } from '../lib/retention'
import retention from '../routes/retention'
import { errorHandler } from '../middleware/error-handler'

// ─── Unit tests for scoring logic ─────────────────────────────────────────────

describe('computeRetentionScore', () => {
  it('returns low score for active, attending member', () => {
    const result = computeRetentionScore({
      daysInactive: 2,
      attendanceLast4Weeks: 8,
      attendancePrior4Weeks: 7,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 200,
      engagementScore: 60,
    })
    expect(result.score).toBeLessThan(26)
    expect(result.stage).toBe('none')
  })

  it('returns high score for inactive member with cancelled sub', () => {
    const result = computeRetentionScore({
      daysInactive: 25,
      attendanceLast4Weeks: 0,
      attendancePrior4Weeks: 6,
      subscriptionStatus: 'cancelled',
      hasPaymentIssues: false,
      memberTenureDays: 180,
      engagementScore: 10,
    })
    expect(result.score).toBeGreaterThan(70)
    expect(['incentive', 'final']).toContain(result.stage)
  })

  it('assigns gentle_nudge stage for moderate risk', () => {
    const result = computeRetentionScore({
      daysInactive: 14,
      attendanceLast4Weeks: 2,
      attendancePrior4Weeks: 6,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 150,
      engagementScore: 30,
    })
    expect(result.score).toBeGreaterThanOrEqual(26)
    expect(result.score).toBeLessThanOrEqual(50)
    expect(result.stage).toBe('gentle_nudge')
  })

  it('increases risk for new members', () => {
    const newMember = computeRetentionScore({
      daysInactive: 5,
      attendanceLast4Weeks: 2,
      attendancePrior4Weeks: 0,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 14,
      engagementScore: 50,
    })
    const veteranMember = computeRetentionScore({
      daysInactive: 5,
      attendanceLast4Weeks: 2,
      attendancePrior4Weeks: 0,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 365,
      engagementScore: 50,
    })
    expect(newMember.score).toBeGreaterThan(veteranMember.score)
  })

  it('payment issues increase risk', () => {
    const noPay = computeRetentionScore({
      daysInactive: 5,
      attendanceLast4Weeks: 4,
      attendancePrior4Weeks: 4,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 200,
      engagementScore: 50,
    })
    const withPay = computeRetentionScore({
      daysInactive: 5,
      attendanceLast4Weeks: 4,
      attendancePrior4Weeks: 4,
      subscriptionStatus: 'active',
      hasPaymentIssues: true,
      memberTenureDays: 200,
      engagementScore: 50,
    })
    expect(withPay.score).toBeGreaterThan(noPay.score)
  })

  it('score is clamped between 0 and 100', () => {
    const perfect = computeRetentionScore({
      daysInactive: 0,
      attendanceLast4Weeks: 10,
      attendancePrior4Weeks: 5,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 365,
      engagementScore: 100,
    })
    expect(perfect.score).toBeGreaterThanOrEqual(0)
    expect(perfect.score).toBeLessThanOrEqual(100)

    const worst = computeRetentionScore({
      daysInactive: 60,
      attendanceLast4Weeks: 0,
      attendancePrior4Weeks: 10,
      subscriptionStatus: 'cancelled',
      hasPaymentIssues: true,
      memberTenureDays: 14,
      engagementScore: 0,
    })
    expect(worst.score).toBeGreaterThanOrEqual(95)
    expect(worst.stage).toBe('final')
  })

  it('returns factors with correct structure', () => {
    const result = computeRetentionScore({
      daysInactive: 10,
      attendanceLast4Weeks: 3,
      attendancePrior4Weeks: 5,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 200,
      engagementScore: 50,
    })

    expect(result.factors).toHaveProperty('days_inactive')
    expect(result.factors).toHaveProperty('attendance_trend')
    expect(result.factors).toHaveProperty('subscription_status')
    expect(result.factors).toHaveProperty('payment_issues')
    expect(result.factors).toHaveProperty('member_tenure')
    expect(result.factors).toHaveProperty('engagement')

    expect(result.factors.days_inactive).toHaveProperty('weight', 0.30)
    expect(result.factors.days_inactive).toHaveProperty('value')
    expect(result.factors.days_inactive).toHaveProperty('raw', 10)
  })

  it('cancel_at_period_end is higher risk than active', () => {
    const active = computeRetentionScore({
      daysInactive: 5,
      attendanceLast4Weeks: 4,
      attendancePrior4Weeks: 4,
      subscriptionStatus: 'active',
      hasPaymentIssues: false,
      memberTenureDays: 200,
      engagementScore: 50,
    })
    const cancelling = computeRetentionScore({
      daysInactive: 5,
      attendanceLast4Weeks: 4,
      attendancePrior4Weeks: 4,
      subscriptionStatus: 'cancel_at_period_end',
      hasPaymentIssues: false,
      memberTenureDays: 200,
      engagementScore: 50,
    })
    expect(cancelling.score).toBeGreaterThan(active.score)
  })
})

// ─── Route tests ──────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-staff', email: 'staff@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireStaff: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
  requireAdmin: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', retention)
  return app
}

function makeAsyncChain(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

describe('GET /api/studios/:studioId/retention/summary', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns aggregate retention metrics', async () => {
    const scores = [
      { score: 10, stage: 'none' },
      { score: 35, stage: 'gentle_nudge' },
      { score: 60, stage: 'we_miss_you' },
      { score: 80, stage: 'incentive' },
    ]

    const chain = makeAsyncChain({ data: scores })
    ;(createServiceClient as any).mockReturnValue({ from: () => chain })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/retention/summary`)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.total_scored).toBe(4)
    expect(body.avg_score).toBe(46)
    expect(body.stages.none).toBe(1)
    expect(body.stages.gentle_nudge).toBe(1)
    expect(body.stages.we_miss_you).toBe(1)
    expect(body.stages.incentive).toBe(1)
    expect(body.tiers.low).toBe(1)
    expect(body.tiers.moderate).toBe(1)
    expect(body.tiers.high).toBe(1)
    expect(body.tiers.critical).toBe(1)
  })
})

describe('GET /api/studios/:studioId/retention/scores', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns scored members with user info', async () => {
    const scores = [
      { id: 's1', user_id: 'u1', score: 75, factors: {}, stage: 'incentive', computed_at: '2026-01-01' },
    ]
    const users = [
      { id: 'u1', name: 'Alice', email: 'alice@e.com' },
    ]

    const scoresChain = makeAsyncChain({ data: scores })
    const usersChain = makeAsyncChain({ data: users })

    let callCount = 0
    ;(createServiceClient as any).mockReturnValue({
      from: (table: string) => {
        if (table === 'member_risk_scores') return scoresChain
        if (table === 'users') return usersChain
        return scoresChain
      },
    })

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/retention/scores`)
    expect(res.status).toBe(200)

    const body = await res.json() as any
    expect(body.scores).toHaveLength(1)
    expect(body.scores[0].member_name).toBe('Alice')
    expect(body.scores[0].score).toBe(75)
  })
})
