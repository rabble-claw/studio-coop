import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import finances from '../routes/finances'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'owner@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))
vi.mock('../middleware/studio-access', () => ({
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
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
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
}))

vi.mock('../lib/finance-helpers', () => ({
  computeMonthlyRevenue: vi.fn(),
  computeMonthlyExpenses: vi.fn(),
  computeInstructorCosts: vi.fn(),
  computeHealthScore: vi.fn(),
  getIndustryBenchmarks: vi.fn(),
}))

import { createServiceClient } from '../lib/supabase'
import {
  computeMonthlyRevenue,
  computeMonthlyExpenses,
  computeInstructorCosts,
  computeHealthScore,
  getIndustryBenchmarks,
} from '../lib/finance-helpers'

const STUDIO_ID = 'studio-abc'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', finances)
  return app
}

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
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  }
  // Support .count via the result
  if (result.count !== undefined) {
    chain.count = result.count
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

const headers = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }

// Helper to set up a standard mock that handles computeMonthlyRevenue/Expenses/InstructorCosts
function setupFinanceHelperMocks(opts: {
  revenue?: { total: number; subscription?: number; class_pack?: number; drop_in?: number; private_booking?: number }
  expenses?: { total: number; byCategory?: Record<string, number> }
  instructorCosts?: { total: number; instructors?: Array<{ instructorId: string; classesTaught: number; cost: number }> }
} = {}) {
  const rev = { total: 0, subscription: 0, class_pack: 0, drop_in: 0, private_booking: 0, ...opts.revenue }
  const exp = { total: 0, byCategory: {}, ...opts.expenses }
  const inst = { total: 0, instructors: [], ...opts.instructorCosts }

  vi.mocked(computeMonthlyRevenue).mockResolvedValue(rev as any)
  vi.mocked(computeMonthlyExpenses).mockReturnValue(exp as any)
  vi.mocked(computeInstructorCosts).mockResolvedValue(inst as any)
}

// ─── Expense Categories ──────────────────────────────────────────────

describe('GET /api/studios/:studioId/finances/expense-categories', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/expense-categories`

  it('returns list of categories', async () => {
    const categories = [
      { id: 'cat-1', name: 'Rent', icon: 'home', sort_order: 0 },
      { id: 'cat-2', name: 'Utilities', icon: 'zap', sort_order: 1 },
    ]
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: categories, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.categories).toHaveLength(2)
  })

  it('returns empty when no categories exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.categories).toHaveLength(0)
  })
})

// ─── Expense CRUD ────────────────────────────────────────────────────

describe('GET /api/studios/:studioId/finances/expenses', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/expenses`

  it('returns list of expenses', async () => {
    const expenses = [
      { id: 'exp-1', studio_id: STUDIO_ID, name: 'Rent', amount_cents: 200000, recurrence: 'monthly' },
      { id: 'exp-2', studio_id: STUDIO_ID, name: 'Cleaning', amount_cents: 30000, recurrence: 'weekly' },
    ]
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: expenses, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.expenses).toHaveLength(2)
    expect(body.expenses[0].name).toBe('Rent')
  })

  it('returns empty array when no expenses exist', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.expenses).toHaveLength(0)
  })
})

describe('POST /api/studios/:studioId/finances/expenses', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/expenses`

  it('creates a new expense and returns 201', async () => {
    const newExpense = { id: 'exp-new', studio_id: STUDIO_ID, name: 'Equipment', amount_cents: 50000, category: { id: 'cat-1', name: 'Supplies', icon: 'box' } }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: newExpense, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ categoryId: 'cat-1', name: 'Equipment', amountCents: 50000 }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.expense).toBeDefined()
  })

  it('returns 400 for missing required fields', async () => {
    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ categoryId: 'cat-1', amountCents: 5000 }),
    })

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/studios/:studioId/finances/expenses/:expenseId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/expenses/exp-1`

  it('updates an existing expense', async () => {
    const updated = { id: 'exp-1', studio_id: STUDIO_ID, name: 'Rent (updated)', amount_cents: 220000 }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: updated, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Rent (updated)', amountCents: 220000 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.expense).toBeDefined()
  })
})

