// Skill progression tracking routes — studio-scoped (mounted at /api/studios)
//
//   GET    /:studioId/skills                          — list skill definitions
//   POST   /:studioId/skills                          — create skill definition (staff)
//   PUT    /:studioId/skills/:skillId                 — update skill definition (staff)
//   DELETE /:studioId/skills/:skillId                 — delete skill definition (staff)
//   POST   /:studioId/skills/seed                     — seed default skills (staff)
//   GET    /:studioId/skills/member/:memberId         — get member's skill progress
//   PUT    /:studioId/skills/member/:memberId/:skillId — update skill level

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff, requireMember } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound, forbidden } from '../lib/errors'

const DEFAULT_SKILLS: Record<string, Array<{ name: string; category: string }>> = {
  pole: [
    { name: 'Basic Spin', category: 'Spins' },
    { name: 'Fireman Spin', category: 'Spins' },
    { name: 'Chair Spin', category: 'Spins' },
    { name: 'Basic Climb', category: 'Climbs' },
    { name: 'Basic Invert', category: 'Inverts' },
    { name: 'Shoulder Mount', category: 'Inverts' },
    { name: 'Splits', category: 'Flexibility' },
    { name: 'Backbend', category: 'Flexibility' },
  ],
  aerial: [
    { name: 'Foot Lock', category: 'Basics' },
    { name: 'Hip Key', category: 'Basics' },
    { name: 'Star', category: 'Poses' },
    { name: 'Angel', category: 'Poses' },
    { name: 'Drop', category: 'Drops' },
  ],
  yoga: [
    { name: 'Headstand', category: 'Inversions' },
    { name: 'Crow Pose', category: 'Arm Balances' },
    { name: 'Wheel', category: 'Backbends' },
    { name: 'Splits', category: 'Flexibility' },
  ],
  bjj: [
    { name: 'Armbar', category: 'Submissions' },
    { name: 'Triangle', category: 'Submissions' },
    { name: 'Guard Pass', category: 'Passing' },
    { name: 'Sweep', category: 'Guard' },
    { name: 'Takedown', category: 'Standing' },
  ],
  crossfit: [
    { name: 'Pull-up', category: 'Gymnastics' },
    { name: 'Muscle-up', category: 'Gymnastics' },
    { name: 'Handstand Walk', category: 'Gymnastics' },
    { name: 'Snatch', category: 'Olympic Lifts' },
    { name: 'Clean & Jerk', category: 'Olympic Lifts' },
  ],
  dance: [
    { name: 'Pirouette', category: 'Turns' },
    { name: 'Leap', category: 'Jumps' },
    { name: 'Splits', category: 'Flexibility' },
    { name: 'Choreography', category: 'Performance' },
  ],
  pilates: [
    { name: 'Teaser', category: 'Core' },
    { name: 'Roll Up', category: 'Core' },
    { name: 'Swan Dive', category: 'Extension' },
    { name: 'Control Balance', category: 'Balance' },
  ],
  cycling: [
    { name: 'Endurance Ride', category: 'Endurance' },
    { name: 'Hill Climb', category: 'Strength' },
    { name: 'Sprint Intervals', category: 'Speed' },
    { name: 'Cadence Control', category: 'Technique' },
  ],
}

const skills = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/skills — list skill definitions grouped by category
// ─────────────────────────────────────────────────────────────────────────────

