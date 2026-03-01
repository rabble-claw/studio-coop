// Financial planner routes — studio-scoped (mounted at /api/studios)
//
//   Expenses:
//     GET    /:studioId/finances/expense-categories
//     GET    /:studioId/finances/expenses
//     POST   /:studioId/finances/expenses
//     PUT    /:studioId/finances/expenses/:expenseId
//     DELETE /:studioId/finances/expenses/:expenseId
//
//   Instructor Compensation:
//     GET    /:studioId/finances/instructors
//     POST   /:studioId/finances/instructors
//     PUT    /:studioId/finances/instructors/:compId
//     DELETE /:studioId/finances/instructors/:compId
//     GET    /:studioId/finances/instructors/:instructorId/cost
//
//   Analytics:
//     GET    /:studioId/finances/overview
//     GET    /:studioId/finances/pnl
//     GET    /:studioId/finances/cash-flow
//     GET    /:studioId/finances/health-check
//     GET    /:studioId/finances/break-even
//
//   Scenario:
//     POST   /:studioId/finances/scenario
//
//   Setup:
//     POST   /:studioId/finances/setup

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff, requireAdmin } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'
import {
  computeMonthlyRevenue,
  computeMonthlyExpenses,
  computeInstructorCosts,
  computeHealthScore,
  getIndustryBenchmarks,
  type ExpenseRow,
  type HealthMetrics,
} from '../lib/finance-helpers'

const finances = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Helper: current month as YYYY-MM
// ─────────────────────────────────────────────────────────────────────────────

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1) // m-1 is current (0-indexed), m-2 is previous
  return d.toISOString().slice(0, 7)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /:studioId/finances/expense-categories
finances.get('/:studioId/finances/expense-categories', authMiddleware, requireStaff, async (c) => {
  const supabase = createServiceClient()

  const { data: categories, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('sort_order')

  if (error) throw badRequest(error.message)

  return c.json({ categories: categories ?? [] })
})

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /:studioId/finances/expenses
finances.get('/:studioId/finances/expenses', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: expenses, error } = await supabase
    .from('studio_expenses')
    .select('*, category:expense_categories(id, name, icon)')
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false })

  if (error) throw badRequest(error.message)

  return c.json({ expenses: expenses ?? [] })
})

// POST /:studioId/finances/expenses
finances.post('/:studioId/finances/expenses', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json()
  const { categoryId, name, amountCents, currency, recurrence, startDate, endDate, notes } = body

  if (!categoryId || !name || amountCents == null) {
    throw badRequest('categoryId, name, and amountCents are required')
  }

  const { data: expense, error } = await supabase
    .from('studio_expenses')
    .insert({
      studio_id: studioId,
      category_id: categoryId,
      name,
      amount_cents: amountCents,
      currency: currency ?? 'NZD',
      recurrence: recurrence ?? 'monthly',
      start_date: startDate ?? new Date().toISOString().split('T')[0],
      end_date: endDate ?? null,
      notes: notes ?? null,
      created_by: user.id,
    })
    .select('*, category:expense_categories(id, name, icon)')
    .single()

  if (error) throw badRequest(error.message)

  return c.json({ expense }, 201)
})

// PUT /:studioId/finances/expenses/:expenseId
finances.put('/:studioId/finances/expenses/:expenseId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const expenseId = c.req.param('expenseId')
  const supabase = createServiceClient()

  const body = await c.req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.categoryId !== undefined) updates.category_id = body.categoryId
  if (body.name !== undefined) updates.name = body.name
  if (body.amountCents !== undefined) updates.amount_cents = body.amountCents
  if (body.currency !== undefined) updates.currency = body.currency
  if (body.recurrence !== undefined) updates.recurrence = body.recurrence
  if (body.startDate !== undefined) updates.start_date = body.startDate
  if (body.endDate !== undefined) updates.end_date = body.endDate
  if (body.notes !== undefined) updates.notes = body.notes

  const { data: expense, error } = await supabase
    .from('studio_expenses')
    .update(updates)
    .eq('id', expenseId)
    .eq('studio_id', studioId)
    .select('*, category:expense_categories(id, name, icon)')
    .single()

  if (error) throw notFound('Expense')
  return c.json({ expense })
})

