// Class template CRUD routes — studio-scoped (mounted at /api/studios)
//
// DB schema: class_templates has studio_id, name, description, day_of_week,
// start_time, duration_min, max_capacity, location, recurrence, settings,
// active, teacher_id (FK to users)
//
//   GET    /:studioId/templates            — list templates (member+)
//   POST   /:studioId/templates            — create template (admin+)
//   PUT    /:studioId/templates/:templateId — update template (admin+)
//   DELETE /:studioId/templates/:templateId — soft-delete template (admin+)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, requireMember } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'

const templates = new Hono()

const VALID_RECURRENCES = ['weekly', 'biweekly', 'monthly', 'once']

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/templates — list class templates
// ─────────────────────────────────────────────────────────────────────────────

templates.get('/:studioId/templates', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const activeParam = c.req.query('active')
  const showAll = activeParam === 'false'

  let query = supabase
    .from('class_templates')
    .select('id, name, description, day_of_week, start_time, duration_min, max_capacity, location, recurrence, settings, active, teacher:users!class_templates_teacher_id_fkey(id, name, avatar_url)')
    .eq('studio_id', studioId)
    .order('name')

  if (!showAll) {
    query = query.eq('active', true)
  }

  const { data, error } = await query

  if (error) throw error
  return c.json({ templates: data ?? [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/templates — create a class template
// ─────────────────────────────────────────────────────────────────────────────

templates.post('/:studioId/templates', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const name = body.name as string | undefined
  const startTime = body.start_time as string | undefined
  const durationMin = body.duration_min as number | undefined

  if (!name || !name.trim()) throw badRequest('name is required')
  if (!startTime) throw badRequest('start_time is required')
  if (durationMin == null || durationMin < 15 || durationMin > 240) {
    throw badRequest('duration_min must be between 15 and 240')
  }

  if (body.day_of_week != null) {
    const dow = Number(body.day_of_week)
    if (isNaN(dow) || dow < 0 || dow > 6) {
      throw badRequest('day_of_week must be between 0 and 6')
    }
  }

  if (body.recurrence != null && !VALID_RECURRENCES.includes(body.recurrence as string)) {
    throw badRequest(`recurrence must be one of: ${VALID_RECURRENCES.join(', ')}`)
  }

  const { data: template, error } = await supabase
    .from('class_templates')
    .insert({
      studio_id: studioId,
      name: name.trim(),
      description: (body.description as string) ?? null,
      teacher_id: (body.teacher_id as string) ?? null,
      day_of_week: body.day_of_week != null ? Number(body.day_of_week) : null,
      start_time: startTime,
      duration_min: durationMin,
      max_capacity: (body.max_capacity as number) ?? null,
      location: (body.location as string) ?? null,
      recurrence: (body.recurrence as string) ?? 'weekly',
      settings: (body.settings as Record<string, unknown>) ?? {},
      active: body.active != null ? Boolean(body.active) : true,
    })
    .select()
    .single()

  if (error) throw error
  return c.json({ template }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/templates/:templateId — update a class template
// ─────────────────────────────────────────────────────────────────────────────

templates.put('/:studioId/templates/:templateId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const templateId = c.req.param('templateId')
  const supabase = createServiceClient()

  // Verify the template exists and belongs to this studio
  const { data: existing } = await supabase
    .from('class_templates')
    .select('id')
    .eq('id', templateId)
    .eq('studio_id', studioId)
    .maybeSingle()

  if (!existing) throw notFound('Template')

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const allowedFields = [
    'name', 'description', 'teacher_id', 'day_of_week', 'start_time',
    'duration_min', 'max_capacity', 'location', 'recurrence', 'settings', 'active',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest('No valid fields to update')
  }

  // Validate fields if present
  if (updates.duration_min != null) {
    const dur = Number(updates.duration_min)
    if (isNaN(dur) || dur < 15 || dur > 240) {
      throw badRequest('duration_min must be between 15 and 240')
    }
  }

  if (updates.day_of_week != null) {
    const dow = Number(updates.day_of_week)
    if (isNaN(dow) || dow < 0 || dow > 6) {
      throw badRequest('day_of_week must be between 0 and 6')
    }
  }

  if (updates.recurrence != null && !VALID_RECURRENCES.includes(updates.recurrence as string)) {
    throw badRequest(`recurrence must be one of: ${VALID_RECURRENCES.join(', ')}`)
  }

  const { data: template, error } = await supabase
    .from('class_templates')
    .update(updates)
    .eq('id', templateId)
    .eq('studio_id', studioId)
    .select()
    .single()

  if (error) throw error
  return c.json({ template })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:studioId/templates/:templateId — soft-delete a class template
// ─────────────────────────────────────────────────────────────────────────────

templates.delete('/:studioId/templates/:templateId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const templateId = c.req.param('templateId')
  const supabase = createServiceClient()

  // Verify the template exists and belongs to this studio
  const { data: existing } = await supabase
    .from('class_templates')
    .select('id')
    .eq('id', templateId)
    .eq('studio_id', studioId)
    .maybeSingle()

  if (!existing) throw notFound('Template')

  const { error } = await supabase
    .from('class_templates')
    .update({ active: false })
    .eq('id', templateId)
    .eq('studio_id', studioId)

  if (error) throw error
  return c.json({ success: true })
})

export { templates }
export default templates
