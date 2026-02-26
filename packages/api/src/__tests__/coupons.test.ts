import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import coupons from '../routes/coupons'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'admin-user-1', email: 'admin@example.com' })
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'
const COUPON_ID = 'coupon-1'
const USER_ID   = 'admin-user-1'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', coupons)
  return app
}

// Helper: build a resolved chain (for queries without .single())
function makeListChain(data: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (res: any) => Promise.resolve({ data, error: null }).then(res),
    catch: (rej: any) => Promise.resolve({ data, error: null }).catch(rej),
    [Symbol.toStringTag]: 'Promise',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Coupon CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/coupons', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeCouponCreateMock(existingCode: object | null, insertResult: object | null) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'coupons') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingCode, error: null }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: insertResult,
              error: insertResult ? null : { message: 'Insert failed' },
            }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
  }

  it('creates a percent_off coupon and returns 201', async () => {
    const mockCoupon = {
      id: COUPON_ID,
      studio_id: STUDIO_ID,
      code: 'SAVE20',
      type: 'percent_off',
      value: 20,
      applies_to: 'any',
      active: true,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeCouponCreateMock(null, mockCoupon) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE20', type: 'percent_off', value: 20 }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.coupon.code).toBe('SAVE20')
    expect(body.coupon.type).toBe('percent_off')
  })

  it('creates a free_classes coupon', async () => {
    const mockCoupon = {
      id: COUPON_ID,
      studio_id: STUDIO_ID,
      code: 'FREE2',
      type: 'free_classes',
      value: 2,
      applies_to: 'new_member',
      active: true,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeCouponCreateMock(null, mockCoupon) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'FREE2',
        type: 'free_classes',
        value: 2,
        appliesTo: 'new_member',
      }),
    })

    expect(res.status).toBe(201)
  })

  it('returns 409 when coupon code already exists for studio', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeCouponCreateMock({ id: 'existing' }, null) as any,
    )

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE20', type: 'percent_off', value: 20 }),
    })

    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid code format (lowercase)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeCouponCreateMock(null, null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'lowercase', type: 'percent_off', value: 20 }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when percent_off value exceeds 100', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeCouponCreateMock(null, null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BIG', type: 'percent_off', value: 110 }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when validFrom is after validUntil', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeCouponCreateMock(null, null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'BADDATE',
        type: 'amount_off',
        value: 500,
        validFrom: '2026-12-31T00:00:00Z',
        validUntil: '2026-01-01T00:00:00Z',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when type is invalid', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeCouponCreateMock(null, null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BAD', type: 'invalid_type', value: 10 }),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /api/studios/:studioId/coupons', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of coupons for staff', async () => {
    const mockCoupons = [
      { id: COUPON_ID, code: 'SAVE20', type: 'percent_off', value: 20, active: true, current_redemptions: 3 },
    ]

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'coupons') {
          return makeListChain(mockCoupons)
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.coupons).toHaveLength(1)
    expect(body.coupons[0].code).toBe('SAVE20')
  })

  it('returns 403 for non-staff', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons`, {
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/studios/:studioId/coupons/:couponId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deactivates a coupon', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'coupons') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: COUPON_ID }, error: null }),
            update: vi.fn().mockReturnThis(),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/${COUPON_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.deactivated).toBe(true)
    expect(body.couponId).toBe(COUPON_ID)
  })

  it('returns 404 when coupon not found', async () => {
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
          }
        }
        if (table === 'coupons') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(supabaseMock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/${COUPON_ID}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 3: Coupon Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/coupons/validate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeValidateMock(couponData: object | null, subCount = 0) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null }),
          }
        }
        if (table === 'coupons') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: couponData, error: null }),
          }
        }
        if (table === 'subscriptions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (res: any) => Promise.resolve({ data: null, count: subCount, error: null }).then(res),
            catch: (rej: any) => Promise.resolve({ data: null, count: subCount, error: null }).catch(rej),
            [Symbol.toStringTag]: 'Promise',
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
  }

  it('returns valid=true for a valid percent_off coupon', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'SAVE20',
      type: 'percent_off',
      value: 20,
      active: true,
      applies_to: 'any',
      plan_ids: [],
      max_redemptions: null,
      current_redemptions: 0,
      valid_from: null,
      valid_until: null,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(coupon) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SAVE20' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.valid).toBe(true)
    expect(body.discount.type).toBe('percent_off')
    expect(body.discount.value).toBe(20)
    expect(body.discount.description).toBe('20% off')
  })

  it('returns valid=false for a code not found', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'NOTEXIST' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.valid).toBe(false)
    expect(body.reason).toMatch(/not found/i)
  })

  it('returns valid=false for an inactive coupon', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'INACTIVE',
      type: 'percent_off',
      value: 10,
      active: false,
      applies_to: 'any',
      plan_ids: [],
      max_redemptions: null,
      current_redemptions: 0,
      valid_from: null,
      valid_until: null,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(coupon) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'INACTIVE' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.valid).toBe(false)
    expect(body.reason).toMatch(/inactive/i)
  })

  it('returns valid=false for expired coupon', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'EXPIRED',
      type: 'percent_off',
      value: 15,
      active: true,
      applies_to: 'any',
      plan_ids: [],
      max_redemptions: null,
      current_redemptions: 0,
      valid_from: null,
      valid_until: new Date(Date.now() - 1000).toISOString(), // yesterday
    }
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(coupon) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'EXPIRED' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.valid).toBe(false)
    expect(body.reason).toMatch(/expired/i)
  })

  it('returns valid=false when redemption limit is reached', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'MAXED',
      type: 'percent_off',
      value: 10,
      active: true,
      applies_to: 'any',
      plan_ids: [],
      max_redemptions: 5,
      current_redemptions: 5,
      valid_from: null,
      valid_until: null,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(coupon) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MAXED' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.valid).toBe(false)
    expect(body.reason).toMatch(/limit/i)
  })

  it('returns valid=false when applies_to=plan but wrong plan selected', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'PLANONLY',
      type: 'percent_off',
      value: 25,
      active: true,
      applies_to: 'plan',
      plan_ids: ['plan-uuid-1'],
      max_redemptions: null,
      current_redemptions: 0,
      valid_from: null,
      valid_until: null,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(coupon) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'PLANONLY', planId: 'plan-uuid-other' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.valid).toBe(false)
    expect(body.reason).toMatch(/plan/i)
  })

  it('returns valid=false for new_member coupon used by existing member', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'NEWBIE',
      type: 'percent_off',
      value: 50,
      active: true,
      applies_to: 'new_member',
      plan_ids: [],
      max_redemptions: null,
      current_redemptions: 0,
      valid_from: null,
      valid_until: null,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(coupon, 2) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'NEWBIE' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.valid).toBe(false)
    expect(body.reason).toMatch(/new member/i)
  })

  it('returns 400 when code is missing', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeValidateMock(null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/validate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: Coupon Redemption
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/coupons/redeem', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeRedeemMock(couponData: object | null, redemptionResult: object | null) {
    let insertCallCount = 0
    return {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null }),
          }
        }
        if (table === 'coupons') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: couponData, error: null }),
            update: vi.fn().mockReturnThis(),
          }
        }
        if (table === 'coupon_redemptions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: redemptionResult,
              error: redemptionResult ? null : { message: 'Insert failed' },
            }),
          }
        }
        if (table === 'comp_classes') {
          insertCallCount++
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'comp-from-coupon',
                remaining_classes: (couponData as any)?.value ?? 0,
              },
              error: null,
            }),
          }
        }
        return { select: vi.fn().mockReturnThis() }
      }),
    }
  }

  it('records redemption and increments counter for percent_off coupon', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'SAVE20',
      type: 'percent_off',
      value: 20,
      active: true,
      applies_to: 'any',
      valid_from: null,
      valid_until: null,
      max_redemptions: null,
      current_redemptions: 3,
    }
    const redemption = { id: 'redemption-1', coupon_id: COUPON_ID, user_id: USER_ID }
    vi.mocked(createServiceClient).mockReturnValue(makeRedeemMock(coupon, redemption) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/redeem`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'SAVE20',
        appliedToType: 'subscription',
        appliedToId: 'sub-uuid-1',
        discountAmountCents: 2000,
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.redemptionId).toBe('redemption-1')
    expect(body.couponType).toBe('percent_off')
    expect(body.compGrant).toBeNull()
  })

  it('grants comp classes for free_classes coupon type', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'FREE3',
      type: 'free_classes',
      value: 3,
      active: true,
      applies_to: 'any',
      valid_from: null,
      valid_until: null,
      max_redemptions: null,
      current_redemptions: 0,
    }
    const redemption = { id: 'redemption-2', coupon_id: COUPON_ID, user_id: USER_ID }
    vi.mocked(createServiceClient).mockReturnValue(makeRedeemMock(coupon, redemption) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/redeem`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'FREE3' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.compGrant).toBeTruthy()
    expect(body.compGrant.remaining_classes).toBe(3)
  })

  it('returns 404 when coupon code not found', async () => {
    vi.mocked(createServiceClient).mockReturnValue(makeRedeemMock(null, null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/redeem`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'NOTFOUND' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 400 when coupon has expired', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'OLD',
      type: 'percent_off',
      value: 10,
      active: true,
      applies_to: 'any',
      valid_from: null,
      valid_until: new Date(Date.now() - 1000).toISOString(),
      max_redemptions: null,
      current_redemptions: 0,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeRedeemMock(coupon, null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/redeem`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'OLD' }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when redemption limit is reached', async () => {
    const coupon = {
      id: COUPON_ID,
      code: 'MAXED',
      type: 'amount_off',
      value: 1000,
      active: true,
      applies_to: 'any',
      valid_from: null,
      valid_until: null,
      max_redemptions: 10,
      current_redemptions: 10,
    }
    vi.mocked(createServiceClient).mockReturnValue(makeRedeemMock(coupon, null) as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/coupons/redeem`, {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MAXED' }),
    })

    expect(res.status).toBe(400)
  })
})