// DELETE /:studioId/finances/expenses/:expenseId
finances.delete('/:studioId/finances/expenses/:expenseId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const expenseId = c.req.param('expenseId')
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('studio_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('studio_id', studioId)

  if (error) throw notFound('Expense')
  return c.json({ success: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// INSTRUCTOR COMPENSATION CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /:studioId/finances/instructors
finances.get('/:studioId/finances/instructors', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: comps, error } = await supabase
    .from('instructor_compensation')
    .select('*, instructor:users!instructor_compensation_instructor_id_fkey(id, name, email)')
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false })

  if (error) throw badRequest(error.message)

  return c.json({ instructors: comps ?? [] })
})

// POST /:studioId/finances/instructors
finances.post('/:studioId/finances/instructors', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const body = await c.req.json()
  const { instructorId, compType, perClassRateCents, monthlySalaryCents, revenueSharePercent, effectiveFrom, effectiveUntil, notes } = body

  if (!instructorId || !compType) {
    throw badRequest('instructorId and compType are required')
  }

  const { data: comp, error } = await supabase
    .from('instructor_compensation')
    .insert({
      studio_id: studioId,
      instructor_id: instructorId,
      comp_type: compType,
      per_class_rate_cents: perClassRateCents ?? 0,
      monthly_salary_cents: monthlySalaryCents ?? 0,
      revenue_share_percent: revenueSharePercent ?? 0,
      effective_from: effectiveFrom ?? new Date().toISOString().split('T')[0],
      effective_until: effectiveUntil ?? null,
      notes: notes ?? null,
    })
    .select('*, instructor:users!instructor_compensation_instructor_id_fkey(id, name, email)')
    .single()

  if (error) throw badRequest(error.message)

  return c.json({ instructor: comp }, 201)
})

// PUT /:studioId/finances/instructors/:compId
finances.put('/:studioId/finances/instructors/:compId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const compId = c.req.param('compId')
  const supabase = createServiceClient()

  const body = await c.req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.compType !== undefined) updates.comp_type = body.compType
  if (body.perClassRateCents !== undefined) updates.per_class_rate_cents = body.perClassRateCents
  if (body.monthlySalaryCents !== undefined) updates.monthly_salary_cents = body.monthlySalaryCents
  if (body.revenueSharePercent !== undefined) updates.revenue_share_percent = body.revenueSharePercent
  if (body.effectiveFrom !== undefined) updates.effective_from = body.effectiveFrom
  if (body.effectiveUntil !== undefined) updates.effective_until = body.effectiveUntil
  if (body.notes !== undefined) updates.notes = body.notes

  const { data: comp, error } = await supabase
    .from('instructor_compensation')
    .update(updates)
    .eq('id', compId)
    .eq('studio_id', studioId)
    .select('*, instructor:users!instructor_compensation_instructor_id_fkey(id, name, email)')
    .single()

  if (error) throw notFound('Instructor compensation')
  return c.json({ instructor: comp })
})

// DELETE /:studioId/finances/instructors/:compId
finances.delete('/:studioId/finances/instructors/:compId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const compId = c.req.param('compId')
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('instructor_compensation')
    .delete()
    .eq('id', compId)
    .eq('studio_id', studioId)

  if (error) throw notFound('Instructor compensation')
  return c.json({ success: true })
})

