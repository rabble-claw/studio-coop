// Weekly AI brief routes
//
// Mounted at /api/studios in index.ts.
//
//   GET  /:studioId/briefs          — list recent briefs
//   GET  /:studioId/briefs/latest   — most recent brief
//   POST /:studioId/briefs/generate — force-generate a brief (admin only)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff, requireAdmin } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound } from '../lib/errors'

const weeklyBrief = new Hono()

/** Get the Monday of the current week (ISO week start) */
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setUTCDate(diff)
  return d.toISOString().split('T')[0]
}

/** Aggregate studio data for a brief */
async function aggregateBriefData(studioId: string) {
  const supabase = createServiceClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0]
  const todayStr = now.toISOString().split('T')[0]

  // Active members count
  const { count: activeMembers } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('status', 'active')

  // New members this week
  const { count: newMembers } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .gte('joined_at', weekAgoStr)

  // Revenue this week
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('studio_id', studioId)
    .eq('refunded', false)
    .gte('created_at', weekAgo.toISOString())

  const weekRevenue = (payments ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0)

  // Revenue last week (for comparison)
  const { data: prevPayments } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('studio_id', studioId)
    .eq('refunded', false)
    .gte('created_at', twoWeeksAgo.toISOString())
    .lt('created_at', weekAgo.toISOString())

  const prevWeekRevenue = (prevPayments ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0)

  // Class attendance this week
  const { data: thisWeekClasses } = await supabase
    .from('class_instances')
    .select('booked_count, max_capacity')
    .eq('studio_id', studioId)
    .gte('date', weekAgoStr)
    .lte('date', todayStr)
    .in('status', ['completed', 'scheduled'])

  const totalBooked = (thisWeekClasses ?? []).reduce((s, c) => s + (c.booked_count ?? 0), 0)
  const totalCapacity = (thisWeekClasses ?? []).reduce((s, c) => s + (c.max_capacity ?? 0), 0)
  const avgFillRate = totalCapacity > 0 ? Math.round(totalBooked / totalCapacity * 100) : 0

  // Retention risk summary
  const { data: riskScores } = await supabase
    .from('member_risk_scores')
    .select('score, stage')
    .eq('studio_id', studioId)

  const atRiskCount = (riskScores ?? []).filter(s => s.score > 50).length
  const avgRiskScore = (riskScores ?? []).length > 0
    ? Math.round((riskScores ?? []).reduce((s, r) => s + r.score, 0) / (riskScores ?? []).length)
    : 0

  return {
    period: { start: weekAgoStr, end: todayStr },
    members: {
      active: activeMembers ?? 0,
      new_this_week: newMembers ?? 0,
    },
    revenue: {
      this_week_cents: weekRevenue,
      prev_week_cents: prevWeekRevenue,
      change_percent: prevWeekRevenue > 0
        ? Math.round((weekRevenue - prevWeekRevenue) / prevWeekRevenue * 100)
        : null,
    },
    attendance: {
      classes_held: (thisWeekClasses ?? []).length,
      total_checkins: totalBooked,
      avg_fill_rate: avgFillRate,
    },
    retention: {
      at_risk_members: atRiskCount,
      avg_risk_score: avgRiskScore,
    },
  }
}

// ─── GET /:studioId/briefs ───────────────────────────────────────────────────
weeklyBrief.get('/:studioId/briefs', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId') as string
  const limit = Math.min(Number(c.req.query('limit')) || 10, 52)

  const supabase = createServiceClient()

  const { data: briefs } = await supabase
    .from('weekly_briefs')
    .select('id, week_start, data, narrative, created_at')
    .eq('studio_id', studioId)
    .order('week_start', { ascending: false })
    .limit(limit)

  return c.json({ briefs: briefs ?? [] })
})

// ─── GET /:studioId/briefs/latest ────────────────────────────────────────────
weeklyBrief.get('/:studioId/briefs/latest', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId') as string

  const supabase = createServiceClient()

  const { data: brief } = await supabase
    .from('weekly_briefs')
    .select('*')
    .eq('studio_id', studioId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!brief) throw notFound('Weekly brief')

  return c.json({ brief })
})

// ─── POST /:studioId/briefs/generate ─────────────────────────────────────────
weeklyBrief.post('/:studioId/briefs/generate', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.get('studioId') as string

  const data = await aggregateBriefData(studioId)
  const weekStart = getWeekStart()

  const supabase = createServiceClient()

  // Upsert: replace if brief already exists for this week
  const { data: brief, error } = await supabase
    .from('weekly_briefs')
    .upsert(
      { studio_id: studioId, week_start: weekStart, data },
      { onConflict: 'studio_id,week_start' }
    )
    .select('*')
    .single()

  if (error) throw error

  return c.json({ brief })
})

export { weeklyBrief, aggregateBriefData, getWeekStart }
export default weeklyBrief
