// Scheduled notification job endpoints
//
// Mounted at /api/jobs in index.ts.
// All endpoints require a CRON_SECRET Bearer token.
//
//   POST /api/jobs/reminders          — class reminder notifications (hourly)
//   POST /api/jobs/reengagement       — re-engagement emails (daily)
//   POST /api/jobs/generate-classes   — generate class instances for all studios (daily)

import { Hono } from 'hono'
import { createServiceClient } from '../lib/supabase'
import { sendNotification } from '../lib/notifications'
import { generateClassInstances } from '../lib/class-generator'

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
      channels: ['push', 'in_app'],
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
      channels: ['push', 'in_app'],
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

  return c.json({ studiосProcessed: (studios ?? []).length, reengagementSent: totalSent })
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
  const { data: studios } = await supabase
    .from('studios')
    .select('id')
    .in(
      'id',
      supabase.from('class_templates').select('studio_id').eq('active', true),
    )

  let totalGenerated = 0
  const results: Array<{ studioId: string; generated: number }> = []

  for (const studio of studios ?? []) {
    const count = await generateClassInstances(studio.id, weeksAhead)
    totalGenerated += count
    results.push({ studioId: studio.id, generated: count })
  }

  return c.json({ studiosProcessed: results.length, totalGenerated, results })
})

export { jobs }
export default jobs