// GET /:studioId/finances/instructors/:instructorId/cost?month=YYYY-MM
finances.get('/:studioId/finances/instructors/:instructorId/cost', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const instructorId = c.req.param('instructorId')
  const month = c.req.query('month') ?? currentMonth()
  const supabase = createServiceClient()

  const startDate = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const endDate = new Date(y, m, 1).toISOString().split('T')[0]

  // Get compensation record
  const { data: comp } = await supabase
    .from('instructor_compensation')
    .select('*')
    .eq('studio_id', studioId)
    .eq('instructor_id', instructorId)
    .lte('effective_from', endDate)
    .or(`effective_until.is.null,effective_until.gte.${startDate}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (!comp) throw notFound('Instructor compensation')

  // Count classes taught
  const { count: classesTaught } = await supabase
    .from('class_instances')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('teacher_id', instructorId)
    .gte('date', startDate)
    .lt('date', endDate)
    .not('status', 'eq', 'cancelled')

  const classCount = classesTaught ?? 0
  let monthlyCost = 0

  switch (comp.comp_type) {
    case 'per_class':
      monthlyCost = (comp.per_class_rate_cents ?? 0) * classCount
      break
    case 'monthly_salary':
      monthlyCost = comp.monthly_salary_cents ?? 0
      break
    case 'hybrid':
      monthlyCost = (comp.monthly_salary_cents ?? 0) + (comp.per_class_rate_cents ?? 0) * classCount
      break
    case 'revenue_share':
      monthlyCost = 0 // computed separately
      break
  }

  return c.json({
    instructorId,
    month,
    compType: comp.comp_type,
    classesTaught: classCount,
    monthlyCost,
    perClassRate: comp.per_class_rate_cents,
    monthlySalary: comp.monthly_salary_cents,
    revenueSharePercent: comp.revenue_share_percent,
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /:studioId/finances/overview?month=YYYY-MM
finances.get('/:studioId/finances/overview', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const month = c.req.query('month') ?? currentMonth()
  const prevMonth = previousMonth(month)
  const supabase = createServiceClient()

  // Revenue
  const revenue = await computeMonthlyRevenue(supabase, studioId, month)
  const prevRevenue = await computeMonthlyRevenue(supabase, studioId, prevMonth)

  // Expenses
  const { data: expenseRows } = await supabase
    .from('studio_expenses')
    .select('amount_cents, recurrence, start_date, end_date, category_id, name')
    .eq('studio_id', studioId)

  const expenses = computeMonthlyExpenses((expenseRows ?? []) as ExpenseRow[], month)

  // Instructor costs
  const instructorCosts = await computeInstructorCosts(supabase, studioId, month)

  // Net income
  const netIncome = revenue.total - expenses.total - instructorCosts.total

  // Revenue trend
  const revenueTrend = prevRevenue.total > 0
    ? Math.round(((revenue.total - prevRevenue.total) / prevRevenue.total) * 10000) / 100
    : 0

  return c.json({
    month,
    revenue: revenue.total,
    revenueBreakdown: revenue,
    expenses: expenses.total,
    expenseBreakdown: expenses.byCategory,
    instructorCosts: instructorCosts.total,
    netIncome,
    revenueTrend,
    previousRevenue: prevRevenue.total,
  })
})

// GET /:studioId/finances/pnl?months=6
finances.get('/:studioId/finances/pnl', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const monthsBack = parseInt(c.req.query('months') ?? '6', 10)
  const supabase = createServiceClient()

  // Get expenses once
  const { data: expenseRows } = await supabase
    .from('studio_expenses')
    .select('amount_cents, recurrence, start_date, end_date, category_id, name')
    .eq('studio_id', studioId)

  const results = []
  const now = new Date()

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.toISOString().slice(0, 7)

    const revenue = await computeMonthlyRevenue(supabase, studioId, month)
    const expenses = computeMonthlyExpenses((expenseRows ?? []) as ExpenseRow[], month)
    const instructorCosts = await computeInstructorCosts(supabase, studioId, month)

    results.push({
      month,
      revenue: revenue.total,
      revenueBreakdown: revenue,
      expenses: expenses.total,
      expenseBreakdown: expenses.byCategory,
      instructorCosts: instructorCosts.total,
      netIncome: revenue.total - expenses.total - instructorCosts.total,
    })
  }

  return c.json({ pnl: results })
})

// GET /:studioId/finances/cash-flow?months=6
finances.get('/:studioId/finances/cash-flow', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const monthsBack = parseInt(c.req.query('months') ?? '6', 10)
  const supabase = createServiceClient()

  const { data: expenseRows } = await supabase
    .from('studio_expenses')
    .select('amount_cents, recurrence, start_date, end_date, category_id, name')
    .eq('studio_id', studioId)

  const results = []
  let runningBalance = 0
  const now = new Date()

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.toISOString().slice(0, 7)

    const revenue = await computeMonthlyRevenue(supabase, studioId, month)
    const expenses = computeMonthlyExpenses((expenseRows ?? []) as ExpenseRow[], month)
    const instructorCosts = await computeInstructorCosts(supabase, studioId, month)

    const inflow = revenue.total
    const outflow = expenses.total + instructorCosts.total
    const net = inflow - outflow
    runningBalance += net

    results.push({
      month,
      inflow,
      outflow,
      net,
      runningBalance,
    })
  }

  return c.json({ cashFlow: results })
})

// GET /:studioId/finances/health-check?month=YYYY-MM
finances.get('/:studioId/finances/health-check', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const month = c.req.query('month') ?? currentMonth()
  const prevMonth = previousMonth(month)
  const supabase = createServiceClient()

  const startDate = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const endDate = new Date(y, m, 1).toISOString().split('T')[0]

  // Revenue
  const revenue = await computeMonthlyRevenue(supabase, studioId, month)
  const prevRevenue = await computeMonthlyRevenue(supabase, studioId, prevMonth)

  // Expenses
  const { data: expenseRows } = await supabase
    .from('studio_expenses')
    .select('amount_cents, recurrence, start_date, end_date, category_id, name')
    .eq('studio_id', studioId)

  const expenses = computeMonthlyExpenses((expenseRows ?? []) as ExpenseRow[], month)
  const rentCents = expenses.byCategory['rent'] ?? 0

  // Instructor costs
  const instructorCosts = await computeInstructorCosts(supabase, studioId, month)

  // Active members
  const { count: activeMembers } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('status', 'active')

  // Class utilization
  const { data: classes } = await supabase
    .from('class_instances')
    .select('max_capacity, booked_count')
    .eq('studio_id', studioId)
    .gte('date', startDate)
    .lt('date', endDate)
    .not('status', 'eq', 'cancelled')

  const classCapacity = (classes ?? []).reduce((s, c) => s + (c.max_capacity ?? 0), 0)
  const classBooked = (classes ?? []).reduce((s, c) => s + (c.booked_count ?? 0), 0)

  // Studio discipline for benchmarks
  const { data: studio } = await supabase
    .from('studios')
    .select('discipline')
    .eq('id', studioId)
    .single()

  const metrics: HealthMetrics = {
    revenueCents: revenue.total,
    expensesCents: expenses.total,
    instructorCostsCents: instructorCosts.total,
    rentCents,
    activeMembers: activeMembers ?? 0,
    classCapacity,
    classBooked,
    previousRevenueCents: prevRevenue.total,
  }

  const healthScore = computeHealthScore(metrics)
  const benchmarks = getIndustryBenchmarks(studio?.discipline ?? 'general')

  return c.json({
    month,
    healthScore,
    benchmarks,
    metrics: {
      revenue: revenue.total,
      expenses: expenses.total,
      instructorCosts: instructorCosts.total,
      netIncome: revenue.total - expenses.total - instructorCosts.total,
      activeMembers: activeMembers ?? 0,
      classUtilization: classCapacity > 0 ? Math.round((classBooked / classCapacity) * 10000) / 100 : 0,
    },
  })
})

// GET /:studioId/finances/break-even
finances.get('/:studioId/finances/break-even', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const month = c.req.query('month') ?? currentMonth()
  const supabase = createServiceClient()

  // Get expenses
  const { data: expenseRows } = await supabase
    .from('studio_expenses')
    .select('amount_cents, recurrence, start_date, end_date, category_id, name')
    .eq('studio_id', studioId)

  const expenses = computeMonthlyExpenses((expenseRows ?? []) as ExpenseRow[], month)
  const instructorCosts = await computeInstructorCosts(supabase, studioId, month)

  const totalFixedCosts = expenses.total + instructorCosts.total

  // Average revenue per member
  const { count: activeMembers } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('status', 'active')

  const revenue = await computeMonthlyRevenue(supabase, studioId, month)
  const memberCount = activeMembers ?? 0
  const revenuePerMember = memberCount > 0 ? Math.round(revenue.total / memberCount) : 0

  // Break-even: how many members needed to cover fixed costs
  const breakEvenMembers = revenuePerMember > 0
    ? Math.ceil(totalFixedCosts / revenuePerMember)
    : 0

  // Break-even daily revenue
  const breakEvenDailyRevenue = Math.round(totalFixedCosts / 30)

  return c.json({
    month,
    totalFixedCosts,
    revenuePerMember,
    currentMembers: memberCount,
    breakEvenMembers,
    breakEvenDailyRevenue,
    currentRevenue: revenue.total,
    surplus: revenue.total - totalFixedCosts,
    isAboveBreakEven: revenue.total >= totalFixedCosts,
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO PLANNER
// ═══════════════════════════════════════════════════════════════════════════════

// POST /:studioId/finances/scenario
finances.post('/:studioId/finances/scenario', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const month = currentMonth()
  const supabase = createServiceClient()

  const body = await c.req.json()
  const {
    newMembers = 0,
    lostMembers = 0,
    priceChangePercent = 0,
    newExpenses = [],
    removedExpenseIds = [],
    newClassesPerWeek = 0,
  } = body

  // Current state
  const revenue = await computeMonthlyRevenue(supabase, studioId, month)

  const { data: expenseRows } = await supabase
    .from('studio_expenses')
    .select('id, amount_cents, recurrence, start_date, end_date, category_id, name')
    .eq('studio_id', studioId)

  const filteredExpenses = (expenseRows ?? [])
    .filter((e: { id: string }) => !removedExpenseIds.includes(e.id)) as ExpenseRow[]

  // Add hypothetical new expenses
  for (const ne of newExpenses as Array<{ amountCents: number; recurrence?: string; categoryId?: string; name?: string }>) {
    filteredExpenses.push({
      amount_cents: ne.amountCents,
      recurrence: ne.recurrence ?? 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: null,
      category_id: ne.categoryId ?? 'other',
      name: ne.name ?? 'New expense',
    })
  }

  const expenses = computeMonthlyExpenses(filteredExpenses, month)
  const instructorCosts = await computeInstructorCosts(supabase, studioId, month)

  // Active members
  const { count: activeMembers } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('status', 'active')

  const memberCount = activeMembers ?? 0
  const projectedMembers = Math.max(0, memberCount + newMembers - lostMembers)

  // Revenue projection
  const revenuePerMember = memberCount > 0 ? revenue.total / memberCount : 0
  const adjustedRevenuePerMember = revenuePerMember * (1 + priceChangePercent / 100)
  const projectedRevenue = Math.round(adjustedRevenuePerMember * projectedMembers)

  // Additional instructor costs for new classes
  const avgPerClassRate = instructorCosts.instructors.length > 0
    ? Math.round(instructorCosts.total / Math.max(1, instructorCosts.instructors.reduce((s, i) => s + i.classesTaught, 0)))
    : 5000 // $50 default
  const additionalInstructorCosts = newClassesPerWeek * avgPerClassRate * 4 // 4 weeks

  const projectedInstructorCosts = instructorCosts.total + additionalInstructorCosts
  const projectedNet = projectedRevenue - expenses.total - projectedInstructorCosts

  return c.json({
    current: {
      members: memberCount,
      revenue: revenue.total,
      expenses: expenses.total - (newExpenses as Array<{ amountCents: number }>).reduce((s: number, e: { amountCents: number }) => s + (e.amountCents ?? 0), 0),
      instructorCosts: instructorCosts.total,
      netIncome: revenue.total - expenses.total + (newExpenses as Array<{ amountCents: number }>).reduce((s: number, e: { amountCents: number }) => s + (e.amountCents ?? 0), 0) - instructorCosts.total,
    },
    projected: {
      members: projectedMembers,
      revenue: projectedRevenue,
      expenses: expenses.total,
      instructorCosts: projectedInstructorCosts,
      netIncome: projectedNet,
    },
    changes: {
      membersDelta: newMembers - lostMembers,
      revenueDelta: projectedRevenue - revenue.total,
      expensesDelta: expenses.total - (expenses.total - (newExpenses as Array<{ amountCents: number }>).reduce((s: number, e: { amountCents: number }) => s + (e.amountCents ?? 0), 0)),
      instructorCostsDelta: additionalInstructorCosts,
      netIncomeDelta: projectedNet - (revenue.total - expenses.total + (newExpenses as Array<{ amountCents: number }>).reduce((s: number, e: { amountCents: number }) => s + (e.amountCents ?? 0), 0) - instructorCosts.total),
    },
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP — bulk import initial expenses
// ═══════════════════════════════════════════════════════════════════════════════

// POST /:studioId/finances/setup
finances.post('/:studioId/finances/setup', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json()
  const { expenses: expenseList, instructors: instructorList } = body

  const results = { expenses: 0, instructors: 0, errors: [] as string[] }

  // Bulk insert expenses
  if (Array.isArray(expenseList) && expenseList.length > 0) {
    const rows = expenseList.map((e: {
      categoryId: string
      name: string
      amountCents: number
      currency?: string
      recurrence?: string
      startDate?: string
      endDate?: string
      notes?: string
    }) => ({
      studio_id: studioId,
      category_id: e.categoryId,
      name: e.name,
      amount_cents: e.amountCents,
      currency: e.currency ?? 'NZD',
      recurrence: e.recurrence ?? 'monthly',
      start_date: e.startDate ?? new Date().toISOString().split('T')[0],
      end_date: e.endDate ?? null,
      notes: e.notes ?? null,
      created_by: user.id,
    }))

    const { data, error } = await supabase
      .from('studio_expenses')
      .insert(rows)
      .select('id')

    if (error) {
      results.errors.push(`Expenses: ${error.message}`)
    } else {
      results.expenses = data?.length ?? 0
    }
  }

  // Bulk insert instructor compensation
  if (Array.isArray(instructorList) && instructorList.length > 0) {
    const rows = instructorList.map((i: {
      instructorId: string
      compType: string
      perClassRateCents?: number
      monthlySalaryCents?: number
      revenueSharePercent?: number
      effectiveFrom?: string
      notes?: string
    }) => ({
      studio_id: studioId,
      instructor_id: i.instructorId,
      comp_type: i.compType,
      per_class_rate_cents: i.perClassRateCents ?? 0,
      monthly_salary_cents: i.monthlySalaryCents ?? 0,
      revenue_share_percent: i.revenueSharePercent ?? 0,
      effective_from: i.effectiveFrom ?? new Date().toISOString().split('T')[0],
      notes: i.notes ?? null,
    }))

    const { data, error } = await supabase
      .from('instructor_compensation')
      .insert(rows)
      .select('id')

    if (error) {
      results.errors.push(`Instructors: ${error.message}`)
    } else {
      results.instructors = data?.length ?? 0
    }
  }

  return c.json({ setup: results }, results.errors.length > 0 ? 207 : 201)
})

export { finances }
export default finances
