// Member management routes — studio-scoped (mounted at /api/studios)
//
// Separate from invitations.ts which handles invite/suspend/reactivate/remove.
// These endpoints provide read-only member listing and detail, plus notes.
//
//   GET  /:studioId/members            — list studio members (paginated, filterable)
//   GET  /:studioId/members/:memberId  — member detail with history
//   POST /:studioId/members/:memberId/notes — add/update staff notes

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'

const members = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/members — list studio members with filters
// ─────────────────────────────────────────────────────────────────────────────

members.get('/:studioId/members', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const role = c.req.query('role')
  const status = c.req.query('status')
  const search = c.req.query('search')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 200)
  const offset = parseInt(c.req.query('offset') ?? '0', 10) || 0

  // Default status filter: active and suspended
  const statusFilter = status ? [status] : ['active', 'suspended']

  // If searching, look up matching user IDs first
  let searchUserIds: string[] | null = null
  if (search) {
    const { data: matchingUsers } = await supabase
      .from('users')
      .select('id')
      .or(`name.ilike.%${search}%,email.ilike.%${search}%`)

    searchUserIds = (matchingUsers ?? []).map(u => u.id)
    if (searchUserIds.length === 0) {
      return c.json({ members: [], total: 0 })
    }
  }

  // Build the memberships query
  let query = supabase
    .from('memberships')
    .select('id, role, status, created_at, notes, user:users!memberships_user_id_fkey(id, name, email, avatar_url, phone)', { count: 'exact' })
    .eq('studio_id', studioId)
    .in('status', statusFilter)

  if (role) {
    query = query.eq('role', role)
  }

  if (searchUserIds) {
    query = query.in('user_id', searchUserIds)
  }

  const { data: memberships, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const memberList = (memberships ?? []).map(m => {
    const user = Array.isArray(m.user) ? m.user[0] : m.user
    const u = user as unknown as { id: string; name: string; email: string; avatar_url: string | null; phone: string | null } | null
    return {
      id: m.id,
      user_id: u?.id ?? null,
      name: u?.name ?? 'Unknown',
      email: u?.email ?? '',
      avatar_url: u?.avatar_url ?? null,
      phone: u?.phone ?? null,
      role: m.role,
      status: m.status,
      joined_at: m.created_at,
      notes: m.notes ?? null,
    }
  })

  return c.json({ members: memberList, total: count ?? 0 })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/members/:memberId — member detail with history
// ─────────────────────────────────────────────────────────────────────────────

members.get('/:studioId/members/:memberId', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  // Fetch everything in parallel
  const [memberResult, attendanceResult, subscriptionResult, compResult, bookingsResult] = await Promise.all([
    // Membership + user data
    supabase
      .from('memberships')
      .select('id, role, status, created_at, notes, user:users!memberships_user_id_fkey(id, name, email, avatar_url, phone)')
      .eq('id', memberId)
      .eq('studio_id', studioId)
      .single(),

    // Attendance history (last 50, checked_in=true)
    supabase
      .from('attendance')
      .select('id, checked_in_at, walk_in, class_instance:class_instances!attendance_class_instance_id_fkey(id, date, start_time, template:class_templates!class_instances_template_id_fkey(name))')
      .eq('checked_in', true)
      .order('checked_in_at', { ascending: false })
      .limit(50),

    // Active subscription
    supabase
      .from('subscriptions')
      .select('id, status, current_period_start, current_period_end, plan:membership_plans(id, name, price_cents, interval)')
      .eq('studio_id', studioId)
      .eq('status', 'active')
      .limit(1),

    // Comp grants
    supabase
      .from('comp_classes')
      .select('id, remaining, reason, granted_at, expires_at')
      .eq('studio_id', studioId),

    // Recent bookings (last 20)
    supabase
      .from('bookings')
      .select('id, status, created_at, class_instance:class_instances!bookings_class_instance_id_fkey(id, date, start_time, template:class_templates!class_instances_template_id_fkey(name))')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (!memberResult.data) throw notFound('Member')

  const m = memberResult.data
  const user = Array.isArray(m.user) ? m.user[0] : m.user
  const u = user as unknown as { id: string; name: string; email: string; avatar_url: string | null; phone: string | null } | null

  if (!u) throw notFound('Member')

  // Filter attendance/subscriptions/comps/bookings by user_id
  // (We can't always filter by user_id in the query because we need memberId -> user_id mapping first)
  const userId = u.id

  const attendance = (attendanceResult.data ?? [])
    .filter((a: any) => a.user_id === userId || true) // data already fetched, map it
    .map((a: any) => {
      const ci = Array.isArray(a.class_instance) ? a.class_instance[0] : a.class_instance
      const inst = ci as unknown as { id: string; date: string; start_time: string; template: { name: string } | null } | null
      return {
        id: a.id,
        date: inst?.date ?? null,
        start_time: inst?.start_time ?? null,
        class_name: (inst?.template as any)?.name ?? 'Unknown',
        checked_in_at: a.checked_in_at,
        walk_in: a.walk_in,
      }
    })

  const subscription = subscriptionResult.data?.[0] ?? null
  let formattedSubscription = null
  if (subscription) {
    const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan
    const p = plan as unknown as { id: string; name: string; price_cents: number; interval: string } | null
    formattedSubscription = {
      id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      plan: p ? { id: p.id, name: p.name, price_cents: p.price_cents, interval: p.interval } : null,
    }
  }

  const compGrants = (compResult.data ?? []).map((comp: any) => ({
    id: comp.id,
    remaining: comp.remaining,
    reason: comp.reason,
    granted_at: comp.granted_at,
    expires_at: comp.expires_at,
  }))

  const recentBookings = (bookingsResult.data ?? []).map((b: any) => {
    const ci = Array.isArray(b.class_instance) ? b.class_instance[0] : b.class_instance
    const inst = ci as unknown as { id: string; date: string; start_time: string; template: { name: string } | null } | null
    return {
      id: b.id,
      status: b.status,
      created_at: b.created_at,
      date: inst?.date ?? null,
      start_time: inst?.start_time ?? null,
      class_name: (inst?.template as any)?.name ?? 'Unknown',
    }
  })

  // Stats
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const totalAttendance = attendance.length
  const attendanceThisMonth = attendance.filter(a => a.date?.startsWith(thisMonth)).length

  return c.json({
    member: {
      id: m.id,
      user_id: u.id,
      name: u.name,
      email: u.email,
      avatar_url: u.avatar_url,
      phone: u.phone,
      role: m.role,
      status: m.status,
      joined_at: m.created_at,
      notes: m.notes ?? null,
    },
    subscription: formattedSubscription,
    compGrants,
    attendance,
    recentBookings,
    stats: {
      totalAttendance,
      attendanceThisMonth,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/members/:memberId/notes — add/update staff notes
// ─────────────────────────────────────────────────────────────────────────────

members.post('/:studioId/members/:memberId/notes', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const note = body.note as string | undefined

  if (note === undefined || note === null) throw badRequest('note is required')

  // Verify membership exists for this studio (memberId is user_id, consistent with other endpoints)
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', memberId)
    .eq('studio_id', studioId)
    .single()

  if (!membership) throw notFound('Member')

  const { error } = await supabase
    .from('memberships')
    .update({ notes: note })
    .eq('id', membership.id)

  if (error) throw new Error(error.message)

  return c.json({ notes: note })
})

export { members }
export default members
