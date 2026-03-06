// Scheduled notification job endpoints
//
// Mounted at /api/jobs in index.ts.
// All endpoints require a CRON_SECRET Bearer token.
//
//   POST /api/jobs/reminders          — class reminder notifications (hourly)
//   POST /api/jobs/reengagement       — re-engagement emails (daily)
//   POST /api/jobs/generate-classes   — generate class instances for all studios (daily)
//   POST /api/jobs/retention-scores   — compute member churn risk scores (daily)
//   POST /api/jobs/weekly-brief       — generate weekly AI briefs (weekly, Mondays)
//   POST /api/jobs/onboarding         — advance onboarding sequences (daily)

import { Hono } from 'hono'
import { createServiceClient } from '../lib/supabase'
import { sendNotification } from '../lib/notifications'
import { generateClassInstances } from '../lib/class-generator'
import { computeRetentionScore } from '../lib/retention'
import { advanceOnboarding } from '../lib/onboarding'
import { aggregateBriefData, getWeekStart } from '../routes/weekly-brief'

const jobs = new Hono()

// ─── Auth middleware ──────────────────────────────────────────────────────────

function cronAuth(c: any): boolean {
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret) return false
  const auth = c.req.header('Authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Class reminders — run every hour
// POST /api/jobs/reminders
//
// Find bookings where class starts in 24±30min or 2±30min.
// Skip if a reminder of that type was already sent for this booking.
// ─────────────────────────────────────────────────────────────────────────────

jobs.post('/reminders', async (c) => {
  if (!cronAuth(c)) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createServiceClient()
  const now = new Date()

  // Helper: build ISO datetime range for a target-hours window (±30 min)
  function windowRange(targetHours: number) {
    const center = new Date(now.getTime() + targetHours * 60 * 60 * 1000)
    const start = new Date(center.getTime() - 30 * 60 * 1000)
    const end = new Date(center.getTime() + 30 * 60 * 1000)
    return { start: start.toISOString(), end: end.toISOString() }
  }

  const w24 = windowRange(24)
  const w2 = windowRange(2)

  // Fetch upcoming bookings in both windows.
  // We join class_instances to get the actual class datetime.
  const { data: bookings24 } = await supabase
    .from('bookings')
    .select(`
      id, user_id,
      class_instance:class_instances!inner(
        id, studio_id, date, start_time,
        template:class_templates(name)
      )
    `)
    .in('status', ['booked', 'confirmed'])
    .gte('class_instances.start_time', w24.start.split('T')[1].slice(0, 5))
    .lte('class_instances.start_time', w24.end.split('T')[1].slice(0, 5))

  const { data: bookings2 } = await supabase
    .from('bookings')
    .select(`
      id, user_id,
      class_instance:class_instances!inner(
        id, studio_id, date, start_time,
        template:class_templates(name)
      )
    `)
    .in('status', ['booked', 'confirmed'])
    .gte('class_instances.start_time', w2.start.split('T')[1].slice(0, 5))
    .lte('class_instances.start_time', w2.end.split('T')[1].slice(0, 5))

  // Helper: check if reminder already sent for this user + class + type
  async function alreadySent(userId: string, classInstanceId: string, type: string): Promise<boolean> {
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .contains('data', { classInstanceId })
      .limit(1)
    return (data?.length ?? 0) > 0
  }

  let sent24 = 0
  let sent2 = 0

  for (const b of bookings24 ?? []) {
    const ci = Array.isArray(b.class_instance) ? b.class_instance[0] : b.class_instance
    if (!ci) continue
    const template = Array.isArray(ci.template) ? ci.template[0] : ci.template
    const already = await alreadySent(b.user_id, ci.id, 'class_reminder_24h')
    if (already) continue

    await sendNotification({
      userId: b.user_id,
      studioId: ci.studio_id,
      type: 'class_reminder_24h',
      title: 'Class tomorrow',
      body: `Your ${template?.name ?? 'class'} is tomorrow. See you there!`,
      data: { classInstanceId: ci.id, bookingId: b.id },
      channels: ['push', 'email', 'in_app'],
    })
    sent24++
  }

  for (const b of bookings2 ?? []) {
    const ci = Array.isArray(b.class_instance) ? b.class_instance[0] : b.class_instance
    if (!ci) continue
    const template = Array.isArray(ci.template) ? ci.template[0] : ci.template
    const already = await alreadySent(b.user_id, ci.id, 'class_reminder_2h')
    if (already) continue

    await sendNotification({
      userId: b.user_id,
      studioId: ci.studio_id,
      type: 'class_reminder_2h',
      title: 'Class starting soon',
      body: `Your ${template?.name ?? 'class'} starts in 2 hours. Get ready!`,
      data: { classInstanceId: ci.id, bookingId: b.id },
      channels: ['push', 'email', 'in_app'],
    })
    sent2++
  }

  return c.json({ sent24hReminders: sent24, sent2hReminders: sent2 })
})

// ─────────────────────────────────────────────────────────────────────────────
// Re-engagement — run daily
// POST /api/jobs/reengagement
//
// Find members who haven't booked in 14+ days (configurable per studio),
// send "We miss you!" notification. Respects studio settings and user prefs.
// ─────────────────────────────────────────────────────────────────────────────

jobs.post('/reengagement', async (c) => {
  if (!cronAuth(c)) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createServiceClient()

  // Get studios with reengagement enabled (check settings.notifications.reengagementEnabled)
  const { data: studios } = await supabase
    .from('studios')
    .select('id, name, settings')

  let totalSent = 0

  for (const studio of studios ?? []) {
    const settings = (studio.settings ?? {}) as Record<string, unknown>
    const notifSettings = (settings.notifications ?? {}) as Record<string, unknown>

    // Default: reengagement enabled
    if (notifSettings.reengagementEnabled === false) continue

    const daysThreshold = typeof notifSettings.reengagementDays === 'number'
      ? notifSettings.reengagementDays
      : 14

    const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000).toISOString()

    // Find active members of this studio
    const { data: memberships } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('studio_id', studio.id)
      .eq('status', 'active')
      .eq('role', 'member')

    for (const m of memberships ?? []) {
      // Check if they have any booking in the last N days
      const { data: recentBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('user_id', m.user_id)
        .in('status', ['booked', 'confirmed'])
        .gte('booked_at', cutoff)
        .limit(1)

      if ((recentBookings?.length ?? 0) > 0) continue  // recently active

      // Skip if we sent one in the last 7 days to avoid spam
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', m.user_id)
        .eq('studio_id', studio.id)
        .eq('type', 'reengagement')
        .gte('sent_at', sevenDaysAgo)
        .limit(1)

      if ((recentNotif?.length ?? 0) > 0) continue  // already sent recently

      await sendNotification({
        userId: m.user_id,
        studioId: studio.id,
        type: 'reengagement',
        title: `We miss you at ${studio.name}!`,
        body: `It's been a while since your last class. Book now and get back on track!`,
        data: { studioId: studio.id },
        channels: ['push', 'email', 'in_app'],
      })
      totalSent++
    }
  }

  return c.json({ studiosProcessed: (studios ?? []).length, reengagementSent: totalSent })
})

// ─────────────────────────────────────────────────────────────────────────────
// Class generation — run daily
// POST /api/jobs/generate-classes
//
// Runs generateClassInstances for all active studios (with active templates).
// ─────────────────────────────────────────────────────────────────────────────

jobs.post('/generate-classes', async (c) => {
  if (!cronAuth(c)) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createServiceClient()
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const weeksAhead = Number(body.weeksAhead) || 4

  // Find all studios that have active class templates
  const { data: activeTemplates } = await supabase
    .from('class_templates')
    .select('studio_id')
    .eq('active', true)

  const studioIds = [...new Set((activeTemplates ?? []).map((t) => t.studio_id))]

  const { data: studios } = studioIds.length > 0
    ? await supabase
        .from('studios')
        .select('id')
        .in('id', studioIds)
    : { data: [] }

  let totalGenerated = 0
  const results: Array<{ studioId: string; generated: number }> = []

  for (const studio of studios ?? []) {
    const count = await generateClassInstances(studio.id, weeksAhead)
    totalGenerated += count
    results.push({ studioId: studio.id, generated: count })
  }

  return c.json({ studiosProcessed: results.length, totalGenerated, results })
})

// ─────────────────────────────────────────────────────────────────────────────
// Retention scores — run daily (hour 1)
// POST /api/jobs/retention-scores
//
// Compute churn risk scores for all active members across all studios.
// ─────────────────────────────────────────────────────────────────────────────

jobs.post('/retention-scores', async (c) => {
  if (!cronAuth(c)) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createServiceClient()
  const now = new Date()

  // Get all studios with active memberships
  const { data: studios } = await supabase
    .from('studios')
    .select('id')

  let totalScored = 0

  for (const studio of studios ?? []) {
    // Get active members
    const { data: memberships } = await supabase
      .from('memberships')
      .select('user_id, joined_at')
      .eq('studio_id', studio.id)
      .eq('status', 'active')

    if (!memberships?.length) continue

    const userIds = memberships.map(m => m.user_id)

    // Get last attendance per user (last 8 weeks)
    const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000).toISOString()
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString()

    const { data: attendance } = await supabase
      .from('attendance')
      .select('user_id, checked_in_at')
      .in('user_id', userIds)
      .gte('checked_in_at', eightWeeksAgo)

    // Get subscriptions
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id, status, cancel_at_period_end')
      .in('user_id', userIds)
      .eq('studio_id', studio.id)

    // Build attendance maps
    const attendanceByUser: Record<string, string[]> = {}
    for (const a of attendance ?? []) {
      if (!attendanceByUser[a.user_id]) attendanceByUser[a.user_id] = []
      attendanceByUser[a.user_id].push(a.checked_in_at)
    }

    const subByUser: Record<string, { status: string; cancel_at_period_end: boolean }> = {}
    for (const s of subs ?? []) {
      subByUser[s.user_id] = { status: s.status, cancel_at_period_end: s.cancel_at_period_end ?? false }
    }

    // Score each member
    const scores: Array<{ studio_id: string; user_id: string; score: number; factors: unknown; stage: string; computed_at: string }> = []

    for (const m of memberships) {
      const userAttendance = attendanceByUser[m.user_id] ?? []
      const lastAttendance = userAttendance.length > 0
        ? new Date(userAttendance.sort().reverse()[0])
        : null
      const daysInactive = lastAttendance
        ? Math.floor((now.getTime() - lastAttendance.getTime()) / (1000 * 60 * 60 * 24))
        : 999

      const last4 = userAttendance.filter(a => new Date(a) >= new Date(fourWeeksAgo)).length
      const prior4 = userAttendance.filter(a => new Date(a) < new Date(fourWeeksAgo)).length

      const sub = subByUser[m.user_id]
      let subStatus: 'active' | 'cancel_at_period_end' | 'cancelled' | 'paused' | 'none' = 'none'
      if (sub) {
        if (sub.cancel_at_period_end) subStatus = 'cancel_at_period_end'
        else if (sub.status === 'active') subStatus = 'active'
        else if (sub.status === 'paused') subStatus = 'paused'
        else if (sub.status === 'cancelled') subStatus = 'cancelled'
      }

      const tenureDays = m.joined_at
        ? Math.floor((now.getTime() - new Date(m.joined_at).getTime()) / (1000 * 60 * 60 * 24))
        : 365

      const result = computeRetentionScore({
        daysInactive,
        attendanceLast4Weeks: last4,
        attendancePrior4Weeks: prior4,
        subscriptionStatus: subStatus,
        hasPaymentIssues: false, // TODO: check payment failures
        memberTenureDays: tenureDays,
        engagementScore: 50, // Default neutral engagement
      })

      scores.push({
        studio_id: studio.id,
        user_id: m.user_id,
        score: result.score,
        factors: result.factors,
        stage: result.stage,
        computed_at: now.toISOString(),
      })
    }

    // Delete old scores for this studio and insert new
    if (scores.length > 0) {
      await supabase
        .from('member_risk_scores')
        .delete()
        .eq('studio_id', studio.id)

      await supabase
        .from('member_risk_scores')
        .insert(scores)

      totalScored += scores.length
    }
  }

  return c.json({ studiosProcessed: (studios ?? []).length, membersScored: totalScored })
})

