// Booking routes — studio-scoped.
//
// Mounted at /api/studios in index.ts so paths here are:
//   POST   /:studioId/classes/:classId/book           — Task 1: book a class
//   GET    /:studioId/classes/:classId/bookings       — Task 7: staff roster view
//   POST   /:studioId/classes/:classId/bookings       — Task 7: staff book a member
//   DELETE /:studioId/classes/:classId/bookings/:bookingId — Task 7: staff cancel

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireMember, requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest, conflict, forbidden } from '../lib/errors'
import { checkBookingCredits, deductCredit } from '../lib/credits'
import { addToWaitlist } from '../lib/waitlist'
import { buildBookingCalEvent } from '../lib/calendar'
import { sendNotification } from '../lib/notifications'

const bookings = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 1: Book a class
// POST /:studioId/classes/:classId/book
// ─────────────────────────────────────────────────────────────────────────────

bookings.post(
  '/:studioId/classes/:classId/book',
  authMiddleware,
  requireMember,
  async (c) => {
    const studioId  = c.req.param('studioId')
    const classId   = c.req.param('classId')
    const user      = c.get('user' as never) as { id: string; email: string }
    const supabase  = createServiceClient()

    // ── 1. Fetch class instance ───────────────────────────────────────────────
    const { data: cls } = await supabase
      .from('class_instances')
      .select(`
        id, studio_id, status, max_capacity, date, start_time,
        template:class_templates(name, location, duration_min),
        teacher:users!class_instances_teacher_id_fkey(name),
        studio:studios(name, timezone, settings)
      `)
      .eq('id', classId)
      .eq('studio_id', studioId)
      .single()

    if (!cls) throw notFound('Class')
    if (cls.status !== 'scheduled') throw badRequest('Class is not available for booking')

    const template = Array.isArray(cls.template) ? cls.template[0] : cls.template
    const teacher  = Array.isArray(cls.teacher)  ? cls.teacher[0]  : cls.teacher
    const studio   = Array.isArray(cls.studio)   ? cls.studio[0]   : cls.studio

    // ── 2. Membership check already done by requireMember middleware ───────────

    // ── 3. Check for existing booking ─────────────────────────────────────────
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('class_instance_id', classId)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .maybeSingle()

    if (existingBooking) {
      if (existingBooking.status === 'waitlisted') {
        throw conflict('You are already on the waitlist for this class')
      }
      throw conflict('You already have a booking for this class')
    }

    // ── 4. Pre-check capacity (non-authoritative, avoids unnecessary credit ops)
    const { count: activeCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('class_instance_id', classId)
      .in('status', ['booked', 'confirmed'])

    const spotsLeft = cls.max_capacity - (activeCount ?? 0)

    // ── 5. Class full → waitlist ───────────────────────────────────────────────
    if (spotsLeft <= 0) {
      const { waitlist_position, bookingId } = await addToWaitlist(classId, user.id)
      return c.json({
        status: 'waitlisted',
        waitlist_position,
        bookingId,
        message: `Class is full. You are #${waitlist_position} on the waitlist.`,
      }, 202)
    }

    // ── 6. Check credits ───────────────────────────────────────────────────────
    const creditCheck = await checkBookingCredits(user.id, studioId)

    if (!creditCheck.hasCredits) {
      throw badRequest('No credits available — please purchase a plan or drop-in pass', {
        code: 'NO_CREDITS',
        redirectTo: `/studios/${studioId}/plans`,
      })
    }

    // ── 7. Deduct credit and create booking ───────────────────────────────────
    await deductCredit(creditCheck)

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        class_instance_id: classId,
        user_id: user.id,
        status: 'booked',
        credit_source: creditCheck.source,
        credit_source_id: creditCheck.sourceId ?? null,
        booked_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !booking) {
      if (insertError?.code === '23505') {
        throw conflict('You already have a booking for this class')
      }
      throw new Error(`Booking insert failed: ${insertError?.message}`)
    }

    // ── 7b. Post-insert capacity check to guard against race conditions ──────
    // Re-count after insert: if concurrent requests overbooked, roll back this one.
    const { count: postInsertCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('class_instance_id', classId)
      .in('status', ['booked', 'confirmed'])

    if ((postInsertCount ?? 0) > cls.max_capacity) {
      // Over capacity — remove this booking and put the user on the waitlist instead
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', booking.id)

      // Best-effort credit refund
      const { refundCredit } = await import('../lib/credits')
      await refundCredit(creditCheck).catch(() => {})

      const { waitlist_position, bookingId: wlBookingId } = await addToWaitlist(classId, user.id)
      return c.json({
        status: 'waitlisted',
        waitlist_position,
        bookingId: wlBookingId,
        message: `Class is full. You are #${waitlist_position} on the waitlist.`,
      }, 202)
    }

    // ── 9. Generate iCal invite ────────────────────────────────────────────────
    const ics = buildBookingCalEvent(booking.id, {
      id: classId,
      name: template?.name ?? 'Class',
      date: cls.date,
      start_time: cls.start_time,
      duration_min: template?.duration_min ?? 60,
      location: template?.location,
      teacher_name: teacher?.name,
      studio_name: studio?.name,
      studio_email: undefined,
      timezone: studio?.timezone ?? 'UTC',
    })

    // ── 10. Send booking confirmation notification ─────────────────────────────
    sendNotification({
      userId: user.id,
      studioId,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      body: `You're booked for ${template?.name ?? 'class'} on ${cls.date}`,
      data: { classId, bookingId: booking.id, screen: 'BookingDetail' },
      channels: ['push', 'in_app'],
    }).catch(() => {}) // fire-and-forget — don't block the booking response

    return c.json({
      status: 'booked',
      bookingId: booking.id,
      creditSource: creditCheck.source,
      remainingCredits: creditCheck.remainingAfter,
      ical: ics,
    }, 201)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Task 7: Staff view — list all bookings for a class
// GET /:studioId/classes/:classId/bookings
// ─────────────────────────────────────────────────────────────────────────────

bookings.get(
  '/:studioId/classes/:classId/bookings',
  authMiddleware,
  requireStaff,
  async (c) => {
    const classId  = c.req.param('classId')
    const studioId = c.req.param('studioId')
    const supabase = createServiceClient()

    // Verify class belongs to studio
    const { data: cls } = await supabase
      .from('class_instances')
      .select('id, max_capacity')
      .eq('id', classId)
      .eq('studio_id', studioId)
      .single()

    if (!cls) throw notFound('Class')

    const { data: bookingList, error } = await supabase
      .from('bookings')
      .select(`
        id, status, spot, waitlist_position, booked_at, confirmed_at, cancelled_at,
        member:users!bookings_user_id_fkey(id, name, avatar_url, email)
      `)
      .eq('class_instance_id', classId)
      .order('waitlist_position', { ascending: true, nullsFirst: false })
      .order('booked_at', { ascending: true })

    if (error) throw new Error(error.message)

    const active    = (bookingList ?? []).filter(b => b.status !== 'cancelled' && b.status !== 'no_show')
    const cancelled = (bookingList ?? []).filter(b => b.status === 'cancelled' || b.status === 'no_show')

    return c.json({
      classId,
      maxCapacity: cls.max_capacity,
      booked:    active.filter(b => b.status !== 'waitlisted'),
      waitlist:  active.filter(b => b.status === 'waitlisted'),
      cancelled,
    })
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Task 7: Staff book — add a member to a class bypassing credit check
// POST /:studioId/classes/:classId/bookings
// Body: { userId: string }
// ─────────────────────────────────────────────────────────────────────────────

bookings.post(
  '/:studioId/classes/:classId/bookings',
  authMiddleware,
  requireStaff,
  async (c) => {
    const classId  = c.req.param('classId')
    const studioId = c.req.param('studioId')
    const supabase = createServiceClient()

    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
    const targetUserId = body.userId as string | undefined

    if (!targetUserId) throw badRequest('userId is required')

    // Verify class belongs to studio and is schedulable
    const { data: cls } = await supabase
      .from('class_instances')
      .select('id, status, max_capacity')
      .eq('id', classId)
      .eq('studio_id', studioId)
      .single()

    if (!cls) throw notFound('Class')
    if (cls.status !== 'scheduled') throw badRequest('Class is not available for booking')

    // Verify target user is a member of this studio
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', targetUserId)
      .eq('studio_id', studioId)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) throw forbidden('User is not a member of this studio')

    // Check for existing booking
    const { data: existing } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('user_id', targetUserId)
      .eq('class_instance_id', classId)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .maybeSingle()

    if (existing) throw conflict('Member already has a booking for this class')

    // Staff bypass — no credit check, no capacity limit enforced
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        class_instance_id: classId,
        user_id: targetUserId,
        status: 'booked',
        booked_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !booking) {
      if (error?.code === '23505') throw conflict('Member already has a booking for this class')
      throw new Error(`Staff booking failed: ${error?.message}`)
    }

    return c.json({ bookingId: booking.id, status: 'booked' }, 201)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// Task 7: Staff cancel — cancel any booking for a class
// DELETE /:studioId/classes/:classId/bookings/:bookingId
// ─────────────────────────────────────────────────────────────────────────────

bookings.delete(
  '/:studioId/classes/:classId/bookings/:bookingId',
  authMiddleware,
  requireStaff,
  async (c) => {
    const classId   = c.req.param('classId')
    const studioId  = c.req.param('studioId')
    const bookingId = c.req.param('bookingId')
    const supabase  = createServiceClient()

    // Fetch booking — verify it belongs to this class/studio
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, user_id, status, credit_source, credit_source_id, class_instance_id')
      .eq('id', bookingId)
      .eq('class_instance_id', classId)
      .single()

    if (!booking) throw notFound('Booking')
    if (booking.status === 'cancelled') throw badRequest('Booking is already cancelled')

    // Verify the class belongs to this studio
    const { data: cls } = await supabase
      .from('class_instances')
      .select('id')
      .eq('id', classId)
      .eq('studio_id', studioId)
      .single()

    if (!cls) throw forbidden('Class does not belong to this studio')

    // Mark cancelled
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId)

    // Refund credit if it was credit-backed (staff cancel is always a full refund)
    if (booking.credit_source && booking.credit_source !== 'none') {
      const { refundCredit } = await import('../lib/credits')
      await refundCredit({
        hasCredits: true,
        source: booking.credit_source as any,
        sourceId: booking.credit_source_id ?? undefined,
      })
    }

    // Notify the user their booking was cancelled
    sendNotification({
      userId: booking.user_id,
      studioId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      body: 'Your booking has been cancelled by staff.',
      data: { classId, bookingId, screen: 'BookingDetail' },
      channels: ['push', 'in_app'],
    }).catch(() => {}) // fire-and-forget

    // Trigger waitlist promotion
    const { promoteFromWaitlist } = await import('../lib/waitlist')
    await promoteFromWaitlist(classId)

    return c.json({ bookingId, status: 'cancelled' })
  },
)

export { bookings }
export default bookings
