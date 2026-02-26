import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff } from '../middleware/studio-access'
import { badRequest } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'

// Mounted at two prefixes in index.ts:
//   /api/studios  → /:studioId/attendance
//   /api/my       → /attendance
const attendance = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 5a: Studio attendance history (staff view)
// GET /api/studios/:studioId/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns attendance data per class for a date range.
 * Includes per-class counts and aggregate stats.
 */
attendance.get('/:studioId/attendance', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const from = c.req.query('from')
  const to = c.req.query('to')

  if (!from) throw badRequest('from date is required')
  if (!to) throw badRequest('to date is required')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw badRequest('Dates must be in YYYY-MM-DD format')
  }

  if (from > to) throw badRequest('from must be before to')

  // Fetch completed/in_progress class instances in range
  const { data: instances, error: instError } = await supabase
    .from('class_instances')
    .select(`
      id,
      date,
      start_time,
      status,
      max_capacity,
      template:class_templates!class_instances_template_id_fkey(name)
    `)
    .eq('studio_id', studioId)
    .gte('date', from)
    .lte('date', to)
    .in('status', ['completed', 'in_progress'])
    .order('date', { ascending: false })

  if (instError) throw instError

  if (!instances || instances.length === 0) {
    return c.json({
      classes: [],
      stats: { total_classes: 0, avg_attendance: 0, no_show_rate: 0 },
    })
  }

  const classIds = instances.map((i) => i.id)

  // Fetch attendance and no-show data in parallel
  const [{ data: attendanceData }, { data: noShowBookings }] = await Promise.all([
    supabase
      .from('attendance')
      .select('class_instance_id, user_id, checked_in, walk_in')
      .in('class_instance_id', classIds),
    supabase
      .from('bookings')
      .select('class_instance_id, user_id')
      .in('class_instance_id', classIds)
      .eq('status', 'no_show'),
  ])

  // Group by class instance
  const attByClass = new Map<string, Array<{ user_id: string; checked_in: boolean; walk_in: boolean }>>()
  const noShowCountByClass = new Map<string, number>()

  for (const a of attendanceData ?? []) {
    const list = attByClass.get(a.class_instance_id) ?? []
    list.push(a)
    attByClass.set(a.class_instance_id, list)
  }

  for (const ns of noShowBookings ?? []) {
    noShowCountByClass.set(
      ns.class_instance_id,
      (noShowCountByClass.get(ns.class_instance_id) ?? 0) + 1,
    )
  }

  // Build per-class summary
  const classes = instances.map((inst) => {
    const att = attByClass.get(inst.id) ?? []
    const checkedInCount = att.filter((a) => a.checked_in).length
    const walkInCount = att.filter((a) => a.walk_in).length
    const noShowCount = noShowCountByClass.get(inst.id) ?? 0
    const templateName = (inst.template as any)?.name ?? 'Unknown'

    return {
      id: inst.id,
      date: inst.date,
      start_time: inst.start_time,
      status: inst.status,
      name: templateName,
      capacity: inst.max_capacity,
      checked_in: checkedInCount,
      walk_ins: walkInCount,
      no_shows: noShowCount,
    }
  })

  // Aggregate stats
  const totalClasses = classes.length
  const totalCheckedIn = classes.reduce((sum, c) => sum + c.checked_in, 0)
  const totalNoShows = classes.reduce((sum, c) => sum + c.no_shows, 0)
  const totalBooked = totalCheckedIn + totalNoShows
  const avgAttendance = totalClasses > 0
    ? Math.round((totalCheckedIn / totalClasses) * 10) / 10
    : 0
  const noShowRate = totalBooked > 0
    ? Math.round((totalNoShows / totalBooked) * 1000) / 10
    : 0

  return c.json({
    classes,
    stats: {
      total_classes: totalClasses,
      avg_attendance: avgAttendance,
      no_show_rate: noShowRate,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 5b: Personal attendance history (member view)
// GET /api/my/attendance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's personal attendance history.
 * Includes streak tracking (consecutive weeks attended) and monthly/yearly totals.
 */
attendance.get('/attendance', authMiddleware, async (c) => {
  const user = c.get('user')
  const supabase = createServiceClient()

  // Join through class_instances to get date info
  const { data: attendanceData, error } = await supabase
    .from('attendance')
    .select(`
      id,
      class_instance_id,
      walk_in,
      class_instance:class_instances!attendance_class_instance_id_fkey(
        id,
        date,
        start_time,
        studio_id,
        template:class_templates!class_instances_template_id_fkey(name)
      )
    `)
    .eq('user_id', user.id)
    .eq('checked_in', true)
    .limit(200)

  if (error) throw error

  const history = (attendanceData ?? [])
    .map((a) => {
      const cls = a.class_instance as any
      return {
        id: a.id,
        class_instance_id: a.class_instance_id,
        walk_in: a.walk_in,
        date: cls?.date ?? null,
        start_time: cls?.start_time ?? null,
        studio_id: cls?.studio_id ?? null,
        class_name: cls?.template?.name ?? 'Unknown',
      }
    })
    .filter((r) => r.date !== null)
    .sort((a, b) => (b.date! > a.date! ? 1 : -1)) // newest first

  // Monthly and yearly counts
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisYear = `${now.getFullYear()}`

  const totalThisMonth = history.filter((r) => r.date!.startsWith(thisMonth)).length
  const totalThisYear = history.filter((r) => r.date!.startsWith(thisYear)).length

  // Streak: consecutive weeks with at least one attendance (looking back from now)
  const attendedWeeks = new Set<string>()
  for (const r of history) {
    const key = getIsoWeekKey(r.date!)
    if (key) attendedWeeks.add(key)
  }

  let streakWeeks = 0
  const today = new Date()
  for (let i = 0; i < 52; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    const key = getIsoWeekKey(d.toISOString().slice(0, 10))
    if (key && attendedWeeks.has(key)) {
      streakWeeks++
    } else if (i > 0) {
      break
    }
  }

  return c.json({
    history,
    stats: {
      total_this_month: totalThisMonth,
      total_this_year: totalThisYear,
      streak_weeks: streakWeeks,
    },
  })
})

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns an ISO year-week key like "2026-W09" for a given YYYY-MM-DD date.
 * Uses Sunday as start of week to match JS getDay().
 */
function getIsoWeekKey(dateStr: string): string | null {
  try {
    const d = new Date(dateStr + 'T00:00:00Z')
    const year = d.getUTCFullYear()
    const startOfYear = new Date(`${year}-01-01T00:00:00Z`)
    // Day of week (0=Sun) for Jan 1 of this year
    const dayOfWeek = d.getUTCDay()
    // Set to Sunday of the week containing d
    const weekStart = new Date(d)
    weekStart.setUTCDate(d.getUTCDate() - dayOfWeek)
    // Week number: days from Jan 1 to weekStart, divided by 7
    const diff = Math.floor((weekStart.getTime() - startOfYear.getTime()) / 86400000)
    const week = Math.floor(diff / 7) + 1
    return `${year}-W${String(week).padStart(2, '0')}`
  } catch {
    return null
  }
}

export { attendance }
export default attendance
