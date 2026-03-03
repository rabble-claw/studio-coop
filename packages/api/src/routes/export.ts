// GDPR / NZ Privacy Act data export endpoint.
//
// Mounted at /api in index.ts so the path is:
//   GET /my/export — download all personal data as JSON

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createServiceClient } from '../lib/supabase'

const exportRoute = new Hono()

exportRoute.get('/my/export', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  // Gather all data categories in parallel
  const [
    profileRes,
    membershipsRes,
    bookingsRes,
    attendanceRes,
    subscriptionsRes,
    paymentsRes,
    feedPostsRes,
    notificationPrefsRes,
    calendarTokensRes,
  ] = await Promise.all([
    // 1. Profile
    supabase
      .from('users')
      .select('id, email, name, avatar_url, phone, created_at, updated_at')
      .eq('id', user.id)
      .single(),

    // 2. Memberships
    supabase
      .from('memberships')
      .select('id, studio_id, role, status, joined_at, studio:studios!memberships_studio_id_fkey(name, slug)')
      .eq('user_id', user.id),

    // 3. Bookings
    supabase
      .from('bookings')
      .select(`
        id, status, waitlist_position, booked_at, confirmed_at, cancelled_at,
        class_instance:class_instances(
          date, start_time,
          template:class_templates(name)
        )
      `)
      .eq('user_id', user.id)
      .order('booked_at', { ascending: false }),

    // 4. Attendance
    supabase
      .from('attendance')
      .select('id, class_instance_id, checked_in_at, checked_in_by, method')
      .eq('user_id', user.id)
      .order('checked_in_at', { ascending: false }),

    // 5. Subscriptions
    supabase
      .from('subscriptions')
      .select(`
        id, status, current_period_start, current_period_end, cancel_at_period_end, created_at,
        plan:plans(name, interval, price)
      `)
      .eq('user_id', user.id),

    // 6. Payments (never expose full card numbers)
    supabase
      .from('payments')
      .select('id, amount, currency, type, refunded, created_at, studio_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    // 7. Feed posts authored by user
    supabase
      .from('feed_posts')
      .select('id, class_instance_id, content, media_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    // 8. Notification preferences
    supabase
      .from('notification_preferences')
      .select('id, studio_id, channel, type, enabled')
      .eq('user_id', user.id),

    // 9. Calendar tokens (existence only, not the actual token values)
    supabase
      .from('calendar_tokens')
      .select('id, studio_id, created_at')
      .eq('user_id', user.id),
  ])

  // Normalize FK joins in memberships
  const memberships = (membershipsRes.data ?? []).map((m: any) => ({
    ...m,
    studio: Array.isArray(m.studio) ? m.studio[0] : m.studio,
  }))

  // Normalize FK joins in bookings
  const bookings = (bookingsRes.data ?? []).map((b: any) => {
    const ci = Array.isArray(b.class_instance) ? b.class_instance[0] : b.class_instance
    const template = ci ? (Array.isArray(ci.template) ? ci.template[0] : ci.template) : null
    return {
      id: b.id,
      status: b.status,
      waitlist_position: b.waitlist_position,
      booked_at: b.booked_at,
      confirmed_at: b.confirmed_at,
      cancelled_at: b.cancelled_at,
      class_date: ci?.date ?? null,
      class_start_time: ci?.start_time ?? null,
      class_name: template?.name ?? null,
    }
  })

  // Normalize FK joins in subscriptions
  const subscriptions = (subscriptionsRes.data ?? []).map((s: any) => ({
    ...s,
    plan: Array.isArray(s.plan) ? s.plan[0] : s.plan,
  }))

  const exportData = {
    exported_at: new Date().toISOString(),
    user: profileRes.data ?? null,
    memberships,
    bookings,
    attendance: attendanceRes.data ?? [],
    subscriptions,
    payments: paymentsRes.data ?? [],
    feed_posts: feedPostsRes.data ?? [],
    notification_preferences: notificationPrefsRes.data ?? [],
    calendar_tokens: (calendarTokensRes.data ?? []).map((t: any) => ({
      id: t.id,
      studio_id: t.studio_id,
      created_at: t.created_at,
    })),
  }

  c.header('Content-Disposition', 'attachment; filename="studio-coop-data-export.json"')
  c.header('Content-Type', 'application/json')
  return c.json(exportData)
})

export default exportRoute
