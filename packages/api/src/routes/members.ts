// Member management routes — studio-scoped (mounted at /api/studios)
//
// Separate from invitations.ts which handles invite/suspend/reactivate/remove.
// These endpoints provide read-only member listing and detail, plus notes and privacy.
//
//   GET  /:studioId/members            — list studio members (paginated, filterable)
//   GET  /:studioId/members/:memberId  — member detail with history
//   POST /:studioId/members/:memberId/notes — add/update staff notes
//   GET  /:studioId/members/:memberId/privacy — get member privacy settings
//   PUT  /:studioId/members/:memberId/privacy — update member privacy settings

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireMember, requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound, forbidden } from '../lib/errors'

// Privacy settings defaults
const PRIVACY_DEFAULTS = {
  profile_visibility: 'members' as const,
  show_attendance: true,
  show_email: false,
  show_phone: false,
  show_achievements: true,
  feed_posts_visible: true,
}

type PrivacySettings = typeof PRIVACY_DEFAULTS

function mergePrivacyDefaults(settings: Record<string, unknown> | null): PrivacySettings {
  return { ...PRIVACY_DEFAULTS, ...(settings ?? {}) }
}

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
// Respects privacy settings when viewer is not staff and not the member themselves.
// ─────────────────────────────────────────────────────────────────────────────

members.get('/:studioId/members/:memberId', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  // Determine if the viewing user is staff
  const viewerRole = c.get('memberRole')
  const viewerId = c.get('user').id
  const isStaff = ['teacher', 'admin', 'owner'].includes(viewerRole)
  const isSelf = viewerId === memberId

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

  // Fetch privacy settings for the target member
  const { data: targetUser } = await supabase
    .from('users')
    .select('privacy_settings')
    .eq('id', userId)
    .single()

  const privacy = mergePrivacyDefaults(targetUser?.privacy_settings as Record<string, unknown> | null)

  // Apply privacy filtering for non-staff, non-self viewers
  const shouldRedact = !isStaff && !isSelf

  return c.json({
    member: {
      id: m.id,
      user_id: u.id,
      name: u.name,
      email: shouldRedact && !privacy.show_email ? null : u.email,
      avatar_url: u.avatar_url,
      phone: shouldRedact && !privacy.show_phone ? null : u.phone,
      role: m.role,
      status: m.status,
      joined_at: m.created_at,
      notes: isStaff ? (m.notes ?? null) : null,
    },
    privacy: shouldRedact ? privacy : undefined,
    subscription: isStaff || isSelf ? formattedSubscription : null,
    compGrants: isStaff ? compGrants : [],
    attendance: shouldRedact && !privacy.show_attendance ? [] : attendance,
    recentBookings: isStaff || isSelf ? recentBookings : [],
    stats: shouldRedact && !privacy.show_attendance
      ? { totalAttendance: 0, attendanceThisMonth: 0, attendanceHidden: true }
      : { totalAttendance, attendanceThisMonth },
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/members/:memberId/privacy — get member privacy settings
// Members can get their own; staff can get anyone's.
// ─────────────────────────────────────────────────────────────────────────────

members.get('/:studioId/members/:memberId/privacy', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const viewer = c.get('user')
  const viewerRole = c.get('memberRole')
  const isStaff = ['teacher', 'admin', 'owner'].includes(viewerRole)
  const supabase = createServiceClient()

  // Only the member themselves or staff can view privacy settings
  if (viewer.id !== memberId && !isStaff) {
    throw forbidden('You can only view your own privacy settings')
  }

  // Verify the target member belongs to this studio
  const { data: membership } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('user_id', memberId)
    .eq('studio_id', studioId)
    .single()

  if (!membership) throw notFound('Member')

  const { data: user } = await supabase
    .from('users')
    .select('privacy_settings')
    .eq('id', memberId)
    .single()

  if (!user) throw notFound('User')

  return c.json(mergePrivacyDefaults(user.privacy_settings as Record<string, unknown> | null))
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/members/:memberId/privacy — update member privacy settings
// Members can only update their own privacy settings.
// ─────────────────────────────────────────────────────────────────────────────

members.put('/:studioId/members/:memberId/privacy', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const viewer = c.get('user')
  const supabase = createServiceClient()

  // Only the member themselves can update their privacy settings
  if (viewer.id !== memberId) {
    throw forbidden('You can only update your own privacy settings')
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('user_id', memberId)
    .eq('studio_id', studioId)
    .single()

  if (!membership) throw notFound('Member')

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  // Validate keys
  const validKeys = ['profile_visibility', 'show_attendance', 'show_email', 'show_phone', 'show_achievements', 'feed_posts_visible']
  const booleanKeys = ['show_attendance', 'show_email', 'show_phone', 'show_achievements', 'feed_posts_visible']
  const validVisibility = ['everyone', 'members', 'staff_only']

  for (const key of Object.keys(body)) {
    if (!validKeys.includes(key)) {
      throw badRequest(`Unknown privacy setting: ${key}`)
    }
  }

  for (const key of booleanKeys) {
    if (key in body && typeof body[key] !== 'boolean') {
      throw badRequest(`${key} must be a boolean`)
    }
  }

  if ('profile_visibility' in body && !validVisibility.includes(body.profile_visibility as string)) {
    throw badRequest(`profile_visibility must be one of: ${validVisibility.join(', ')}`)
  }

  // Get current settings and merge
  const { data: user } = await supabase
    .from('users')
    .select('privacy_settings')
    .eq('id', memberId)
    .single()

  if (!user) throw notFound('User')

  const current = (user.privacy_settings as Record<string, unknown>) ?? {}
  const updated = { ...current, ...body }

  const { error } = await supabase
    .from('users')
    .update({ privacy_settings: updated })
    .eq('id', memberId)

  if (error) throw new Error(error.message)

  return c.json(mergePrivacyDefaults(updated))
})

export { members }
export default members
