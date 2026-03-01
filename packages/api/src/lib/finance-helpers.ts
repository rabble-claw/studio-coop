// Finance helper functions for revenue, expense, instructor cost, and health computations

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueBreakdown {
  subscription: number
  class_pack: number
  drop_in: number
  private_booking: number
  total: number
}

export interface ExpenseRow {
  amount_cents: number
  recurrence: string
  start_date: string
  end_date: string | null
  category_id: string
  name: string
}

export interface ExpenseBreakdown {
  byCategory: Record<string, number>
  total: number
}

export interface InstructorCost {
  instructorId: string
  name: string
  compType: string
  classesTaught: number
  monthlyCost: number
}

export interface HealthMetrics {
  revenueCents: number
  expensesCents: number
  instructorCostsCents: number
  rentCents: number
  activeMembers: number
  classCapacity: number
  classBooked: number
  previousRevenueCents: number
}

export interface HealthScore {
  overall: number
  profitMargin: { score: number; value: number }
  classUtilization: { score: number; value: number }
  rentRatio: { score: number; value: number }
  instructorCostRatio: { score: number; value: number }
  revenueTrend: { score: number; value: number }
  revenuePerMember: { score: number; value: number }
}

export interface Benchmark {
  profitMargin: number
  rentRatio: number
  instructorCostRatio: number
  classUtilization: number
  revenuePerMember: number
}

// ─────────────────────────────────────────────────────────────────────────────
// computeMonthlyRevenue — sum payments by type for a given YYYY-MM month
// ─────────────────────────────────────────────────────────────────────────────

export async function computeMonthlyRevenue(
  supabase: SupabaseClient,
  studioId: string,
  month: string, // YYYY-MM
): Promise<RevenueBreakdown> {
  const startDate = `${month}-01`
  // End of month: parse year/month and go to first of next month
  const [y, m] = month.split('-').map(Number)
  const nextMonth = new Date(y, m, 1) // JS months are 0-indexed, so m is already next month
  const endDate = nextMonth.toISOString().split('T')[0]

  const { data: payments } = await supabase
    .from('payments')
    .select('amount_cents, type')
    .eq('studio_id', studioId)
    .eq('refunded', false)
    .gte('created_at', startDate)
    .lt('created_at', endDate)

  const breakdown: RevenueBreakdown = {
    subscription: 0,
    class_pack: 0,
    drop_in: 0,
    private_booking: 0,
    total: 0,
  }

  for (const p of payments ?? []) {
    const amount = p.amount_cents ?? 0
    const type = p.type as string
    if (type === 'subscription' || type === 'class_pack' || type === 'drop_in' || type === 'private_booking') {
      breakdown[type] += amount
    }
    breakdown.total += amount
  }

  return breakdown
}

// ─────────────────────────────────────────────────────────────────────────────
// computeMonthlyExpenses — expand recurring expenses for a target month
// ─────────────────────────────────────────────────────────────────────────────