describe('DELETE /api/studios/:studioId/finances/expenses/:expenseId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/expenses/exp-1`

  it('deletes an expense and returns success', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'DELETE', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
  })
})

// ─── Instructor Compensation CRUD ────────────────────────────────────

describe('GET /api/studios/:studioId/finances/instructors', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/instructors`

  it('returns list of instructor compensations', async () => {
    const instructors = [
      { id: 'comp-1', studio_id: STUDIO_ID, instructor_id: 'user-2', comp_type: 'per_class', per_class_rate_cents: 5000 },
      { id: 'comp-2', studio_id: STUDIO_ID, instructor_id: 'user-3', comp_type: 'monthly_salary', monthly_salary_cents: 400000 },
    ]
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: instructors, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.instructors).toHaveLength(2)
  })
})

describe('POST /api/studios/:studioId/finances/instructors', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/instructors`

  it('creates per_class compensation and returns 201', async () => {
    const comp = { id: 'comp-new', studio_id: STUDIO_ID, instructor_id: 'user-2', comp_type: 'per_class', per_class_rate_cents: 5000 }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: comp, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instructorId: 'user-2', compType: 'per_class', perClassRateCents: 5000 }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.instructor).toBeDefined()
  })

  it('creates monthly_salary compensation', async () => {
    const comp = { id: 'comp-new', studio_id: STUDIO_ID, instructor_id: 'user-3', comp_type: 'monthly_salary', monthly_salary_cents: 400000 }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: comp, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instructorId: 'user-3', compType: 'monthly_salary', monthlySalaryCents: 400000 }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.instructor).toBeDefined()
  })

  it('creates hybrid compensation', async () => {
    const comp = { id: 'comp-new', studio_id: STUDIO_ID, instructor_id: 'user-4', comp_type: 'hybrid' }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: comp, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ instructorId: 'user-4', compType: 'hybrid', perClassRateCents: 3000, monthlySalaryCents: 200000 }),
    })

    expect(res.status).toBe(201)
  })

  it('returns 400 when instructorId is missing', async () => {
    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ compType: 'per_class', perClassRateCents: 5000 }),
    })

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/studios/:studioId/finances/instructors/:compId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/instructors/comp-1`

  it('updates instructor compensation', async () => {
    const updated = { id: 'comp-1', studio_id: STUDIO_ID, instructor_id: 'user-2', comp_type: 'per_class', per_class_rate_cents: 6000 }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: updated, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ perClassRateCents: 6000 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.instructor).toBeDefined()
  })
})

describe('DELETE /api/studios/:studioId/finances/instructors/:compId', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/instructors/comp-1`

  it('deletes instructor compensation', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'DELETE', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
  })
})

// ─── Instructor Cost Calculation ─────────────────────────────────────