// ─────────────────────────────────────────────────────────────────────────────
// Weekly brief — run weekly (Monday 6am NZST = Sunday 18:00 UTC)
// POST /api/jobs/weekly-brief
//
// Generate weekly AI briefs for all studios with active memberships.
// ─────────────────────────────────────────────────────────────────────────────

jobs.post('/weekly-brief', async (c) => {
  if (!cronAuth(c)) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createServiceClient()

  const { data: studios } = await supabase
    .from('studios')
    .select('id, name')

  let generated = 0
  const weekStart = getWeekStart()

  for (const studio of studios ?? []) {
    try {
      const data = await aggregateBriefData(studio.id)

      await supabase
        .from('weekly_briefs')
        .upsert(
          { studio_id: studio.id, week_start: weekStart, data },
          { onConflict: 'studio_id,week_start' }
        )

      generated++
    } catch (err) {
      console.error(`[weekly-brief] Error for studio ${studio.id}:`, err)
    }
  }

  return c.json({ studiosProcessed: (studios ?? []).length, briefsGenerated: generated })
})

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — run daily
// POST /api/jobs/onboarding
//
// Advance active onboarding sequences for all members.
// ─────────────────────────────────────────────────────────────────────────────

jobs.post('/onboarding', async (c) => {
  if (!cronAuth(c)) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createServiceClient()

  const { data: sequences } = await supabase
    .from('onboarding_sequences')
    .select('studio_id, user_id, step, started_at')
    .eq('status', 'active')

  let advanced = 0
  let completed = 0

  for (const seq of sequences ?? []) {
    try {
      const result = await advanceOnboarding(
        seq.studio_id,
        seq.user_id,
        seq.step,
        seq.started_at
      )
      if (result.advanced) advanced++
      if (result.completed) completed++
    } catch (err) {
      console.error(`[onboarding] Error for ${seq.user_id}:`, err)
    }
  }

  return c.json({ sequencesProcessed: (sequences ?? []).length, advanced, completed })
})

export { jobs }
export default jobs
