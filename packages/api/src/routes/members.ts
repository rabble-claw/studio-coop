// Member management routes — mounted at /api/studios in index.ts
//
//   GET  /:studioId/members                   — list studio members (staff only)
//   GET  /:studioId/members/:memberId          — get member detail (staff only)
//   POST /:studioId/members/:memberId/notes    — update member notes (staff only)
//   POST /:studioId/members/:memberId/comps    — grant comp classes (staff only)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest } from '../lib/errors'

const members = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/members?search=&status=
// ─────────────────────────────────────────────────────────────────────────────

members.get('/:studioId/members', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const search   = c.req.query('search') ?? ''
  const status   = c.req.query('status') ?? 'active'
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('memberships')
    .select(`
      role, status, joined_at,
      user:users!memberships_user_id_fkey(id, name, email, avatar_url)
    `)
    .eq('studio_id', studioId)
    .eq('status', status)
    .order('joined_at', { ascending: true })

  if (error) throw error

  // Map rows and optionally filter by search term
  const memberList = (data ?? [])
    .map((m) => {
      const u = (Array.isArray(m.user) ? m.user[0] : m.user) as Record<string, unknown> | null
      return {
        id:         (u?.id as string) ?? '',
        name:       (u?.name as string) ?? 'Unknown',
        email:      (u?.email as string) ?? '',
        avatar_url: (u?.avatar_url as string) ?? null,
        role:       m.role,
        status:     m.status,
        joined_at:  m.joined_at,
      }
    })
    .filter((m) => {
      if (!search) return true
      const s = search.toLowerCase()
      return m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s)
    })

  // Fetch attendance counts for these members in this studio
  const memberIds = memberList.map((m) => m.id).filter(Boolean)
  const attendanceMap: Record<string, number> = {}

  if (memberIds.length > 0) {
    // Get all class instance IDs for this studio
    const { data: instances } = await supabase
      .from('class_instances')
      .select('id')
      .eq('studio_id', studioId)

    const instanceIds = (instances ?? []).map((i) => i.id)

    if (instanceIds.length > 0) {
      const { data: attData } = await supabase
        .from('attendance')
        .select('user_id')
        .in('user_id', memberIds)
        .in('class_instance_id', instanceIds)
        .eq('checked_in', true)

      for (const a of attData ?? []) {
        attendanceMap[a.user_id] = (attendanceMap[a.user_id] ?? 0) + 1
      }
    }
  }

  const membersWithStats = memberList.map((m) => ({
    ...m,
    classes_attended: attendanceMap[m.id] ?? 0,
  }))

  return c.json({ members: membersWithStats })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/members/:memberId
// ─────────────────────────────────────────────────────────────────────────────

members.get('/:studioId/members/:memberId', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  const { data: membership, error } = await supabase
    .from('memberships')
    .select(`
      role, status, joined_at, notes,
      user:users!memberships_user_id_fkey(id, name, email, avatar_url)
    `)
    .eq('user_id', memberId)
    .eq('studio_id', studioId)
    .single()

  if (error || !membership) throw notFound('Member')

  const u = (Array.isArray(membership.user) ? membership.user[0] : membership.user) as Record<string, unknown> | null

  // Attendance count for this studio
  const { data: instances } = await supabase
    .from('class_instances')
    .select('id')
    .eq('studio_id', studioId)

  const instanceIds = (instances ?? []).map((i) => i.id)
  let classesAttended = 0

  if (instanceIds.length > 0) {
    const { count } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', memberId)
      .in('class_instance_id', instanceIds)
      .eq('checked_in', true)

    classesAttended = count ?? 0
  }

  return c.json({
    member: {
      id:               (u?.id as string) ?? memberId,
      name:             (u?.name as string) ?? 'Unknown',
      email:            (u?.email as string) ?? '',
      avatar_url:       (u?.avatar_url as string) ?? null,
      role:             membership.role,
      status:           membership.status,
      joined_at:        membership.joined_at,
      notes:            membership.notes ?? null,
      studio_id:        studioId,
      classes_attended: classesAttended,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/members/:memberId/notes
// ─────────────────────────────────────────────────────────────────────────────

members.post('/:studioId/members/:memberId/notes', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const memberId = c.req.param('memberId')
  const body     = await c.req.json().catch(() => ({})) as { note?: string }
  const supabase = createServiceClient()

  if (!body.note?.trim()) throw badRequest('note is required')

  const { error } = await supabase
    .from('memberships')
    .update({ notes: body.note.trim() })
    .eq('user_id', memberId)
    .eq('studio_id', studioId)

  if (error) throw error

  return c.json({ ok: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/members/:memberId/comps
// ─────────────────────────────────────────────────────────────────────────────

members.post('/:studioId/members/:memberId/comps', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const memberId = c.req.param('memberId')
  const user     = c.get('user' as never) as { id: string }
  const body     = await c.req.json().catch(() => ({})) as {
    classes?: unknown; reason?: string; expiresAt?: string
  }
  const supabase = createServiceClient()

  const classes = body.classes
  if (typeof classes !== 'number' || !Number.isInteger(classes) || classes < 1) {
    throw badRequest('classes must be a positive integer')
  }

  // Verify target user is an active member of this studio
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', memberId)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .maybeSingle()

  if (!membership) throw notFound('Member')

  const { data: comp, error } = await supabase
    .from('comp_classes')
    .insert({
      user_id:           memberId,
      studio_id:         studioId,
      granted_by:        user.id,
      reason:            body.reason ?? null,
      total_classes:     classes,
      remaining_classes: classes,
      expires_at:        body.expiresAt ?? null,
    })
    .select()
    .single()

  if (error || !comp) throw new Error(`Failed to grant comp classes: ${error?.message}`)

  return c.json({ comp }, 201)
})

export { members }
export default members
