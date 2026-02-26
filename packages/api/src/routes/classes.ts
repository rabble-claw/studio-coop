import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireMember } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest, conflict } from '../lib/errors'
import { createPaymentIntent } from '../lib/stripe'
import { getOrCreateStripeCustomer, getConnectedAccountId } from '../lib/payments'

// Mounted at /api/studios — handles /:studioId/classes/*
const classes = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: Drop-in purchase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /:studioId/classes/:classId/drop-in
 *
 * Flow:
 * 1. Check the class exists and has capacity
 * 2. Check the user has no existing booking for this class
 * 3. Look up the studio's drop-in plan for pricing
 * 4. Create a Stripe PaymentIntent
 * 5. Return client_secret — front-end completes payment, webhook creates booking + payment
 */
classes.post('/:studioId/classes/:classId/drop-in', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const classId = c.req.param('classId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  // Fetch class instance
  const { data: classInstance } = await supabase
    .from('class_instances')
    .select('id, studio_id, max_capacity, booked_count, status, date, start_time')
    .eq('id', classId)
    .eq('studio_id', studioId)
    .single()

  if (!classInstance) throw notFound('Class')
  if (classInstance.status !== 'scheduled') throw badRequest('Class is not available for booking')

  // Capacity check
  const spotsLeft = classInstance.max_capacity - (classInstance.booked_count ?? 0)
  if (spotsLeft <= 0) throw badRequest('Class is full — no spots available')

  // Check user hasn't already booked this class
  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', user.id)
    .eq('class_instance_id', classId)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existingBooking) throw conflict('You already have a booking for this class')

  // Find the drop-in plan for this studio
  const { data: dropInPlan } = await supabase
    .from('membership_plans')
    .select('id, price_cents, currency')
    .eq('studio_id', studioId)
    .eq('type', 'drop_in')
    .eq('active', true)
    .order('sort_order')
    .limit(1)
    .single()

  if (!dropInPlan) throw badRequest('Studio does not have a drop-in plan configured')

  // Create Stripe PaymentIntent
  const connectedAccountId = await getConnectedAccountId(studioId)
  const customer = await getOrCreateStripeCustomer(user.id, studioId, user.email)

  const paymentIntent = await createPaymentIntent({
    amount: dropInPlan.price_cents,
    currency: dropInPlan.currency,
    customerId: customer.id,
    connectedAccountId,
    metadata: {
      userId: user.id,
      studioId,
      classId,
      planId: dropInPlan.id,
      type: 'drop_in',
    },
  })

  return c.json({
    clientSecret: paymentIntent.client_secret,
    amount: dropInPlan.price_cents,
    currency: dropInPlan.currency,
  })
})

export { classes }
export default classes
