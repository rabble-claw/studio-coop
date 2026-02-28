// Private bookings CRUD — studio-scoped (mounted at /api/studios)
//
// DB schema: private_bookings has user_id (NOT NULL), studio_id, type (party|private_tuition|group),
// title, description, notes, date, start_time, end_time, attendee_count, price_cents, deposit_cents,
// deposit_paid, status (requested|confirmed|completed|cancelled)
//
//   GET    /:studioId/private-bookings          — list all (staff only)
//   POST   /:studioId/private-bookings          — create (staff only)
//   PUT    /:studioId/private-bookings/:id      — update status/notes (staff only)
//   DELETE /:studioId/private-bookings/:id      — cancel (staff only)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest } from '../lib/errors'
import { createPaymentIntent } from '../lib/stripe'
import { getConnectedAccountId, getOrCreateStripeCustomer } from '../lib/payments'

const privateBookings = new Hono()

const VALID_TYPES = ['party', 'private_tuition', 'group']
const VALID_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled']

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/private-bookings — list all (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.get('/:studioId/private-bookings', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()
  const status = c.req.query('status')

  let query = supabase
    .from('private_bookings')
    .select('*, user:users!private_bookings_user_id_fkey(name, email)')
    .eq('studio_id', studioId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (status && VALID_STATUSES.includes(status)) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Map to frontend-friendly format
  const bookings = (data ?? []).map(b => {
    const user = b.user as unknown as { name: string; email: string } | null
    return {
      id: b.id,
      client_name: user?.name ?? b.title,
      client_email: user?.email ?? '',
      type: b.type,
      title: b.title,
      description: b.description,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      attendee_count: b.attendee_count,
      status: b.status === 'requested' ? 'pending' : b.status, // Map for frontend compatibility
      price_cents: b.price_cents ?? 0,
      deposit_cents: b.deposit_cents ?? 0,
      deposit_paid: b.deposit_paid,
      notes: b.notes,
      created_at: b.created_at,
    }
  })

  return c.json({ bookings })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/private-bookings — create (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.post('/:studioId/private-bookings', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const title = (body.client_name as string) ?? (body.title as string)
  const clientEmail = (body.client_email as string)?.toLowerCase().trim()
  const type = body.type as string | undefined
  const date = body.date as string | undefined
  const startTime = body.start_time as string | undefined
  const endTime = body.end_time as string | undefined
  const priceCents = body.price_cents as number | undefined
  const notes = body.notes as string | undefined
  const description = body.description as string | undefined
  const attendeeCount = body.attendee_count as number | undefined

  if (!title) throw badRequest('title or client_name is required')
  if (!date) throw badRequest('date is required')
  if (!startTime) throw badRequest('start_time is required')
  if (!endTime) throw badRequest('end_time is required')

  // Map frontend type to DB type
  let dbType = 'private_tuition'
  if (type) {
    const typeLower = type.toLowerCase()
    if (VALID_TYPES.includes(typeLower)) dbType = typeLower
    else if (typeLower.includes('party') || typeLower.includes('event')) dbType = 'party'
    else if (typeLower.includes('group') || typeLower.includes('corporate')) dbType = 'group'
  }

  // If client_email is provided, try to look up the user to link the booking
  let bookingUserId = user.id // default to staff user
  if (clientEmail) {
    const { data: clientUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', clientEmail)
      .maybeSingle()
    if (clientUser) bookingUserId = clientUser.id
  }

  const { data: booking, error } = await supabase
    .from('private_bookings')
    .insert({
      studio_id: studioId,
      user_id: bookingUserId,
      type: dbType,
      title,
      description: description ?? (clientEmail ? `Contact: ${clientEmail}` : ''),
      notes: notes ?? null,
      date,
      start_time: startTime,
      end_time: endTime,
      attendee_count: attendeeCount ?? null,
      price_cents: priceCents ?? 0,
      deposit_paid: false,
      status: 'requested',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create booking: ${error.message}`)

  return c.json({
    booking: {
      ...booking,
      client_name: title,
      client_email: body.client_email ?? '',
      status: 'pending', // Map for frontend
    },
  }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/private-bookings/:id — update (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.put('/:studioId/private-bookings/:id', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const bookingId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('private_bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Private booking')

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const updates: Record<string, unknown> = {}

  // Map frontend status to DB status
  if (typeof body.status === 'string') {
    const statusMap: Record<string, string> = { pending: 'requested', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled' }
    updates.status = statusMap[body.status] ?? body.status
  }
  if (typeof body.notes === 'string') updates.notes = body.notes
  if (typeof body.deposit_paid === 'boolean') updates.deposit_paid = body.deposit_paid
  if (typeof body.title === 'string') updates.title = body.title
  if (typeof body.client_name === 'string') updates.title = body.client_name
  if (typeof body.description === 'string') updates.description = body.description
  if (typeof body.date === 'string') updates.date = body.date
  if (typeof body.start_time === 'string') updates.start_time = body.start_time
  if (typeof body.end_time === 'string') updates.end_time = body.end_time
  if (typeof body.price_cents === 'number') updates.price_cents = body.price_cents
  if (typeof body.attendee_count === 'number') updates.attendee_count = body.attendee_count

  if (Object.keys(updates).length === 0) {
    throw badRequest('No fields to update')
  }

  const { data: booking, error } = await supabase
    .from('private_bookings')
    .update(updates)
    .eq('id', bookingId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return c.json({
    booking: {
      ...booking,
      status: booking.status === 'requested' ? 'pending' : booking.status,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:studioId/private-bookings/:id — cancel (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.delete('/:studioId/private-bookings/:id', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const bookingId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('private_bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Private booking')

  const { error } = await supabase
    .from('private_bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)

  return c.json({ bookingId, cancelled: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/private-bookings/:id/restore — restore cancelled booking (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.post('/:studioId/private-bookings/:id/restore', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const bookingId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('private_bookings')
    .select('id, status')
    .eq('id', bookingId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Private booking')
  if (existing.status !== 'cancelled') throw badRequest('Only cancelled bookings can be restored')

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const restoreTo = (body.status as string) ?? 'requested'

  if (!['requested', 'confirmed'].includes(restoreTo)) {
    throw badRequest('Restore status must be requested or confirmed')
  }

  const { data: booking, error } = await supabase
    .from('private_bookings')
    .update({ status: restoreTo })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return c.json({
    booking: {
      ...booking,
      status: booking.status === 'requested' ? 'pending' : booking.status,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/private-bookings/:id/deposit — collect deposit (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.post('/:studioId/private-bookings/:id/deposit', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const bookingId = c.req.param('id')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: booking } = await supabase
    .from('private_bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('studio_id', studioId)
    .single()

  if (!booking) throw notFound('Private booking')
  if (booking.deposit_paid) throw badRequest('Deposit already paid')

  const depositAmount = booking.deposit_cents ?? 0
  if (depositAmount <= 0) throw badRequest('No deposit amount configured for this booking')

  // Look up the studio's currency
  const { data: studio } = await supabase
    .from('studios')
    .select('currency')
    .eq('id', studioId)
    .single()
  const currency = (studio?.currency ?? 'usd').toLowerCase()

  const connectedAccountId = await getConnectedAccountId(studioId)
  const customer = await getOrCreateStripeCustomer(booking.user_id, studioId, user.email)

  const paymentIntent = await createPaymentIntent({
    amount: depositAmount,
    currency,
    customerId: customer.id,
    connectedAccountId,
    metadata: {
      userId: booking.user_id,
      studioId,
      bookingId,
      type: 'private_booking_deposit',
    },
  })

  return c.json({
    clientSecret: paymentIntent.client_secret,
    amount: depositAmount,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/private-bookings/:id/balance — calculate balance due (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.get('/:studioId/private-bookings/:id/balance', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const bookingId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: booking } = await supabase
    .from('private_bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('studio_id', studioId)
    .single()

  if (!booking) throw notFound('Private booking')

  // Sum all payments associated with this booking
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_cents, type')
    .eq('studio_id', studioId)
    .eq('user_id', booking.user_id)
    .ilike('type', 'private_booking%')

  const totalPaid = (payments ?? []).reduce((sum: number, p: { amount_cents: number }) => sum + p.amount_cents, 0)
  const totalPrice = booking.price_cents ?? 0
  const balanceDue = Math.max(0, totalPrice - totalPaid)

  return c.json({
    totalPrice,
    depositPaid: totalPaid,
    balanceDue,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/private-bookings/:id/pay-balance — collect remaining balance (staff only)
// ─────────────────────────────────────────────────────────────────────────────

privateBookings.post('/:studioId/private-bookings/:id/pay-balance', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const bookingId = c.req.param('id')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const { data: booking } = await supabase
    .from('private_bookings')
    .select('*')
    .eq('id', bookingId)
    .eq('studio_id', studioId)
    .single()

  if (!booking) throw notFound('Private booking')

  // Calculate remaining balance
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_cents, type')
    .eq('studio_id', studioId)
    .eq('user_id', booking.user_id)
    .ilike('type', 'private_booking%')

  const totalPaid = (payments ?? []).reduce((sum: number, p: { amount_cents: number }) => sum + p.amount_cents, 0)
  const totalPrice = booking.price_cents ?? 0
  const balanceDue = Math.max(0, totalPrice - totalPaid)

  if (balanceDue <= 0) throw badRequest('No balance due — booking is fully paid')

  // Look up the studio's currency
  const { data: studio } = await supabase
    .from('studios')
    .select('currency')
    .eq('id', studioId)
    .single()
  const currency = (studio?.currency ?? 'usd').toLowerCase()

  const connectedAccountId = await getConnectedAccountId(studioId)
  const customer = await getOrCreateStripeCustomer(booking.user_id, studioId, user.email)

  const paymentIntent = await createPaymentIntent({
    amount: balanceDue,
    currency,
    customerId: customer.id,
    connectedAccountId,
    metadata: {
      userId: booking.user_id,
      studioId,
      bookingId,
      type: 'private_booking_balance',
    },
  })

  return c.json({
    clientSecret: paymentIntent.client_secret,
    amount: balanceDue,
  })
})

export { privateBookings }
export default privateBookings
