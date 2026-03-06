// Retention scoring API routes
//
// Mounted at /api/studios in index.ts.
//
//   GET  /:studioId/retention/scores     — list member risk scores (filterable by stage)
//   GET  /:studioId/retention/scores/:userId — single member risk detail
//   GET  /:studioId/retention/summary    — aggregate retention metrics

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound } from '../lib/errors'

const retention = new Hono()

// ─── GET /:studioId/retention/scores ──────────────────────────────────────────
retention.get('/:studioId/retention/scores', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId') as string
  const stage = c.req.query('stage')
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
  const offset = Number(c.req.query('offset')) || 0

  const supabase = createServiceClient()

  let query = supabase
    .from('member_risk_scores')
    .select('id, user_id, score, factors, stage, computed_at')
    .eq('studio_id', studioId)
    .order('score', { ascending: false })
    .range(offset, offset + limit - 1)

  if (stage) {
    query = query.eq('stage', stage)
  }

  const { data: scores, error } = await query

  if (error) throw error

  // Fetch user names for the scored members
  const userIds = (scores ?? []).map(s => s.user_id)
  let userMap: Record<string, { name: string; email: string }> = {}

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds)

    for (const u of users ?? []) {
      userMap[u.id] = { name: u.name, email: u.email }
    }
  }

  const enriched = (scores ?? []).map(s => ({
    ...s,
    member_name: userMap[s.user_id]?.name ?? null,
    member_email: userMap[s.user_id]?.email ?? null,
  }))

  return c.json({ scores: enriched, count: enriched.length })
})

// ─── GET /:studioId/retention/scores/:userId ──────────────────────────────────
retention.get('/:studioId/retention/scores/:userId', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId') as string
  const userId = c.req.param('userId')

  const supabase = createServiceClient()

  const { data: score } = await supabase
    .from('member_risk_scores')
    .select('*')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!score) throw notFound('Risk score')

  // Fetch user info
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('id', userId)
    .single()

  return c.json({
    score: {
      ...score,
      member_name: user?.name ?? null,
      member_email: user?.email ?? null,
    },
  })
})

// ─── GET /:studioId/retention/summary ─────────────────────────────────────────
retention.get('/:studioId/retention/summary', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId') as string

  const supabase = createServiceClient()

  const { data: scores } = await supabase
    .from('member_risk_scores')
    .select('score, stage')
    .eq('studio_id', studioId)

  const all = scores ?? []
  const total = all.length
  const avgScore = total > 0
    ? Math.round(all.reduce((sum, s) => sum + s.score, 0) / total)
    : 0

  // Count by stage
  const stages: Record<string, number> = {
    none: 0,
    gentle_nudge: 0,
    we_miss_you: 0,
    incentive: 0,
    final: 0,
  }
  for (const s of all) {
    stages[s.stage] = (stages[s.stage] ?? 0) + 1
  }

  // Risk tiers
  const tiers = {
    low: all.filter(s => s.score <= 25).length,
    moderate: all.filter(s => s.score > 25 && s.score <= 50).length,
    high: all.filter(s => s.score > 50 && s.score <= 75).length,
    critical: all.filter(s => s.score > 75).length,
  }

  return c.json({
    total_scored: total,
    avg_score: avgScore,
    stages,
    tiers,
  })
})

export { retention }
export default retention
