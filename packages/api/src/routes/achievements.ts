// Achievement routes — studio-scoped (mounted at /api/studios)
//
//   GET    /:studioId/achievements                      — list achievements (staff: all, member: own)
//   GET    /:studioId/achievements/member/:memberId     — get a member's achievements
//   POST   /:studioId/achievements                      — create achievement
//   DELETE /:studioId/achievements/:achievementId       — delete own achievement (or staff can delete any)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireMember, requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest, forbidden } from '../lib/errors'

const achievements = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/achievements — list achievements
// Staff see all, members see own
// ─────────────────────────────────────────────────────────────────────────────

achievements.get('/:studioId/achievements', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const user = c.get('user' as never) as { id: string }
  const memberRole = c.get('memberRole' as never) as string
  const supabase = createServiceClient()

  const staffRoles = ['teacher', 'admin', 'owner']
  const isStaff = staffRoles.includes(memberRole)

  let query = supabase
    .from('achievements')
    .select(`
      id, title, description, category, icon, earned_at, feed_post_id, created_at,
      user:users!achievements_user_id_fkey(id, name, avatar_url)
    `)
    .eq('studio_id', studioId)
    .order('earned_at', { ascending: false })

  if (!isStaff) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const achievements_list = (data ?? []).map((a) => {
    const u = a.user as unknown as { id: string; name: string; avatar_url: string | null }
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      category: a.category,
      icon: a.icon,
      earned_at: a.earned_at,
      feed_post_id: a.feed_post_id,
      created_at: a.created_at,
      user: { id: u.id, name: u.name, avatar_url: u.avatar_url },
    }
  })

  return c.json({ achievements: achievements_list })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/achievements/member/:memberId — get a member's achievements
// ─────────────────────────────────────────────────────────────────────────────

achievements.get('/:studioId/achievements/member/:memberId', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('achievements')
    .select(`
      id, title, description, category, icon, earned_at, feed_post_id, created_at
    `)
    .eq('studio_id', studioId)
    .eq('user_id', memberId)
    .order('earned_at', { ascending: false })

  if (error) throw new Error(error.message)

  return c.json({ achievements: data ?? [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/achievements — create achievement
// Members create own, staff can create for any member (via user_id in body)
// ─────────────────────────────────────────────────────────────────────────────

achievements.post('/:studioId/achievements', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const user = c.get('user' as never) as { id: string }
  const memberRole = c.get('memberRole' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const title = body.title as string | undefined
  const description = body.description as string | undefined
  const category = body.category as string | undefined
  const icon = body.icon as string | undefined
  const shareToFeed = body.share_to_feed as boolean | undefined
  const targetUserId = body.user_id as string | undefined

  if (!title?.trim()) {
    throw badRequest('title is required')
  }

  const validCategories = ['skill', 'milestone', 'personal', 'general']
  if (category && !validCategories.includes(category)) {
    throw badRequest(`category must be one of: ${validCategories.join(', ')}`)
  }

  // Determine the user to create the achievement for
  const staffRoles = ['teacher', 'admin', 'owner']
  const isStaff = staffRoles.includes(memberRole)
  const achievementUserId = targetUserId && isStaff ? targetUserId : user.id

  // If staff is creating for another user, verify that user is a member
  if (achievementUserId !== user.id) {
    if (!isStaff) {
      throw forbidden('Only staff can create achievements for other members')
    }
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', achievementUserId)
      .eq('studio_id', studioId)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) throw notFound('Member')
  }

  // Optionally share to feed
  let feedPostId: string | null = null
  if (shareToFeed) {
    const { data: feedPost, error: feedError } = await supabase
      .from('feed_posts')
      .insert({
        class_instance_id: null,
        user_id: achievementUserId,
        content: `${icon ?? '🏆'} Achievement unlocked: ${title.trim()}${description ? ` — ${description}` : ''}`,
        media_urls: [],
        post_type: 'achievement',
      })
      .select('id')
      .single()

    if (feedError) {
      console.error('Failed to create feed post for achievement:', feedError.message)
    } else if (feedPost) {
      feedPostId = feedPost.id
    }
  }

  const { data: achievement, error } = await supabase
    .from('achievements')
    .insert({
      user_id: achievementUserId,
      studio_id: studioId,
      title: title.trim(),
      description: description?.trim() ?? null,
      category: category ?? 'general',
      icon: icon ?? '🏆',
      feed_post_id: feedPostId,
    })
    .select(`
      id, title, description, category, icon, earned_at, feed_post_id, created_at,
      user:users!achievements_user_id_fkey(id, name, avatar_url)
    `)
    .single()

  if (error || !achievement) {
    throw new Error(`Failed to create achievement: ${error?.message}`)
  }

  const u = achievement.user as unknown as { id: string; name: string; avatar_url: string | null }
  return c.json({
    achievement: {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      category: achievement.category,
      icon: achievement.icon,
      earned_at: achievement.earned_at,
      feed_post_id: achievement.feed_post_id,
      created_at: achievement.created_at,
      user: { id: u.id, name: u.name, avatar_url: u.avatar_url },
    },
  }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:studioId/achievements/:achievementId — delete achievement
// Own achievement or staff can delete any
// ─────────────────────────────────────────────────────────────────────────────

achievements.delete('/:studioId/achievements/:achievementId', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const achievementId = c.req.param('achievementId')
  const user = c.get('user' as never) as { id: string }
  const memberRole = c.get('memberRole' as never) as string
  const supabase = createServiceClient()

  const { data: achievement } = await supabase
    .from('achievements')
    .select('id, user_id, feed_post_id')
    .eq('id', achievementId)
    .eq('studio_id', studioId)
    .single()

  if (!achievement) throw notFound('Achievement')

  const staffRoles = ['teacher', 'admin', 'owner']
  const isStaff = staffRoles.includes(memberRole)

  if (achievement.user_id !== user.id && !isStaff) {
    throw forbidden('You can only delete your own achievements')
  }

  // Delete associated feed post if exists
  if (achievement.feed_post_id) {
    await supabase.from('feed_posts').delete().eq('id', achievement.feed_post_id)
  }

  await supabase.from('achievements').delete().eq('id', achievementId)

  return c.json({ ok: true })
})

export default achievements