describe('GET /api/studios/:studioId/finances/instructors/:instructorId/cost', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/instructors/user-2/cost`

  it('returns per_class cost computation', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'instructor_compensation') {
          return makeAsyncChain({ data: { comp_type: 'per_class', per_class_rate_cents: 5000, monthly_salary_cents: 0, revenue_share_percent: 0 }, error: null })
        }
        if (table === 'class_instances') {
          return makeAsyncChain({ data: null, error: null, count: 20 })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.instructorId).toBe('user-2')
    expect(body.compType).toBe('per_class')
    expect(body.monthlyCost).toBeDefined()
  })

  it('returns salary cost computation', async () => {
    const url2 = `/api/studios/${STUDIO_ID}/finances/instructors/user-3/cost`
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'instructor_compensation') {
          return makeAsyncChain({ data: { comp_type: 'monthly_salary', per_class_rate_cents: 0, monthly_salary_cents: 400000, revenue_share_percent: 0 }, error: null })
        }
        if (table === 'class_instances') {
          return makeAsyncChain({ data: null, error: null, count: 0 })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url2, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.compType).toBe('monthly_salary')
    expect(body.monthlyCost).toBe(400000)
  })
})

// ─── Financial Overview ──────────────────────────────────────────────

describe('GET /api/studios/:studioId/finances/overview', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/overview`

  it('returns financial overview with revenue and expenses', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 200000 },
      instructorCosts: { total: 100000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.revenue).toBeDefined()
    expect(body.expenses).toBeDefined()
    expect(body.netIncome).toBeDefined()
  })

  it('handles overview with no data (new studio)', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 0 },
      expenses: { total: 0 },
      instructorCosts: { total: 0 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.netIncome).toBe(0)
  })

  it('handles expenses exceeding revenue', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 200000 },
      expenses: { total: 250000 },
      instructorCosts: { total: 100000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.netIncome).toBeLessThan(0)
  })

  it('includes revenue trend compared to previous month', async () => {
    // computeMonthlyRevenue is called twice (current month and previous month)
    vi.mocked(computeMonthlyRevenue)
      .mockResolvedValueOnce({ total: 600000, subscription: 400000, class_pack: 100000, drop_in: 50000, private_booking: 50000 } as any)
      .mockResolvedValueOnce({ total: 500000, subscription: 350000, class_pack: 80000, drop_in: 40000, private_booking: 30000 } as any)
    vi.mocked(computeMonthlyExpenses).mockReturnValue({ total: 300000, byCategory: {} } as any)
    vi.mocked(computeInstructorCosts).mockResolvedValue({ total: 100000, instructors: [] } as any)

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.revenueTrend).toBeDefined()
    expect(body.revenueTrend).toBe(20) // 20% growth
  })
})

// ─── P&L ─────────────────────────────────────────────────────────────

describe('GET /api/studios/:studioId/finances/pnl', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/pnl`

  it('returns monthly P&L data', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 50000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`${url}?months=3`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.pnl).toBeDefined()
    expect(Array.isArray(body.pnl)).toBe(true)
  })

  it('returns pnl for default 6 months when no param', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 50000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.pnl).toHaveLength(6)
  })

  it('each P&L row has month, revenue, expenses, netIncome', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 50000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`${url}?months=1`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.pnl).toHaveLength(1)
    const row = body.pnl[0]
    expect(row.month).toBeDefined()
    expect(row.revenue).toBe(500000)
    expect(row.expenses).toBe(300000)
    expect(row.netIncome).toBe(150000) // 500000 - 300000 - 50000
  })
})

// ─── Cash Flow ───────────────────────────────────────────────────────

describe('GET /api/studios/:studioId/finances/cash-flow', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/cash-flow`

  it('returns cash flow projection', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 50000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`${url}?months=6`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.cashFlow).toBeDefined()
    expect(Array.isArray(body.cashFlow)).toBe(true)
  })

  it('each row has month, inflow, outflow, net, runningBalance', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 50000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`${url}?months=1`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.cashFlow).toHaveLength(1)
    const row = body.cashFlow[0]
    expect(row.month).toBeDefined()
    expect(row.inflow).toBe(500000)
    expect(row.outflow).toBe(350000) // 300000 + 50000
    expect(row.net).toBe(150000)
    expect(row.runningBalance).toBeDefined()
  })

  it('running balance accumulates across months', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 50000 },
    })

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`${url}?months=3`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.cashFlow).toHaveLength(3)
    // Each month nets 150000, so running balance should increase
    expect(body.cashFlow[2].runningBalance).toBeGreaterThan(body.cashFlow[0].runningBalance)
  })
})

// ─── Health Check ────────────────────────────────────────────────────

