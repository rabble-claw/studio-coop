import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, requireOwner } from '../middleware/studio-access'
import { generateClassInstances } from '../lib/class-generator'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'

// Mounted at /api/studios and /api/admin — handles generation, modification, schedule view
const schedule = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 2a: Platform admin trigger
// POST /api/admin/generate-classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-level trigger — generates instances for a specific studio.
 * Protected by PLATFORM_ADMIN_KEY environment variable (Bearer token).
 */
schedule.post('/api/admin/generate-classes', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const adminKey = process.env.PLATFORM_ADMIN_KEY

  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    throw forbidden('Invalid platform admin key')
  }

  const body = await c.req.json().catch(() => ({}))
  const studioId: string | undefined = (body as any).studioId
  const weeksAhead: number = Number((body as any).weeksAhead) || 4

  if (!studioId) throw badRequest('studioId is required')

  const count = await generateClassInstances(studioId, weeksAhead)
  return c.json({ generated: count, studioId })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2b: Studio owner manual trigger
// POST /api/studios/:studioId/generate-classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Studio owner manual trigger — generates class instances for their studio.
 */
schedule.post('/:studioId/generate-classes', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const body = await c.req.json().catch(() => ({}))
  const weeksAhead: number = Number((body as any).weeksAhead) || 4

  const count = await generateClassInstances(studioId, weeksAhead)
  return c.json({ generated: count, studioId })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 3: Instance modification
// PUT /api/studios/:studioId/classes/:classId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modify an individual class instance.
 *
 * Owners/admins can change: teacher, capacity, start_time, notes, status.
 * When status is set to 'cancelled', a notification is inserted for every
 * booked member so they are informed.
 */
schedule.put('/:studioId/classes/:classId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const classId = c.req.param('classId')
  const supabase = createServiceClient()

  // Verify the class instance exists and belongs to this studio
  const { data: existing } = await supabase
    .from('class_instances')
    .select('id, studio_id, status')
    .eq('id', classId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Class instance')

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  // Build update payload — only include allowed fields that were provided
  const updates: Record<string, unknown> = {}
  if (body.teacher_id !== undefined) updates.teacher_id = body.teacher_id
  if (body.max_capacity !== undefined) updates.max_capacity = body.max_capacity
  if (body.start_time !== undefined) updates.start_time = body.start_time
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.status !== undefined) {
    const allowed = ['scheduled', 'in_progress', 'completed', 'cancelled']
    if (!allowed.includes(body.status as string)) {
      throw badRequest(`Invalid status. Must be one of: ${allowed.join(', ')}`)
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest('No valid fields to update')
  }

  const { data: updated, error } = await supabase
    .from('class_instances')
    .update(updates)
    .eq('id', classId)
    .select('*')
    .single()

  if (error) throw error

  // When cancelling — notify all booked members
  if (updates.status === 'cancelled') {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('user_id')
      .eq('class_instance_id', classId)
      .neq('status', 'cancelled')

    if (bookings && bookings.length > 0) {
      const notifications = bookings.map((b) => ({
        user_id: b.user_id,
        studio_id: studioId,
        type: 'class_cancelled',
        title: 'Class Cancelled',
        body: body.notes
          ? `Class cancelled: ${body.notes}`
          : 'A class you booked has been cancelled.',
        data: { classInstanceId: classId },
      }))

      await supabase.from('notifications').insert(notifications)
    }
  }

  return c.json(updated)
})

export { schedule }
export default schedule
