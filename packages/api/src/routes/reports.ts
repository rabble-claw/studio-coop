// Reports / analytics routes — studio-scoped (mounted at /api/studios)
//
//   GET /:studioId/reports/overview         — summary cards
//   GET /:studioId/reports/attendance       — weekly attendance aggregates
//   GET /:studioId/reports/revenue          — monthly revenue by type
//   GET /:studioId/reports/popular-classes  — top classes by attendance
//   GET /:studioId/reports/at-risk          — members with no recent attendance

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireMember, requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { forbidden } from '../lib/errors'

const reports = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/reports/overview — summary cards
// ─────────────────────────────────────────────────────────────────────────────

reports.get('/:studioId/reports/overview', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  // Active members count
  const { count: activeMembers } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('status', 'active')

  // Total revenue from payments (no status column — all rows are successful payments)
  const { data: revenueData } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('studio_id', studioId)
    .eq('refunded', false)

  const totalRevenue = (revenueData ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)

  // Average attendance rate from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: recentClasses } = await supabase
    .from('class_instances')
    .select('id, max_capacity, booked_count')
    .eq('studio_id', studioId)
    .gte('date', thirtyDaysAgo)
    .eq('status', 'completed')

  let avgAttendanceRate = 0
  if (recentClasses && recentClasses.length > 0) {
    const totalCapacity = recentClasses.reduce((s, c) => s + (c.max_capacity ?? 0), 0)
    const totalBooked = recentClasses.reduce((s, c) => s + (c.booked_count ?? 0), 0)
    avgAttendanceRate = totalCapacity > 0 ? totalBooked / totalCapacity : 0
  }

  // Retention: members active now vs members active 30 days ago
  const { count: currentActiveCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('status', 'active')

  const { count: previousCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .in('status', ['active', 'cancelled'])
    .lte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const retentionRate = previousCount && previousCount > 0
    ? Math.min((currentActiveCount ?? 0) / previousCount, 1)
    : 0

  return c.json({
    activeMembers: activeMembers ?? 0,
    totalRevenue,
    avgAttendanceRate: Math.round(avgAttendanceRate * 100) / 100,
    retentionRate: Math.round(retentionRate * 100) / 100,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/reports/attendance?from=&to= — weekly attendance
// ─────────────────────────────────────────────────────────────────────────────

reports.get('/:studioId/reports/attendance', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const from = c.req.query('from') ?? new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = c.req.query('to') ?? new Date().toISOString().split('T')[0]

  const { data: classes } = await supabase
    .from('class_instances')
    .select('id, date, max_capacity, booked_count')
    .eq('studio_id', studioId)
    .gte('date', from)
    .lte('date', to)
    .not('status', 'eq', 'cancelled')
    .order('date')

  // Group by week (Monday-based)
  const weeks: Record<string, { classes: number; checkins: number; capacity: number }> = {}
  for (const cls of classes ?? []) {
    const d = new Date(cls.date)
    const dayOfWeek = d.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(d)
    monday.setDate(d.getDate() + mondayOffset)
    const weekKey = monday.toISOString().split('T')[0]

    if (!weeks[weekKey]) weeks[weekKey] = { classes: 0, checkins: 0, capacity: 0 }
    weeks[weekKey].classes += 1
    weeks[weekKey].checkins += cls.booked_count ?? 0
    weeks[weekKey].capacity += cls.max_capacity ?? 0
  }

  const attendance = Object.entries(weeks).map(([week, data]) => ({
    week,
    classes: data.classes,
    checkins: data.checkins,
    rate: data.capacity > 0 ? Math.round((data.checkins / data.capacity) * 100) / 100 : 0,
  }))

  return c.json({ attendance })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/reports/revenue?from=&to= — monthly revenue by type
// ─────────────────────────────────────────────────────────────────────────────

reports.get('/:studioId/reports/revenue', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const from = c.req.query('from') ?? new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = c.req.query('to') ?? new Date().toISOString().split('T')[0]

  const { data: payments } = await supabase
    .from('payments')
    .select('amount_cents, type, created_at')
    .eq('studio_id', studioId)
    .eq('refunded', false)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at')

  // Group by month
  const months: Record<string, { revenue: number; memberships: number; dropins: number; packs: number }> = {}
  for (const p of payments ?? []) {
    const monthKey = (p.created_at as string).slice(0, 7) // YYYY-MM
    if (!months[monthKey]) months[monthKey] = { revenue: 0, memberships: 0, dropins: 0, packs: 0 }
    months[monthKey].revenue += p.amount_cents ?? 0

    // DB types: subscription, class_pack, drop_in, private_booking
    const type = (p.type as string) ?? 'other'
    if (type === 'subscription') months[monthKey].memberships += p.amount_cents ?? 0
    else if (type === 'drop_in') months[monthKey].dropins += p.amount_cents ?? 0
    else if (type === 'class_pack') months[monthKey].packs += p.amount_cents ?? 0
  }

  const revenue = Object.entries(months).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    memberships: data.memberships,
    dropins: data.dropins,
    packs: data.packs,
  }))

  return c.json({ revenue })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/reports/popular-classes — top classes by avg attendance
// ─────────────────────────────────────────────────────────────────────────────

reports.get('/:studioId/reports/popular-classes', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: classes } = await supabase
    .from('class_instances')
    .select('template_id, max_capacity, booked_count, template:class_templates(name)')
    .eq('studio_id', studioId)
    .gte('date', thirtyDaysAgo)
    .not('status', 'eq', 'cancelled')

  // Group by template
  const templates: Record<string, { name: string; totalBooked: number; totalCapacity: number; count: number }> = {}
  for (const cls of classes ?? []) {
    const tid = cls.template_id as string
    if (!tid) continue
    const tpl = cls.template as unknown as { name: string } | null
    if (!templates[tid]) templates[tid] = { name: tpl?.name ?? 'Unknown', totalBooked: 0, totalCapacity: 0, count: 0 }
    templates[tid].totalBooked += cls.booked_count ?? 0
    templates[tid].totalCapacity += cls.max_capacity ?? 0
    templates[tid].count += 1
  }

  const popular = Object.entries(templates)
    .map(([, data]) => ({
      name: data.name,
      avgAttendance: Math.round((data.totalBooked / data.count) * 10) / 10,
      capacity: Math.round(data.totalCapacity / data.count),
      fillRate: data.totalCapacity > 0
        ? Math.round((data.totalBooked / data.totalCapacity) * 100) / 100
        : 0,
    }))
    .sort((a, b) => b.avgAttendance - a.avgAttendance)
    .slice(0, 10)

  return c.json({ classes: popular })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/reports/at-risk — members with no attendance in 14+ days
// ─────────────────────────────────────────────────────────────────────────────

reports.get('/:studioId/reports/at-risk', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get active members
  const { data: members } = await supabase
    .from('memberships')
    .select('user_id, user:users(id, name, email)')
    .eq('studio_id', studioId)
    .eq('status', 'active')

  // Get recent attendance (last 14 days) — join through class_instances for studio_id
  const { data: recentAttendance } = await supabase
    .from('attendance')
    .select('user_id, checked_in_at, class_instance:class_instances!inner(studio_id)')
    .eq('class_instance.studio_id', studioId)
    .gte('checked_in_at', fourteenDaysAgo)

  const recentUserIds = new Set((recentAttendance ?? []).map(a => a.user_id))

  // Filter to at-risk members (no recent attendance)
  const atRiskMembers = (members ?? []).filter(m => {
    if (recentUserIds.has(m.user_id)) return false
    const user = m.user as unknown as { id: string; name: string; email: string } | null
    return !!user
  })

  // Batch fetch last attendance for all at-risk members in one query
  const atRiskUserIds = atRiskMembers.map(m => m.user_id)
  let lastAttendanceMap: Record<string, string> = {}

  if (atRiskUserIds.length > 0) {
    const { data: allAttendance } = await supabase
      .from('attendance')
      .select('user_id, checked_in_at, class_instance:class_instances!inner(studio_id)')
      .eq('class_instance.studio_id', studioId)
      .in('user_id', atRiskUserIds)
      .order('checked_in_at', { ascending: false })

    // Build a map of user_id -> most recent checked_in_at
    for (const a of allAttendance ?? []) {
      if (!lastAttendanceMap[a.user_id]) {
        lastAttendanceMap[a.user_id] = a.checked_in_at
      }
    }
  }

  const atRisk = atRiskMembers.map(m => {
    const user = m.user as unknown as { id: string; name: string; email: string }
    return {
      name: user.name ?? user.email,
      email: user.email,
      lastClass: lastAttendanceMap[m.user_id] ?? null,
    }
  })

  // Sort by most recent first (null last)
  atRisk.sort((a, b) => {
    if (!a.lastClass) return 1
    if (!b.lastClass) return -1
    return new Date(b.lastClass).getTime() - new Date(a.lastClass).getTime()
  })

  return c.json({ members: atRisk.slice(0, 20) })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/reports/teacher/:teacherId — teacher-specific analytics
// ─────────────────────────────────────────────────────────────────────────────

reports.get('/:studioId/reports/teacher/:teacherId', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const teacherId = c.req.param('teacherId')
  const user = c.get('user')
  const memberRole = c.get('memberRole')

  // Teachers can see their own stats; staff/admin/owner can see anyone's
  if (user.id !== teacherId && !['admin', 'owner'].includes(memberRole)) {
    throw forbidden('You can only view your own teaching stats')
  }

  const supabase = createServiceClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get all class instances taught by this teacher in last 90 days
  const { data: classes } = await supabase
    .from('class_instances')
    .select('id, date, max_capacity, booked_count, template_id, template:class_templates(name)')
    .eq('studio_id', studioId)
    .eq('teacher_id', teacherId)
    .gte('date', ninetyDaysAgo)
    .not('status', 'eq', 'cancelled')
    .order('date')

  const allClasses = classes ?? []
  const classesTaught = allClasses.length

  // Overall averages
  const totalAttendance = allClasses.reduce((s, c) => s + (c.booked_count ?? 0), 0)
  const totalCapacity = allClasses.reduce((s, c) => s + (c.max_capacity ?? 0), 0)
  const avgAttendance = classesTaught > 0 ? Math.round((totalAttendance / classesTaught) * 10) / 10 : 0
  const avgFillRate = totalCapacity > 0 ? Math.round((totalAttendance / totalCapacity) * 100) / 100 : 0

  // Weekly trend (Monday-based)
  const weeks: Record<string, { classes: number; totalAttendance: number; totalCapacity: number }> = {}
  for (const cls of allClasses) {
    const d = new Date(cls.date)
    const dayOfWeek = d.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(d)
    monday.setDate(d.getDate() + mondayOffset)
    const weekKey = monday.toISOString().split('T')[0]

    if (!weeks[weekKey]) weeks[weekKey] = { classes: 0, totalAttendance: 0, totalCapacity: 0 }
    weeks[weekKey].classes += 1
    weeks[weekKey].totalAttendance += cls.booked_count ?? 0
    weeks[weekKey].totalCapacity += cls.max_capacity ?? 0
  }

  const weeklyTrend = Object.entries(weeks).map(([week, data]) => ({
    week,
    classes: data.classes,
    avgAttendance: data.classes > 0 ? Math.round((data.totalAttendance / data.classes) * 10) / 10 : 0,
    avgFillRate: data.totalCapacity > 0 ? Math.round((data.totalAttendance / data.totalCapacity) * 100) / 100 : 0,
  }))

  // Top classes by fill rate (grouped by template)
  const templateMap: Record<string, { name: string; count: number; totalBooked: number; totalCapacity: number }> = {}
  for (const cls of allClasses) {
    const tid = cls.template_id as string
    if (!tid) continue
    const tpl = cls.template as unknown as { name: string } | null
    if (!templateMap[tid]) templateMap[tid] = { name: tpl?.name ?? 'Unknown', count: 0, totalBooked: 0, totalCapacity: 0 }
    templateMap[tid].count += 1
    templateMap[tid].totalBooked += cls.booked_count ?? 0
    templateMap[tid].totalCapacity += cls.max_capacity ?? 0
  }

  const topClasses = Object.values(templateMap)
    .map(data => ({
      name: data.name,
      timesTaught: data.count,
      avgAttendance: data.count > 0 ? Math.round((data.totalBooked / data.count) * 10) / 10 : 0,
      fillRate: data.totalCapacity > 0 ? Math.round((data.totalBooked / data.totalCapacity) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.fillRate - a.fillRate)
    .slice(0, 10)

  return c.json({
    classesTaught,
    avgAttendance,
    avgFillRate,
    weeklyTrend,
    topClasses,
  })
})

export { reports }
export default reports
