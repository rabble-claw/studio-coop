// Feature flags routes
//
// Admin endpoints (mounted at /api/admin):
//   GET    /feature-flags            — list all flags (optional ?scope=, ?studio_id= filters)
//   POST   /feature-flags            — create a new flag
//   PUT    /feature-flags/:id        — update a flag (toggle, change scope)
//   DELETE /feature-flags/:id        — delete a flag
//
// Studio-facing endpoint (mounted at /api/studios):
//   GET    /:studioId/features       — effective flags for a studio (merges global + studio + tier)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireMember } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'
import { getEffectiveFlags } from '../lib/feature-flags'

const featureFlags = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Admin: GET /feature-flags — list all flags
// ─────────────────────────────────────────────────────────────────────────────

featureFlags.get('/feature-flags', authMiddleware, async (c) => {
  const supabase = createServiceClient()
  const scope = c.req.query('scope')
  const studioId = c.req.query('studio_id')

  let query = supabase
    .from('feature_flags')
    .select('*')
    .order('name')
    .order('scope')

  if (scope) query = query.eq('scope', scope)
  if (studioId) query = query.eq('studio_id', studioId)

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return c.json({ flags: data ?? [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin: POST /feature-flags — create a new flag
// ─────────────────────────────────────────────────────────────────────────────

featureFlags.post('/feature-flags', authMiddleware, async (c) => {
  const supabase = createServiceClient()
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const name = (body.name as string)?.trim()
  if (!name) throw badRequest('name is required')

  const scope = (body.scope as string) ?? 'global'
  if (!['global', 'studio', 'plan_tier'].includes(scope)) {
    throw badRequest('scope must be global, studio, or plan_tier')
  }

  if (scope === 'studio' && !body.studio_id) {
    throw badRequest('studio_id is required for studio-scoped flags')
  }

  if (scope === 'plan_tier' && !body.plan_tier) {
    throw badRequest('plan_tier is required for plan_tier-scoped flags')
  }

  const insert: Record<string, unknown> = {
    name,
    description: (body.description as string) ?? null,
    enabled: body.enabled === true,
    scope,
  }

  if (scope === 'studio') insert.studio_id = body.studio_id
  if (scope === 'plan_tier') insert.plan_tier = body.plan_tier

  const { data, error } = await supabase
    .from('feature_flags')
    .insert(insert)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw badRequest('A flag with this name, scope, and target already exists')
    }
    throw new Error(error.message)
  }

  return c.json({ flag: data }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin: PUT /feature-flags/:id — update a flag
// ─────────────────────────────────────────────────────────────────────────────

featureFlags.put('/feature-flags/:id', authMiddleware, async (c) => {
  const supabase = createServiceClient()
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled
  if (typeof body.description === 'string') updates.description = body.description
  if (typeof body.name === 'string' && body.name) updates.name = (body.name as string).trim()

  if (typeof body.scope === 'string') {
    if (!['global', 'studio', 'plan_tier'].includes(body.scope as string)) {
      throw badRequest('scope must be global, studio, or plan_tier')
    }
    updates.scope = body.scope

    if (body.scope === 'global') {
      updates.studio_id = null
      updates.plan_tier = null
    }
  }

  if (body.studio_id !== undefined) updates.studio_id = body.studio_id
  if (body.plan_tier !== undefined) updates.plan_tier = body.plan_tier

  const { data, error } = await supabase
    .from('feature_flags')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw notFound('Feature flag')

  return c.json({ flag: data })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin: DELETE /feature-flags/:id — remove a flag
// ─────────────────────────────────────────────────────────────────────────────

featureFlags.delete('/feature-flags/:id', authMiddleware, async (c) => {
  const supabase = createServiceClient()
  const id = c.req.param('id')

  const { error } = await supabase
    .from('feature_flags')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  return c.json({ deleted: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Studio-facing: GET /:studioId/features — effective flags for a studio
// ─────────────────────────────────────────────────────────────────────────────

featureFlags.get('/:studioId/features', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const flags = await getEffectiveFlags(supabase, studioId)

  return c.json({ studioId, features: flags })
})

export { featureFlags }
export default featureFlags
