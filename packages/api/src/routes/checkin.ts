import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'
import { checkAndCreateMilestones } from '../lib/milestones'

// Mounted at /api/classes — handles roster, batch check-in, walk-in, complete
const checkin = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Helper: verify class exists and authenticated user is staff for that studio
// ─────────────────────────────────────────────────────────────────────────────

async function getClassAndVerifyStaff(classId: string, userId: string) {
  const supabase = createServiceClient()

  const { data: cls } = await supabase
    .from('class_instances')
    .select('id, studio_id, status, max_capacity')
    .eq('id', classId)
    .single()

  if (!cls) throw notFound('Class instance')

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('studio_id', cls.studio_id)
    .eq('status', 'active')
    .single()

  if (!membership) throw forbidden('Not a member of this studio')

  const staffRoles = ['teacher', 'admin', 'owner']
  if (!staffRoles.includes(membership.role)) {
    throw forbidden('Staff access required')
  }

  return cls
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 1a: Roster (photo grid data)
// GET /api/classes/:classId/roster
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns roster data for the check-in photo grid.
 * Each entry has user info, booking status, attendance status, and staff notes.
 * Walk-ins who don't have bookings are appended at the end.
 */
checkin.get('/:classId/roster', authMiddleware, async (c) => {
  const classId = c.req.param('classId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const cls = await getClassAndVerifyStaff(classId, user.id)

  // Fetch active bookings with user info
  const [{ data: bookings }, { data: attendanceRecords }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, status, spot, user:users!bookings_user_id_fkey(id, name, avatar_url)')
      .eq('class_instance_id', classId)
      .in('status', ['booked', 'confirmed', 'waitlisted'])
      .order('booked_at'),
    supabase
      .from('attendance')
      .select('user_id, checked_in, walk_in')
      .eq('class_instance_id', classId),
  ])

  const attendanceByUser = new Map(
    (attendanceRecords ?? []).map((a) => [a.user_id, a]),
  )

  // Fetch membership notes for all booked users
  const bookedUserIds = (bookings ?? []).map((b) => (b.user as any).id)
  const membershipNotes = new Map<string, string | null>()

  if (bookedUserIds.length > 0) {
    const { data: memberships } = await supabase
      .from('memberships')
      .select('user_id, notes')
      .eq('studio_id', cls.studio_id)
      .in('user_id', bookedUserIds)

    for (const m of memberships ?? []) {
      membershipNotes.set(m.user_id, m.notes ?? null)
    }
  }

  // Build roster entries from bookings
  const bookedUserIdSet = new Set(bookedUserIds)
  const roster: Array<{
    user: { id: string; name: string; avatar_url: string | null }
    booking: { id: string; status: string; spot: string | null } | null
    attendance: { checked_in: boolean; walk_in: boolean }
    membership_notes: string | null
  }> = (bookings ?? []).map((b) => {
    const u = b.user as any
    const att = attendanceByUser.get(u.id)
    return {
      user: { id: u.id, name: u.name, avatar_url: u.avatar_url ?? null },
      booking: { id: b.id, status: b.status, spot: b.spot ?? null },
      attendance: { checked_in: att?.checked_in ?? false, walk_in: att?.walk_in ?? false },
      membership_notes: membershipNotes.get(u.id) ?? null,
    }
  })

  // Append walk-ins who have no booking
  const walkInOnly = (attendanceRecords ?? []).filter(
    (a) => a.walk_in && !bookedUserIdSet.has(a.user_id),
  )

  if (walkInOnly.length > 0) {
    const walkInUserIds = walkInOnly.map((a) => a.user_id)
    const { data: walkInUsers } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', walkInUserIds)

    const userMap = new Map((walkInUsers ?? []).map((u) => [u.id, u]))
    for (const a of walkInOnly) {
      const u = userMap.get(a.user_id)
      if (u) {
        roster.push({
          user: { id: u.id, name: u.name, avatar_url: u.avatar_url ?? null },
          booking: null,
          attendance: { checked_in: true, walk_in: true },
          membership_notes: null,
        })
      }
    }
  }

  return c.json(roster)
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 1b: Batch check-in
// POST /api/classes/:classId/checkin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Batch check-in endpoint. Upserts attendance records for multiple attendees.
 * Transitions class status to in_progress on first check-in.
 */
checkin.post('/:classId/checkin', authMiddleware, async (c) => {
  const classId = c.req.param('classId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const cls = await getClassAndVerifyStaff(classId, user.id)

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const attendees = body.attendees as Array<{ userId: string; checkedIn: boolean; walkIn?: boolean }> | undefined

  if (!Array.isArray(attendees) || attendees.length === 0) {
    throw badRequest('attendees must be a non-empty array')
  }

  // Validate each entry has required fields
  for (const entry of attendees) {
    if (!entry.userId || typeof entry.checkedIn !== 'boolean') {
      throw badRequest('Each attendee must have userId and checkedIn (boolean)')
    }
  }

  const now = new Date().toISOString()

  // Fetch existing attendance records for these users in one query
  const userIds = attendees.map((a) => a.userId)
  const { data: existingRecords } = await supabase
    .from('attendance')
    .select('id, user_id')
    .eq('class_instance_id', classId)
    .in('user_id', userIds)

  const existingByUser = new Map(
    (existingRecords ?? []).map((r) => [r.user_id, r.id]),
  )

  // Upsert attendance records
  for (const entry of attendees) {
    const existingId = existingByUser.get(entry.userId)
    const payload = {
      checked_in: entry.checkedIn,
      walk_in: entry.walkIn ?? false,
      checked_in_at: entry.checkedIn ? now : null,
      checked_in_by: entry.checkedIn ? user.id : null,
    }

    if (existingId) {
      await supabase.from('attendance').update(payload).eq('id', existingId)
    } else {
      await supabase.from('attendance').insert({
        class_instance_id: classId,
        user_id: entry.userId,
        ...payload,
      })
    }
  }

  // Transition to in_progress on first check-in
  if (cls.status === 'scheduled' && attendees.some((a) => a.checkedIn)) {
    await supabase
      .from('class_instances')
      .update({ status: 'in_progress' })
      .eq('id', classId)
  }

  // Check milestones for newly checked-in attendees (fire-and-forget)
  const newlyCheckedIn = attendees.filter((a) => a.checkedIn && !existingByUser.has(a.userId))
  for (const entry of newlyCheckedIn) {
    checkAndCreateMilestones(entry.userId, cls.studio_id, classId).catch(() => {
      // Milestone errors are non-fatal
    })
  }

  return c.json({ ok: true, processed: attendees.length })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 1c: Walk-in
// POST /api/classes/:classId/walkin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a walk-in attendee. Accepts an existing userId, or name+email to look
 * up by email. Creates an attendance record with walk_in=true.
 */
checkin.post('/:classId/walkin', authMiddleware, async (c) => {
  const classId = c.req.param('classId')
  const user = c.get('user')
  const supabase = createServiceClient()

  await getClassAndVerifyStaff(classId, user.id)

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  let targetUserId = body.userId as string | undefined

  // Support name+email lookup for non-members
  if (!targetUserId) {
    const name = body.name as string | undefined
    const email = body.email as string | undefined

    if (!name && !email) {
      throw badRequest('Provide userId, or name/email to look up a user')
    }

    if (email) {
      const { data: found } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (found) {
        targetUserId = found.id
      } else {
        throw badRequest('No user found with that email. Add them as a studio member first.')
      }
    } else {
      throw badRequest('Email is required to look up a user by name')
    }
  }

  const now = new Date().toISOString()

  // Check for existing attendance record
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('class_instance_id', classId)
    .eq('user_id', targetUserId)
    .single()

  const isNew = !existing
  if (existing) {
    await supabase
      .from('attendance')
      .update({
        checked_in: true,
        walk_in: true,
        checked_in_at: now,
        checked_in_by: user.id,
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('attendance').insert({
      class_instance_id: classId,
      user_id: targetUserId,
      checked_in: true,
      walk_in: true,
      checked_in_at: now,
      checked_in_by: user.id,
    })
  }

  // Check milestones for new check-ins (fire-and-forget)
  if (isNew) {
    const { data: cls2 } = await supabase
      .from('class_instances')
      .select('studio_id')
      .eq('id', classId)
      .single()
    if (cls2) {
      checkAndCreateMilestones(targetUserId!, cls2.studio_id as string, classId).catch(() => {})
    }
  }

  return c.json({ ok: true, userId: targetUserId }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Complete class
// POST /api/classes/:classId/complete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a class as completed (staff only).
 *
 * 1. Class must be in_progress
 * 2. Marks booked-but-not-checked-in members as no_show
 * 3. Sets status to completed and enables feed
 * 4. Sends post-class notifications to attendees
 */
checkin.post('/:classId/complete', authMiddleware, async (c) => {
  const classId = c.req.param('classId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const cls = await getClassAndVerifyStaff(classId, user.id)

  if (cls.status !== 'in_progress') {
    throw badRequest('Class must be in_progress to complete it')
  }

  // Get all active bookings and current attendance
  const [{ data: bookings }, { data: attendanceRecords }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, user_id')
      .eq('class_instance_id', classId)
      .in('status', ['booked', 'confirmed']),
    supabase
      .from('attendance')
      .select('user_id, checked_in')
      .eq('class_instance_id', classId),
  ])

  const checkedInUserIds = new Set(
    (attendanceRecords ?? []).filter((a) => a.checked_in).map((a) => a.user_id),
  )

  // Mark booked-but-not-checked-in as no_show
  const noShows = (bookings ?? []).filter((b) => !checkedInUserIds.has(b.user_id))
  if (noShows.length > 0) {
    await supabase
      .from('bookings')
      .update({ status: 'no_show' })
      .in('id', noShows.map((b) => b.id))
  }

  // Set class completed + enable feed
  await supabase
    .from('class_instances')
    .update({ status: 'completed', feed_enabled: true })
    .eq('id', classId)

  // Post-class notifications for checked-in members
  const checkedInUsers = (attendanceRecords ?? []).filter((a) => a.checked_in)
  if (checkedInUsers.length > 0) {
    const notifications = checkedInUsers.map((a) => ({
      user_id: a.user_id,
      studio_id: cls.studio_id,
      type: 'class_completed',
      title: 'Class Complete!',
      body: 'Great work! Check out the class feed.',
      data: { classInstanceId: classId },
    }))
    await supabase.from('notifications').insert(notifications)
  }

  return c.json({ ok: true, no_shows: noShows.length })
})

export { checkin }
export default checkin