export function computeMonthlyExpenses(
  expenses: ExpenseRow[],
  month: string, // YYYY-MM
): ExpenseBreakdown {
  const [targetYear, targetMonth] = month.split('-').map(Number)
  const targetDate = new Date(targetYear, targetMonth - 1, 1)

  const byCategory: Record<string, number> = {}
  let total = 0

  for (const exp of expenses) {
    const startDate = new Date(exp.start_date)
    const endDate = exp.end_date ? new Date(exp.end_date) : null

    // Check if expense is active during the target month
    if (startDate > new Date(targetYear, targetMonth - 1, 28)) continue // started after month
    if (endDate && endDate < targetDate) continue // ended before month

    let monthlyAmount = 0

    switch (exp.recurrence) {
      case 'monthly':
        monthlyAmount = exp.amount_cents
        break
      case 'weekly':
        // ~4.33 weeks per month
        monthlyAmount = Math.round(exp.amount_cents * 4.33)
        break
      case 'biweekly':
        // ~2.17 times per month
        monthlyAmount = Math.round(exp.amount_cents * 2.17)
        break
      case 'quarterly': {
        // Only applies if this is a quarter month (every 3 months from start)
        const monthsDiff = (targetYear - startDate.getFullYear()) * 12 + (targetMonth - 1 - startDate.getMonth())
        if (monthsDiff >= 0 && monthsDiff % 3 === 0) {
          monthlyAmount = exp.amount_cents
        }
        break
      }
      case 'yearly': {
        // Only applies if this is the anniversary month
        if (targetMonth - 1 === startDate.getMonth()) {
          monthlyAmount = exp.amount_cents
        }
        break
      }
      case 'once': {
        // Only applies if this is the month of the expense
        if (startDate.getFullYear() === targetYear && startDate.getMonth() === targetMonth - 1) {
          monthlyAmount = exp.amount_cents
        }
        break
      }
    }

    if (monthlyAmount > 0) {
      byCategory[exp.category_id] = (byCategory[exp.category_id] ?? 0) + monthlyAmount
      total += monthlyAmount
    }
  }

  return { byCategory, total }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeInstructorCosts — per_class * classes, salary flat, hybrid combo
// ─────────────────────────────────────────────────────────────────────────────

export async function computeInstructorCosts(
  supabase: SupabaseClient,
  studioId: string,
  month: string, // YYYY-MM
): Promise<{ instructors: InstructorCost[]; total: number }> {
  const startDate = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const nextMonth = new Date(y, m, 1)
  const endDate = nextMonth.toISOString().split('T')[0]

  // Get compensation records effective during this month
  const { data: comps } = await supabase
    .from('instructor_compensation')
    .select('id, instructor_id, comp_type, per_class_rate_cents, monthly_salary_cents, revenue_share_percent, effective_from, effective_until')
    .eq('studio_id', studioId)
    .lte('effective_from', endDate)
    .or(`effective_until.is.null,effective_until.gte.${startDate}`)

  if (!comps || comps.length === 0) {
    return { instructors: [], total: 0 }
  }

  // Get class counts per instructor for this month
  const instructorIds = [...new Set(comps.map(c => c.instructor_id))]

  const { data: classes } = await supabase
    .from('class_instances')
    .select('teacher_id')
    .eq('studio_id', studioId)
    .gte('date', startDate)
    .lt('date', endDate)
    .not('status', 'eq', 'cancelled')
    .in('teacher_id', instructorIds)

  // Count classes per teacher
  const classCounts: Record<string, number> = {}
  for (const cls of classes ?? []) {
    classCounts[cls.teacher_id] = (classCounts[cls.teacher_id] ?? 0) + 1
  }

  // Get instructor names
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', instructorIds)

  const nameMap: Record<string, string> = {}
  for (const u of users ?? []) {
    nameMap[u.id] = u.name ?? u.email
  }

  const instructors: InstructorCost[] = []
  let total = 0

  for (const comp of comps) {
    const classCount = classCounts[comp.instructor_id] ?? 0
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
        // Revenue share is computed separately — flag as 0 here, caller handles
        monthlyCost = 0
        break
    }

    instructors.push({
      instructorId: comp.instructor_id,
      name: nameMap[comp.instructor_id] ?? 'Unknown',
      compType: comp.comp_type,
      classesTaught: classCount,
      monthlyCost,
    })

    total += monthlyCost
  }

  return { instructors, total }
}

// ─────────────────────────────────────────────────────────────────────────────
// computeHealthScore — weighted scoring across 6 dimensions
// ─────────────────────────────────────────────────────────────────────────────

