// User-scoped booking routes.
//
// Mounted at /api in index.ts so paths here are:
//   DELETE /bookings/:bookingId              — Task 2: cancel own booking
//   POST   /bookings/:bookingId/confirm      — Task 4: confirm attendance
//   GET    /my/bookings                      — Task 6: list upcoming bookings
//   POST   /my/bookings/reminders            — Task 4: internal cron trigger for reminders

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest, forbidden } from '../lib/errors'
import { refundCredit } from '../lib/credits'
import { promoteFromWaitlist } from '../lib/waitlist'
import { buildBookingCalEvent } from '../lib/calendar'
import { sendNotification } from '../lib/notifications'
import { createPaymentIntent } from '../lib/stripe'
import { getOrCreateStripeCustomer, getConnectedAccountId } from '../lib/payments'

const my = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Cancel a booking
// DELETE /api/bookings/:bookingId
// ─────────────────────────────────────────────────────────────────────────────

my.delete('/bookings/:bookingId', authMiddleware, async (c) => {
  const bookingId = c.req.param('bookingId')
  const user      = c.get('user' as never) as { id: string }
  const supabase  = createServiceClient()

  // ── 1. Fetch booking — must belong to the calling user ────────────────────
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, user_id, status, credit_source, credit_source_id, booked_at,
      class_instance:class_instances(
        id, studio_id, date, start_time,
        studio:studios(settings, timezone, name),
        template:class_templates(name, location, duration_min),
        teacher:users!class_instances_teacher_id_fkey(name)
      )
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) throw notFound('Booking')
  if (booking.user_id !== user.id) throw forbidden('You can only cancel your own bookings')
  if (booking.status === 'cancelled') throw badRequest('Booking is already cancelled')

  const classInstance = Array.isArray(booking.class_instance)
    ? booking.class_instance[0]
    : booking.class_instance
  const studio   = Array.isArray(classInstance?.studio)   ? classInstance.studio[0]   : classInstance?.studio
  const template = Array.isArray(classInstance?.template) ? classInstance.template[0] : classInstance?.template
  const teacher  = Array.isArray(classInstance?.teacher)  ? classInstance.teacher[0]  : classInstance?.teacher

  // ── 2. Cancellation window check ──────────────────────────────────────────
  // studio.settings.cancellationWindowHours — default 12h if not set
  const settings = (studio?.settings ?? {}) as Record<string, unknown>
  const windowHours = typeof settings.cancellationWindowHours === 'number'
    ? settings.cancellationWindowHours
    : 12

  const classDateTime = new Date(`${classInstance?.date}T${classInstance?.start_time}`)
  const now           = new Date()
  const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const withinWindow  = hoursUntilClass >= windowHours

  // ── 3 & 4. Mark cancelled, conditionally refund ───────────────────────────
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: now.toISOString() })
    .eq('id', bookingId)

  let creditRefunded = false
  if (withinWindow && booking.credit_source && booking.credit_source !== 'none') {
    await refundCredit({
      hasCredits: true,
      source: booking.credit_source as any,
      sourceId: booking.credit_source_id ?? undefined,
    })
    creditRefunded = true
  }
  // Outside window — charge late-cancel fee if configured
  let lateCancelFeeCharged = false
  let lateCancelPaymentIntentId: string | null = null
  if (!withinWindow) {
    const lateCancelFeeCents = typeof settings.late_cancel_fee_cents === 'number'
      ? settings.late_cancel_fee_cents
      : 0

    if (lateCancelFeeCents > 0 && classInstance?.studio_id) {
      try {
        const connectedAccountId = await getConnectedAccountId(classInstance.studio_id)
        if (connectedAccountId) {
          const customer = await getOrCreateStripeCustomer(user.id, classInstance.studio_id, '')
          const pi = await createPaymentIntent({
            amount: lateCancelFeeCents,
            currency: 'usd',
            customerId: customer.id,
            connectedAccountId,
            metadata: {
              type: 'late_cancel_fee',
              booking_id: bookingId,
              studio_id: classInstance.studio_id,
            },
          })
          lateCancelFeeCharged = true
          lateCancelPaymentIntentId = pi.id
        }
      } catch {
        // Late-cancel fee is best-effort; don't block the cancellation
      }
    }
  }

  // ── 5. Trigger waitlist promotion ─────────────────────────────────────────
  if (classInstance?.id) {
    await promoteFromWaitlist(classInstance.id)
  }

  // ── 6. Return cancel iCal so client can cancel calendar event ────────────
  let cancelIcs: string | undefined
  if (classInstance && template && studio) {
    cancelIcs = buildBookingCalEvent(
      bookingId,
      {
        id: classInstance.id,
        name: template.name,
        date: classInstance.date,
        start_time: classInstance.start_time,
        duration_min: template.duration_min ?? 60,
        location: template.location,
        teacher_name: teacher?.name,
        studio_name: studio.name,
        studio_email: undefined,
        timezone: studio.timezone ?? 'UTC',
      },
      'CANCEL',
    )
  }

  return c.json({
    bookingId,
    status: 'cancelled',
    creditRefunded,
    withinCancellationWindow: withinWindow,
    lateCancelFeeCharged,
    lateCancelPaymentIntentId,
    ical: cancelIcs,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: Confirm attendance
// POST /api/bookings/:bookingId/confirm
// ─────────────────────────────────────────────────────────────────────────────

my.post('/bookings/:bookingId/confirm', authMiddleware, async (c) => {
  const bookingId = c.req.param('bookingId')
  const user      = c.get('user' as never) as { id: string }
  const supabase  = createServiceClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .single()

  if (!booking) throw notFound('Booking')
  if (booking.user_id !== user.id) throw forbidden('You can only confirm your own bookings')
  if (booking.status === 'cancelled') throw badRequest('Cannot confirm a cancelled booking')
  if (booking.status === 'waitlisted') throw badRequest('Cannot confirm a waitlisted booking')

  const now = new Date().toISOString()
  await supabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: now })
    .eq('id', bookingId)

  return c.json({ bookingId, status: 'confirmed', confirmedAt: now })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: Reminder cron endpoint
// POST /api/my/bookings/reminders
//
// Intended to be called by a scheduled function (cron job / Supabase Edge Function).
// Queries bookings where the class starts within the next reminder windows and
// returns the list of bookings that need a notification. Actual push delivery
// is handled by the notifications system (Plan 10).
// ─────────────────────────────────────────────────────────────────────────────

my.post('/my/bookings/reminders', async (c) => {
  // Simple shared-secret check for cron callers
  const authHeader = c.req.header('Authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createServiceClient()
  const now      = new Date()

  // Window: bookings starting 23h–25h from now (24h reminder)
  const window24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const window24hEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // Window: bookings starting 1h45m–2h15m from now (2h reminder)
  const window2hStart  = new Date(now.getTime() + 1 * 60 * 60 * 1000 + 45 * 60 * 1000)
  const window2hEnd    = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000)

  const toISO = (d: Date) => d.toISOString()

  // Fetch bookings in both windows in one query by combining conditions.
  // (Two separate queries for clarity, then merge.)
  const [res24h, res2h] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        id, user_id, status,
        class_instance:class_instances(id, date, start_time,
          studio:studios(name, timezone),
          template:class_templates(name)
        )
      `)
      .in('status', ['booked', 'confirmed'])
      .gte('class_instances.date', toISO(window24hStart).split('T')[0])
      .lte('class_instances.date', toISO(window24hEnd).split('T')[0]),

    supabase
      .from('bookings')
      .select(`
        id, user_id, status,
        class_instance:class_instances(id, date, start_time,
          studio:studios(name, timezone),
          template:class_templates(name)
        )
      `)
      .in('status', ['booked', 'confirmed'])
      .gte('class_instances.date', toISO(window2hStart).split('T')[0])
      .lte('class_instances.date', toISO(window2hEnd).split('T')[0]),
  ])

  // Send notifications for each booking in the reminder windows
  let sent24h = 0
  let sent2h = 0

  for (const booking of res24h.data ?? []) {
    const ci = Array.isArray(booking.class_instance) ? booking.class_instance[0] : booking.class_instance
    const studio = ci ? (Array.isArray(ci.studio) ? ci.studio[0] : ci.studio) : null
    const template = ci ? (Array.isArray(ci.template) ? ci.template[0] : ci.template) : null
    if (!ci || !studio) continue

    try {
      await sendNotification({
        userId: booking.user_id,
        studioId: ci.id,
        type: 'class_reminder_24h',
        title: 'Still coming tomorrow?',
        body: `${template?.name ?? 'Your class'} at ${studio.name} is tomorrow at ${ci.start_time}`,
        data: { classInstanceId: ci.id, screen: 'ClassDetail' },
        channels: ['push', 'in_app'],
      })
      sent24h++
    } catch {
      // Continue sending other reminders even if one fails
    }
  }

  for (const booking of res2h.data ?? []) {
    const ci = Array.isArray(booking.class_instance) ? booking.class_instance[0] : booking.class_instance
    const studio = ci ? (Array.isArray(ci.studio) ? ci.studio[0] : ci.studio) : null
    const template = ci ? (Array.isArray(ci.template) ? ci.template[0] : ci.template) : null
    if (!ci || !studio) continue

    try {
      await sendNotification({
        userId: booking.user_id,
        studioId: ci.id,
        type: 'class_reminder_2h',
        title: 'Class starts in 2 hours!',
        body: `${template?.name ?? 'Your class'} at ${studio.name} starts at ${ci.start_time}`,
        data: { classInstanceId: ci.id, screen: 'ClassDetail' },
        channels: ['push', 'in_app'],
      })
      sent2h++
    } catch {
      // Continue sending other reminders even if one fails
    }
  }

  return c.json({
    reminders24h: (res24h.data ?? []).length,
    reminders2h:  (res2h.data ?? []).length,
    sent24h,
    sent2h,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 6: My upcoming bookings
// GET /api/my/bookings
// ─────────────────────────────────────────────────────────────────────────────

my.get('/my/bookings', authMiddleware, async (c) => {
  const user     = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()
  const now      = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const { data: bookingList, error } = await supabase
    .from('bookings')
    .select(`
      id, status, waitlist_position, booked_at, confirmed_at,
      class_instance:class_instances(
        id, date, start_time,
        template:class_templates(name, duration_min),
        teacher:users!class_instances_teacher_id_fkey(name, avatar_url),
        studio:studios(id, name, slug, timezone)
      )
    `)
    .eq('user_id', user.id)
    .in('status', ['booked', 'confirmed', 'waitlisted'])
    .order('booked_at', { ascending: true })

  if (error) throw new Error(error.message)

  // Filter to future classes only and enrich with cancel deadline
  const upcoming = (bookingList ?? [])
    .map((b) => {
      const ci       = Array.isArray(b.class_instance) ? b.class_instance[0] : b.class_instance
      const template = Array.isArray(ci?.template) ? ci.template[0] : ci?.template
      const teacher  = Array.isArray(ci?.teacher)  ? ci.teacher[0]  : ci?.teacher
      const studio   = Array.isArray(ci?.studio)   ? ci.studio[0]   : ci?.studio

      if (!ci || ci.date < now) return null

      // Derive cancel deadline from studio settings (default 12h window)
      const classDateTime    = new Date(`${ci.date}T${ci.start_time}`)
      const cancelDeadline   = new Date(classDateTime.getTime() - 12 * 60 * 60 * 1000)

      return {
        bookingId:        b.id,
        status:           b.status,
        waitlistPosition: b.waitlist_position,
        bookedAt:         b.booked_at,
        confirmedAt:      b.confirmed_at,
        cancelDeadline:   cancelDeadline.toISOString(),
        class: {
          id:          ci.id,
          name:        template?.name,
          date:        ci.date,
          startTime:   ci.start_time,
          durationMin: template?.duration_min,
          teacher:     teacher ? { name: teacher.name, avatarUrl: teacher.avatar_url } : null,
          studio:      studio  ? { id: studio.id, name: studio.name, slug: studio.slug, timezone: studio.timezone } : null,
        },
      }
    })
    .filter(Boolean)

  return c.json({ bookings: upcoming })
})

export { my }
export default my