skills.get('/:studioId/skills', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('skill_definitions')
    .select('id, name, category, description, sort_order, created_at')
    .eq('studio_id', studioId)
    .order('category')
    .order('sort_order')
    .order('name')

  if (error) throw error

  // Group by category
  const grouped: Record<string, Array<typeof data[number]>> = {}
  for (const skill of data ?? []) {
    if (!grouped[skill.category]) grouped[skill.category] = []
    grouped[skill.category].push(skill)
  }

  return c.json({ skills: data ?? [], grouped })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/skills — create skill definition (staff only)
// ─────────────────────────────────────────────────────────────────────────────

skills.post('/:studioId/skills', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const name = body.name as string | undefined
  const category = body.category as string | undefined
  const description = body.description as string | undefined
  const sort_order = body.sort_order as number | undefined

  if (!name?.trim()) throw badRequest('name is required')
  if (!category?.trim()) throw badRequest('category is required')

  const { data, error } = await supabase
    .from('skill_definitions')
    .insert({
      studio_id: studioId,
      name: name.trim(),
      category: category.trim(),
      description: description?.trim() || null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw badRequest('A skill with that name already exists')
    throw error
  }

  return c.json({ skill: data }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/skills/:skillId — update skill definition (staff only)
// ─────────────────────────────────────────────────────────────────────────────

skills.put('/:studioId/skills/:skillId', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const skillId = c.req.param('skillId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = (body.name as string).trim()
  if (body.category !== undefined) updates.category = (body.category as string).trim()
  if (body.description !== undefined) updates.description = (body.description as string)?.trim() || null
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  if (Object.keys(updates).length === 0) throw badRequest('No fields to update')

  const { data, error } = await supabase
    .from('skill_definitions')
    .update(updates)
    .eq('id', skillId)
    .eq('studio_id', studioId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw badRequest('A skill with that name already exists')
    throw error
  }
  if (!data) throw notFound('Skill definition')

  return c.json({ skill: data })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:studioId/skills/:skillId — delete skill definition (staff only)
// ─────────────────────────────────────────────────────────────────────────────

skills.delete('/:studioId/skills/:skillId', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const skillId = c.req.param('skillId')
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('skill_definitions')
    .delete()
    .eq('id', skillId)
    .eq('studio_id', studioId)

  if (error) throw error

  return c.json({ deleted: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/skills/seed — seed default skills based on discipline (staff)
// ─────────────────────────────────────────────────────────────────────────────

skills.post('/:studioId/skills/seed', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  // Look up studio discipline
  const { data: studio } = await supabase
    .from('studios')
    .select('discipline')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  const discipline = studio.discipline as string
  const seedSkills = DEFAULT_SKILLS[discipline] ?? DEFAULT_SKILLS['general'] ?? []

  if (seedSkills.length === 0) {
    return c.json({ seeded: 0, message: `No default skills for discipline: ${discipline}` })
  }

  const rows = seedSkills.map((s, i) => ({
    studio_id: studioId,
    name: s.name,
    category: s.category,
    sort_order: i,
  }))

  // Use upsert to avoid duplicates
  const { data, error } = await supabase
    .from('skill_definitions')
    .upsert(rows, { onConflict: 'studio_id,name', ignoreDuplicates: true })
    .select()

  if (error) throw error

  return c.json({ seeded: data?.length ?? 0, skills: data ?? [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/skills/member/:memberId — get member's skill progress
// ─────────────────────────────────────────────────────────────────────────────

skills.get('/:studioId/skills/member/:memberId', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  // Get all skill definitions for the studio
  const { data: definitions } = await supabase
    .from('skill_definitions')
    .select('id, name, category, description, sort_order')
    .eq('studio_id', studioId)
    .order('category')
    .order('sort_order')
    .order('name')

  // Get member's progress
  const { data: memberSkills } = await supabase
    .from('member_skills')
    .select('id, skill_id, level, notes, verified_by, verified_at, updated_at, verifier:users!member_skills_verified_by_fkey(name)')
    .eq('user_id', memberId)
    .eq('studio_id', studioId)

  // Merge definitions with progress
  const skillMap = new Map<string, Record<string, unknown>>()
  for (const ms of (memberSkills ?? []) as Array<Record<string, unknown>>) {
    skillMap.set(ms.skill_id as string, ms)
  }

  const skills = (definitions ?? []).map((def) => {
    const progress = skillMap.get(def.id)
    const verifier = progress?.verifier
    const v = Array.isArray(verifier) ? verifier[0] : verifier
    const verifierName = (v as { name: string } | null)?.name ?? null

    return {
      ...def,
      level: (progress?.level as string) ?? null,
      notes: (progress?.notes as string) ?? null,
      verified_by: (progress?.verified_by as string) ?? null,
      verified_at: (progress?.verified_at as string) ?? null,
      verifier_name: verifierName,
      updated_at: (progress?.updated_at as string) ?? null,
    }
  })

  // Group by category
  const grouped: Record<string, typeof skills> = {}
  for (const skill of skills) {
    if (!grouped[skill.category]) grouped[skill.category] = []
    grouped[skill.category].push(skill)
  }

  return c.json({ skills, grouped })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/skills/member/:memberId/:skillId — update skill level
// ─────────────────────────────────────────────────────────────────────────────

skills.put('/:studioId/skills/member/:memberId/:skillId', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const skillId = c.req.param('skillId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const level = body.level as string | undefined
  const notes = body.notes as string | undefined
  const verify = body.verify as boolean | undefined

  if (!level) throw badRequest('level is required')

  const validLevels = ['learning', 'practicing', 'confident', 'mastered']
  if (!validLevels.includes(level)) {
    throw badRequest(`level must be one of: ${validLevels.join(', ')}`)
  }

  // Verify skill definition exists for this studio
  const { data: skillDef } = await supabase
    .from('skill_definitions')
    .select('id')
    .eq('id', skillId)
    .eq('studio_id', studioId)
    .single()

  if (!skillDef) throw notFound('Skill definition')

  // Check permissions: members can only update their own skills
  const isOwnSkill = user.id === memberId

  // Check if requester is staff (for verification)
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .single()

  const staffRoles = ['teacher', 'admin', 'owner']
  const isStaff = staffRoles.includes(membership?.role ?? '')

  if (!isOwnSkill && !isStaff) {
    throw forbidden('You can only update your own skills')
  }

  const upsertData: Record<string, unknown> = {
    user_id: memberId,
    studio_id: studioId,
    skill_id: skillId,
    level,
    updated_at: new Date().toISOString(),
  }

  if (notes !== undefined) upsertData.notes = notes?.trim() || null

  // If verify is true and requester is staff, set verification
  if (verify && isStaff) {
    upsertData.verified_by = user.id
    upsertData.verified_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('member_skills')
    .upsert(upsertData, { onConflict: 'user_id,skill_id' })
    .select('id, skill_id, level, notes, verified_by, verified_at, updated_at')
    .single()

  if (error) throw error

  return c.json({ skill: data })
})

export { skills }
export default skills