export function computeHealthScore(metrics: HealthMetrics): HealthScore {
  const totalCosts = metrics.expensesCents + metrics.instructorCostsCents
  const profitMarginValue = metrics.revenueCents > 0
    ? (metrics.revenueCents - totalCosts) / metrics.revenueCents
    : 0

  const classUtilValue = metrics.classCapacity > 0
    ? metrics.classBooked / metrics.classCapacity
    : 0

  const rentRatioValue = metrics.revenueCents > 0
    ? metrics.rentCents / metrics.revenueCents
    : 0

  const instructorRatioValue = metrics.revenueCents > 0
    ? metrics.instructorCostsCents / metrics.revenueCents
    : 0

  const revenueTrendValue = metrics.previousRevenueCents > 0
    ? (metrics.revenueCents - metrics.previousRevenueCents) / metrics.previousRevenueCents
    : 0

  const revenuePerMemberValue = metrics.activeMembers > 0
    ? metrics.revenueCents / metrics.activeMembers
    : 0

  // Score each dimension 0-100
  const profitMarginScore = clampScore(profitMarginValue * 200) // 50% margin = 100
  const classUtilScore = clampScore(classUtilValue * 143)       // 70% util = 100
  const rentRatioScore = clampScore((1 - rentRatioValue / 0.3) * 100)  // <30% rent = good
  const instructorRatioScore = clampScore((1 - instructorRatioValue / 0.4) * 100) // <40% = good
  const revenueTrendScore = clampScore(50 + revenueTrendValue * 200) // flat = 50, 25% growth = 100
  const revenuePerMemberScore = clampScore(revenuePerMemberValue / 200) // $200/member = 100

  // Weighted average
  const overall = Math.round(
    profitMarginScore * 0.25 +
    classUtilScore * 0.20 +
    rentRatioScore * 0.15 +
    instructorRatioScore * 0.15 +
    revenueTrendScore * 0.15 +
    revenuePerMemberScore * 0.10
  )

  return {
    overall,
    profitMargin: { score: Math.round(profitMarginScore), value: Math.round(profitMarginValue * 10000) / 100 },
    classUtilization: { score: Math.round(classUtilScore), value: Math.round(classUtilValue * 10000) / 100 },
    rentRatio: { score: Math.round(rentRatioScore), value: Math.round(rentRatioValue * 10000) / 100 },
    instructorCostRatio: { score: Math.round(instructorRatioScore), value: Math.round(instructorRatioValue * 10000) / 100 },
    revenueTrend: { score: Math.round(revenueTrendScore), value: Math.round(revenueTrendValue * 10000) / 100 },
    revenuePerMember: { score: Math.round(revenuePerMemberScore), value: Math.round(revenuePerMemberValue) },
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

// ─────────────────────────────────────────────────────────────────────────────
// getIndustryBenchmarks — baseline numbers by discipline
// ─────────────────────────────────────────────────────────────────────────────

export function getIndustryBenchmarks(discipline: string): Benchmark {
  const defaults: Benchmark = {
    profitMargin: 0.15,       // 15%
    rentRatio: 0.25,          // 25% of revenue
    instructorCostRatio: 0.30, // 30% of revenue
    classUtilization: 0.65,    // 65% fill rate
    revenuePerMember: 15000,   // $150/month in cents
  }

  // Adjust by discipline
  const adjustments: Record<string, Partial<Benchmark>> = {
    pole: { instructorCostRatio: 0.25, classUtilization: 0.70, revenuePerMember: 20000 },
    aerial: { instructorCostRatio: 0.25, classUtilization: 0.70, revenuePerMember: 20000 },
    bjj: { rentRatio: 0.30, instructorCostRatio: 0.35, revenuePerMember: 18000 },
    yoga: { rentRatio: 0.20, instructorCostRatio: 0.35, classUtilization: 0.60 },
    pilates: { rentRatio: 0.22, revenuePerMember: 22000 },
    crossfit: { rentRatio: 0.28, classUtilization: 0.75, revenuePerMember: 18000 },
    dance: { instructorCostRatio: 0.35, classUtilization: 0.60 },
    cycling: { rentRatio: 0.22, classUtilization: 0.72, revenuePerMember: 16000 },
  }

  return { ...defaults, ...adjustments[discipline] }
}
