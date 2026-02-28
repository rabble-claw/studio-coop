import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, requireMember, requireOwner } from '../middleware/studio-access'
import { generateClassInstances } from '../lib/class-generator'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'
import { sendNotification } from '../lib/notifications'

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

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: One-off class creation
// POST /api/studios/:studioId/classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a one-off class instance without a template.
 * Used for workshops, special events, makeup classes.
 *
 * Since class_instances has no name/description columns, we create a minimal
 * class_template (recurrence='once', active=false) and link the instance to it.
 * This keeps the data model consistent while supporting ad-hoc classes.
 */
schedule.post('/:studioId/classes', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  // Required fields
  const name = body.name as string | undefined
  const date = body.date as string | undefined
  const startTime = (body.start_time ?? body.startTime) as string | undefined
  const durationMin = Number(body.duration_min ?? body.durationMin)

  if (!name) throw badRequest('name is required')
  if (!date) throw badRequest('date is required')
  if (!startTime) throw badRequest('start_time is required')
  if (!durationMin || durationMin <= 0) throw badRequest('duration_min must be a positive number')

  // Create a one-off template (active=false so the generator ignores it)
  const { data: template, error: tplError } = await supabase
    .from('class_templates')
    .insert({
      studio_id: studioId,
      name,
      description: body.description as string | undefined,
      teacher_id: body.teacher_id as string | undefined,
      day_of_week: new Date(date).getUTCDay(),
      start_time: startTime,
      duration_min: durationMin,
      max_capacity: body.capacity ?? body.max_capacity,
      recurrence: 'once',
      active: false,
    })
    .select('id')
    .single()

  if (tplError) throw tplError

  // Calculate end_time
  const [h, m] = startTime.split(':').map(Number)
  const totalMin = h * 60 + m + durationMin
  const endH = Math.floor(totalMin / 60) % 24
  const endM = totalMin % 60
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`

  const { data: instance, error: instError } = await supabase
    .from('class_instances')
    .insert({
      template_id: template.id,
      studio_id: studioId,
      teacher_id: body.teacher_id as string | undefined,
      date,
      start_time: startTime,
      end_time: endTime,
      status: 'scheduled',
      max_capacity: body.capacity ?? body.max_capacity,
      notes: body.notes as string | undefined,
      feed_enabled: body.feed_enabled !== false,
    })
    .select('*')
    .single()

  if (instError) throw instError

  return c.json(instance, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 5: Schedule view API
// GET /api/studios/:studioId/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns class instances for a date range with template info, teacher info,
 * booking count vs capacity, and status.
 *
 * Query params:
 *   from        ISO date (required)
 *   to          ISO date (required)
 *   teacher     UUID — filter by teacher
 *   template    UUID — filter by template
 *   day         Comma-separated weekday numbers (0-6) — filter by day of week
 */
schedule.get('/:studioId/schedule', authMiddleware, requireMember, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const from = c.req.query('from')
  const to = c.req.query('to')

  if (!from) throw badRequest('from date is required')
  if (!to) throw badRequest('to date is required')

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw badRequest('Dates must be in YYYY-MM-DD format')
  }

  if (from > to) throw badRequest('from must be before to')

  const teacherFilter = c.req.query('teacher')
  const templateFilter = c.req.query('template')
  const dayFilter = c.req.query('day')

  // Build query with joins for template and teacher info, and booking count
  let query = supabase
    .from('class_instances')
    .select(`
      id,
      date,
      start_time,
      end_time,
      status,
      max_capacity,
      notes,
      feed_enabled,
      template:class_templates(id, name, description, recurrence),
      teacher:users(id, name, avatar_url),
      bookings:bookings(count)
    `)
    .eq('studio_id', studioId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (teacherFilter) query = query.eq('teacher_id', teacherFilter)
  if (templateFilter) query = query.eq('template_id', templateFilter)

  const { data: instances, error } = await query

  if (error) throw error

  // Apply day-of-week filter in memory (Supabase doesn't expose DOW extraction easily)
  let results = instances ?? []
  if (dayFilter) {
    const targetDays = dayFilter
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => d >= 0 && d <= 6)

    if (targetDays.length > 0) {
      results = results.filter((inst) => {
        const dow = new Date(inst.date + 'T00:00:00Z').getUTCDay()
        return targetDays.includes(dow)
      })
    }
  }

  // Normalize booking count from PostgREST array format [{ count: N }] → number
  const normalized = results.map((inst) => {
    const bookingCount = Array.isArray(inst.bookings)
      ? (inst.bookings[0] as any)?.count ?? 0
      : 0
    return {
      ...inst,
      bookings: undefined,
      booking_count: Number(bookingCount),
    }
  })

  return c.json(normalized)
})

// ─────────────────────────────────────────────────────────────────────────────
// Restore a cancelled class
// POST /api/studios/:studioId/classes/:classId/restore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restore a cancelled class instance back to 'scheduled'.
 * Sends notifications to all previously booked members.
 */
schedule.post('/:studioId/classes/:classId/restore', authMiddleware, requireAdmin, async (c) => {
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
  if (existing.status !== 'cancelled') throw badRequest('Only cancelled classes can be restored')

  // Restore to scheduled
  const { data: updated, error } = await supabase
    .from('class_instances')
    .update({ status: 'scheduled' })
    .eq('id', classId)
    .select('*')
    .single()

  if (error) throw error

  // Notify all previously booked members that the class is back on
  const { data: bookings } = await supabase
    .from('bookings')
    .select('user_id, status')
    .eq('class_instance_id', classId)
    .in('status', ['booked', 'confirmed', 'cancelled'])

  if (bookings && bookings.length > 0) {
    const notifications = bookings.map((b) => ({
      user_id: b.user_id,
      studio_id: studioId,
      type: 'class_restored',
      title: 'Class Restored',
      body: 'A previously cancelled class has been restored to the schedule.',
      data: { classInstanceId: classId },
    }))

    await supabase.from('notifications').insert(notifications)

    // Also send push notifications
    for (const b of bookings) {
      sendNotification({
        userId: b.user_id,
        studioId,
        type: 'class_restored',
        title: 'Class Restored',
        body: 'A previously cancelled class has been restored to the schedule.',
        data: { classInstanceId: classId, screen: 'ClassDetail' },
        channels: ['push'],
      }).catch(() => {})
    }
  }

  return c.json(updated)
})

export { schedule }
export default schedule
