// Comp class routes — studio-scoped (mounted at /api/studios) and member-scoped (mounted at /api/my).
//
// Studio-scoped (via /api/studios):
//   POST   /:studioId/members/:userId/comp  — grant comp classes (staff only)
//   GET    /:studioId/comps                 — list all comp grants (staff only)
//   DELETE /:studioId/comps/:compId         — revoke comp grant (staff only)
//
// Member-scoped (via /api/my):
//   GET    /comps                           — member's own comp credits

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest } from '../lib/errors'

const comps = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/members/:userId/comp — grant comp classes (staff only)
// ─────────────────────────────────────────────────────────────────────────────

comps.post('/:studioId/members/:userId/comp', authMiddleware, requireStaff, async (c) => {
  const studioId     = c.req.param('studioId')
  const targetUserId = c.req.param('userId')
  const user         = c.get('user' as never) as { id: string }
  const supabase     = createServiceClient()

  const body      = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const classes   = body.classes
  const reason    = body.reason as string | undefined
  const expiresAt = body.expiresAt as string | undefined

  if (typeof classes !== 'number' || !Number.isInteger(classes) || classes < 1) {
    throw badRequest('classes must be a positive integer')
  }

  // Verify target user is an active member of this studio
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', targetUserId)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .maybeSingle()

  if (!membership) throw notFound('Member')

  const { data: comp, error } = await supabase
    .from('comp_classes')
    .insert({
      user_id:           targetUserId,
      studio_id:         studioId,
      granted_by:        user.id,
      reason:            reason ?? null,
      total_classes:     classes,
      remaining_classes: classes,
      expires_at:        expiresAt ?? null,
    })
    .select()
    .single()

  if (error || !comp) throw new Error(`Failed to grant comp classes: ${error?.message}`)

  return c.json({ comp }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/comps — list all comp grants (staff only)
// ─────────────────────────────────────────────────────────────────────────────

comps.get('/:studioId/comps', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: compList, error } = await supabase
    .from('comp_classes')
    .select(`
      id, total_classes, remaining_classes, reason, expires_at, created_at,
      member:users!comp_classes_user_id_fkey(id, name, email, avatar_url),
      granted_by_user:users!comp_classes_granted_by_fkey(id, name)
    `)
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return c.json({ comps: compList ?? [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:studioId/comps/:compId — revoke (staff only, sets remaining to 0)
// ─────────────────────────────────────────────────────────────────────────────

comps.delete('/:studioId/comps/:compId', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const compId   = c.req.param('compId')
  const supabase = createServiceClient()

  const { data: comp } = await supabase
    .from('comp_classes')
    .select('id')
    .eq('id', compId)
    .eq('studio_id', studioId)
    .single()

  if (!comp) throw notFound('Comp grant')

  await supabase
    .from('comp_classes')
    .update({ remaining_classes: 0 })
    .eq('id', compId)

  return c.json({ compId, revoked: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /comps — member's own comp credits (mounted at /api/my → GET /api/my/comps)
// ─────────────────────────────────────────────────────────────────────────────

comps.get('/comps', authMiddleware, async (c) => {
  const user     = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()
  const now      = new Date()

  const { data: compList, error } = await supabase
    .from('comp_classes')
    .select(`
      id, total_classes, remaining_classes, expires_at, reason, created_at,
      studio:studios!comp_classes_studio_id_fkey(id, name, slug)
    `)
    .eq('user_id', user.id)
    .gt('remaining_classes', 0)
    .order('expires_at', { ascending: true })

  if (error) throw new Error(error.message)

  // Filter out expired grants
  const valid = (compList ?? []).filter(
    (cc) => !cc.expires_at || new Date(cc.expires_at) > now,
  )

  return c.json({ comps: valid })
})

export { comps }
export default comps