describe('GET /api/studios/:studioId/finances/health-check', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/health-check`

  it('returns health score for healthy studio', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 200000 },
      instructorCosts: { total: 100000 },
    })
    vi.mocked(computeHealthScore).mockReturnValue({
      score: 85,
      grade: 'A',
      indicators: [{ name: 'Profit Margin', status: 'good', detail: 'Above target' }],
    } as any)
    vi.mocked(getIndustryBenchmarks).mockReturnValue({ profitMarginTarget: 0.2 } as any)

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { discipline: 'yoga' }, error: null })
        }
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 50 })
        }
        if (table === 'class_instances') {
          return makeAsyncChain({ data: [{ max_capacity: 20, booked_count: 15 }], error: null })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.healthScore).toBeDefined()
    expect(body.healthScore.score).toBe(85)
    expect(body.healthScore.grade).toBe('A')
    expect(body.benchmarks).toBeDefined()
  })

  it('returns struggling studio score', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 200000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 50000 },
    })
    vi.mocked(computeHealthScore).mockReturnValue({
      score: 35,
      grade: 'D',
      indicators: [{ name: 'Profit Margin', status: 'critical', detail: 'Operating at a loss' }],
    } as any)
    vi.mocked(getIndustryBenchmarks).mockReturnValue({ profitMarginTarget: 0.2 } as any)

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { discipline: 'dance' }, error: null })
        }
        return makeAsyncChain({ data: [], error: null, count: 10 })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.healthScore.score).toBeLessThan(50)
  })

  it('handles brand new studio with no data', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 0 },
      expenses: { total: 0 },
      instructorCosts: { total: 0 },
    })
    vi.mocked(computeHealthScore).mockReturnValue({
      score: 50,
      grade: 'C',
      indicators: [],
    } as any)
    vi.mocked(getIndustryBenchmarks).mockReturnValue({} as any)

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { discipline: 'general' }, error: null })
        }
        return makeAsyncChain({ data: [], error: null, count: 0 })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.healthScore).toBeDefined()
  })

  it('includes metrics with class utilization', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 200000 },
      instructorCosts: { total: 100000 },
    })
    vi.mocked(computeHealthScore).mockReturnValue({ score: 72, grade: 'B', indicators: [] } as any)
    vi.mocked(getIndustryBenchmarks).mockReturnValue({} as any)

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'studios') {
          return makeAsyncChain({ data: { discipline: 'pilates' }, error: null })
        }
        if (table === 'class_instances') {
          return makeAsyncChain({ data: [{ max_capacity: 20, booked_count: 16 }, { max_capacity: 15, booked_count: 10 }], error: null })
        }
        return makeAsyncChain({ data: [], error: null, count: 30 })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.metrics).toBeDefined()
    expect(body.metrics.classUtilization).toBeDefined()
  })
})

// ─── Break-Even Analysis ─────────────────────────────────────────────

describe('GET /api/studios/:studioId/finances/break-even', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/break-even`

  it('returns break-even analysis', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 250000 },
      instructorCosts: { total: 100000 },
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 50 })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.totalFixedCosts).toBeDefined()
    expect(body.revenuePerMember).toBeDefined()
    expect(body.breakEvenMembers).toBeDefined()
    expect(body.currentRevenue).toBe(500000)
  })

  it('handles already profitable studio', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 800000 },
      expenses: { total: 200000 },
      instructorCosts: { total: 100000 },
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 80 })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.isAboveBreakEven).toBe(true)
    expect(body.surplus).toBeGreaterThan(0)
  })

  it('handles not-yet break-even studio', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 200000 },
      expenses: { total: 350000 },
      instructorCosts: { total: 100000 },
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 15 })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.isAboveBreakEven).toBe(false)
    expect(body.surplus).toBeLessThan(0)
  })
})

// ─── Scenario Planner ────────────────────────────────────────────────

describe('POST /api/studios/:studioId/finances/scenario', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/scenario`

  it('projects impact of price increase', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 100000, instructors: [{ instructorId: 'u1', classesTaught: 20, cost: 100000 }] },
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 50 })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ priceChangePercent: 10 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.current).toBeDefined()
    expect(body.projected).toBeDefined()
    expect(body.projected.revenue).toBeGreaterThan(body.current.revenue)
  })

  it('projects impact of adding new members', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 100000, instructors: [] },
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 50 })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ newMembers: 10 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.projected.members).toBe(60) // 50 + 10
  })

  it('projects member churn impact', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 100000, instructors: [] },
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 50 })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lostMembers: 15 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.projected.members).toBe(35) // 50 - 15
    expect(body.projected.revenue).toBeLessThan(body.current.revenue)
  })

  it('handles combined changes', async () => {
    setupFinanceHelperMocks({
      revenue: { total: 500000 },
      expenses: { total: 300000 },
      instructorCosts: { total: 100000, instructors: [{ instructorId: 'u1', classesTaught: 20, cost: 100000 }] },
    })

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'memberships') {
          return makeAsyncChain({ data: null, error: null, count: 50 })
        }
        return makeAsyncChain({ data: [], error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        priceChangePercent: 15,
        newMembers: 5,
        lostMembers: 2,
        newClassesPerWeek: 3,
        newExpenses: [{ amountCents: 20000, name: 'New rent increase' }],
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.current).toBeDefined()
    expect(body.projected).toBeDefined()
    expect(body.changes).toBeDefined()
    expect(body.changes.membersDelta).toBe(3) // 5 - 2
  })
})

// ─── Setup Wizard ────────────────────────────────────────────────────

describe('POST /api/studios/:studioId/finances/setup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const url = `/api/studios/${STUDIO_ID}/finances/setup`

  it('bulk creates expenses and instructor comp (returns 201)', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [{ id: 'exp-1' }, { id: 'exp-2' }], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expenses: [
          { categoryId: 'cat-1', name: 'Rent', amountCents: 200000, recurrence: 'monthly' },
          { categoryId: 'cat-2', name: 'Insurance', amountCents: 30000, recurrence: 'monthly' },
        ],
        instructors: [
          { instructorId: 'user-2', compType: 'per_class', perClassRateCents: 5000 },
        ],
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.setup).toBeDefined()
    expect(body.setup.expenses).toBeGreaterThan(0)
  })

  it('handles empty setup (no expenses or instructors)', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })

    // Should still succeed (empty setup)
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.setup.expenses).toBe(0)
    expect(body.setup.instructors).toBe(0)
  })

  it('handles partial data (expenses only)', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [{ id: 'exp-1' }], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        expenses: [
          { categoryId: 'cat-1', name: 'Rent', amountCents: 200000, recurrence: 'monthly' },
        ],
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.setup.expenses).toBe(1)
  })
})

// ─── Edge Cases ──────────────────────────────────────────────────────

describe('Finance edge cases', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('overview handles no expenses gracefully', async () => {
    // Called twice: current month + previous month
    vi.mocked(computeMonthlyRevenue).mockResolvedValue({ total: 500000, subscription: 400000, class_pack: 50000, drop_in: 50000, private_booking: 0 } as any)
    vi.mocked(computeMonthlyExpenses).mockReturnValue({ total: 0, byCategory: {} } as any)
    vi.mocked(computeInstructorCosts).mockResolvedValue({ total: 0, instructors: [] } as any)

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/finances/overview`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.expenses).toBe(0)
    expect(body.netIncome).toBe(500000)
  })

  it('overview handles no revenue gracefully', async () => {
    vi.mocked(computeMonthlyRevenue).mockResolvedValue({ total: 0, subscription: 0, class_pack: 0, drop_in: 0, private_booking: 0 } as any)
    vi.mocked(computeMonthlyExpenses).mockReturnValue({ total: 300000, byCategory: {} } as any)
    vi.mocked(computeInstructorCosts).mockResolvedValue({ total: 50000, instructors: [] } as any)

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/finances/overview`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.revenue).toBe(0)
    expect(body.netIncome).toBeLessThan(0)
  })

  it('overview handles brand new studio with zero data', async () => {
    vi.mocked(computeMonthlyRevenue).mockResolvedValue({ total: 0, subscription: 0, class_pack: 0, drop_in: 0, private_booking: 0 } as any)
    vi.mocked(computeMonthlyExpenses).mockReturnValue({ total: 0, byCategory: {} } as any)
    vi.mocked(computeInstructorCosts).mockResolvedValue({ total: 0, instructors: [] } as any)

    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: [], error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/finances/overview`, { method: 'GET', headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.revenue).toBe(0)
    expect(body.expenses).toBe(0)
    expect(body.netIncome).toBe(0)
  })
})
