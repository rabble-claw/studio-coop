import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { badRequest, forbidden, notFound } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'

// ─── Helper: verify user can access feed for a class ─────────────────────────

async function verifyFeedAccess(classId: string, userId: string) {
  const supabase = createServiceClient()

  const { data: cls } = await supabase
    .from('class_instances')
    .select('id, studio_id, feed_enabled')
    .eq('id', classId)
    .single()

  if (!cls) throw notFound('Class instance')

  // Check if attendee (checked in)
  const { data: att } = await supabase
    .from('attendance')
    .select('id')
    .eq('class_instance_id', classId)
    .eq('user_id', userId)
    .eq('checked_in', true)
    .maybeSingle()

  if (att) return { ...cls, isStaff: false }

  // Check if staff for the studio
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('studio_id', cls.studio_id)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  const staffRoles = ['teacher', 'admin', 'owner']
  if (membership && staffRoles.includes(membership.role)) {
    return { ...cls, isStaff: true }
  }

  throw forbidden('Only checked-in attendees and staff can access the feed')
}

// ─── Reaction summary helper ──────────────────────────────────────────────────

function groupReactions(
  reactions: Array<{ post_id: string; emoji: string; user_id: string }>,
  viewerId: string,
): Record<string, Array<{ emoji: string; count: number; reacted: boolean }>> {
  const byPost: Record<string, Array<{ emoji: string; count: number; reacted: boolean }>> = {}
  for (const r of reactions) {
    if (!byPost[r.post_id]) byPost[r.post_id] = []
    const existing = byPost[r.post_id].find((x) => x.emoji === r.emoji)
    if (existing) {
      existing.count++
      if (r.user_id === viewerId) existing.reacted = true
    } else {
      byPost[r.post_id].push({ emoji: r.emoji, count: 1, reacted: r.user_id === viewerId })
    }
  }
  return byPost
}

// ─── Class-level feed routes (mounted at /api/classes) ───────────────────────

export const classFeed = new Hono()

// GET /api/classes/:classId/feed
classFeed.get('/:classId/feed', authMiddleware, async (c) => {
  const classId = c.req.param('classId')
  const user = c.get('user')
  const supabase = createServiceClient()

  await verifyFeedAccess(classId, user.id)

  const { data: posts } = await supabase
    .from('feed_posts')
    .select('id, content, media_urls, post_type, created_at, user:users!feed_posts_user_id_fkey(id, name, avatar_url)')
    .eq('class_instance_id', classId)
    .order('created_at', { ascending: false })

  const postIds = (posts ?? []).map((p) => p.id)

  let reactionsByPost: Record<string, Array<{ emoji: string; count: number; reacted: boolean }>> = {}

  if (postIds.length > 0) {
    const { data: reactions } = await supabase
      .from('feed_reactions')
      .select('post_id, emoji, user_id')
      .in('post_id', postIds)

    reactionsByPost = groupReactions(reactions ?? [], user.id)
  }

  const result = (posts ?? []).map((p) => {
    const u = p.user as { id: string; name: string; avatar_url: string | null }
    return {
      id: p.id,
      content: p.content,
      media_urls: p.media_urls,
      post_type: p.post_type,
      created_at: p.created_at,
      author: { id: u.id, name: u.name, avatar_url: u.avatar_url ?? null },
      reactions: reactionsByPost[p.id] ?? [],
    }
  })

  return c.json(result)
})

// POST /api/classes/:classId/feed
classFeed.post('/:classId/feed', authMiddleware, async (c) => {
  const classId = c.req.param('classId')
  const user = c.get('user')
  const supabase = createServiceClient()

  await verifyFeedAccess(classId, user.id)

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const content = body.content as string | undefined
  const mediaUrls = body.media_urls as string[] | undefined

  if (!content?.trim() && (!mediaUrls || mediaUrls.length === 0)) {
    throw badRequest('Post must have content or media')
  }

  const { data: post, error } = await supabase
    .from('feed_posts')
    .insert({
      class_instance_id: classId,
      user_id: user.id,
      content: content?.trim() ?? null,
      media_urls: mediaUrls ?? [],
      post_type: 'post',
    })
    .select('id, content, media_urls, post_type, created_at, user:users!feed_posts_user_id_fkey(id, name, avatar_url)')
    .single()

  if (error || !post) throw badRequest('Failed to create post')

  const u = post.user as { id: string; name: string; avatar_url: string | null }
  return c.json({
    id: post.id,
    content: post.content,
    media_urls: post.media_urls,
    post_type: post.post_type,
    created_at: post.created_at,
    author: { id: u.id, name: u.name, avatar_url: u.avatar_url ?? null },
    reactions: [],
  }, 201)
})

// ─── Post-level routes (mounted at /api/feed) ────────────────────────────────

export const postFeed = new Hono()

// DELETE /api/feed/:postId
postFeed.delete('/:postId', authMiddleware, async (c) => {
  const postId = c.req.param('postId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const { data: post } = await supabase
    .from('feed_posts')
    .select('id, user_id, class_instance_id')
    .eq('id', postId)
    .single()

  if (!post) throw notFound('Post')

  if (post.user_id !== user.id) {
    // Check staff access for the class's studio
    const { data: cls } = await supabase
      .from('class_instances')
      .select('studio_id')
      .eq('id', post.class_instance_id)
      .single()

    if (!cls) throw notFound('Class instance')

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('studio_id', cls.studio_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    const staffRoles = ['teacher', 'admin', 'owner']
    if (!membership || !staffRoles.includes(membership.role)) {
      throw forbidden('You can only delete your own posts')
    }
  }

  await supabase.from('feed_posts').delete().eq('id', postId)
  return c.json({ ok: true })
})

// POST /api/feed/:postId/react
postFeed.post('/:postId/react', authMiddleware, async (c) => {
  const postId = c.req.param('postId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const emoji = body.emoji as string | undefined

  if (!emoji) throw badRequest('emoji is required')

  const allowedEmojis = ['❤️', '🔥', '👏']
  if (!allowedEmojis.includes(emoji)) {
    throw badRequest(`emoji must be one of: ${allowedEmojis.join(', ')}`)
  }

  const { data: post } = await supabase
    .from('feed_posts')
    .select('id, class_instance_id')
    .eq('id', postId)
    .single()

  if (!post) throw notFound('Post')

  await verifyFeedAccess(post.class_instance_id, user.id)

  const { error } = await supabase
    .from('feed_reactions')
    .upsert(
      { post_id: postId, user_id: user.id, emoji },
      { onConflict: 'post_id,user_id,emoji' },
    )

  if (error) throw badRequest('Failed to add reaction')

  return c.json({ ok: true }, 201)
})

// DELETE /api/feed/:postId/react
postFeed.delete('/:postId/react', authMiddleware, async (c) => {
  const postId = c.req.param('postId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const emoji = body.emoji as string | undefined

  if (!emoji) throw badRequest('emoji is required')

  await supabase
    .from('feed_reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)

  return c.json({ ok: true })
})

// ─── Studio-level feed route (mounted at /api/studios) ───────────────────────

export const studioFeed = new Hono()

// GET /api/studios/:studioId/feed
studioFeed.get('/:studioId/feed', authMiddleware, async (c) => {
  const studioId = c.req.param('studioId')
  const user = c.get('user')
  const supabase = createServiceClient()

  // Verify user is an active member of this studio
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('studio_id', studioId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) throw forbidden('You must be a member of this studio')

  // Get all class instance IDs for this studio
  const { data: instances } = await supabase
    .from('class_instances')
    .select('id')
    .eq('studio_id', studioId)

  const classIds = (instances ?? []).map((i) => i.id)
  if (classIds.length === 0) return c.json([])

  const { data: posts } = await supabase
    .from('feed_posts')
    .select('id, content, media_urls, post_type, created_at, class_instance_id, user:users!feed_posts_user_id_fkey(id, name, avatar_url), class_instance:class_instances!feed_posts_class_instance_id_fkey(id, date, template:class_templates!class_instances_template_id_fkey(name))')
    .in('class_instance_id', classIds)
    .order('created_at', { ascending: false })
    .limit(50)

  const postIds = (posts ?? []).map((p) => p.id)
  let reactionsByPost: Record<string, Array<{ emoji: string; count: number; reacted: boolean }>> = {}

  if (postIds.length > 0) {
    const { data: reactions } = await supabase
      .from('feed_reactions')
      .select('post_id, emoji, user_id')
      .in('post_id', postIds)

    reactionsByPost = groupReactions(reactions ?? [], user.id)
  }

  const result = (posts ?? []).map((p) => {
    const u = p.user as { id: string; name: string; avatar_url: string | null }
    const ci = p.class_instance as { id: string; date: string; template: { name: string } | null } | null
    return {
      id: p.id,
      content: p.content,
      media_urls: p.media_urls,
      post_type: p.post_type,
      created_at: p.created_at,
      class_instance_id: p.class_instance_id,
      class_instance: ci ? { id: ci.id, date: ci.date, template: ci.template } : null,
      author: { id: u.id, name: u.name, avatar_url: u.avatar_url ?? null },
      reactions: reactionsByPost[p.id] ?? [],
    }
  })

  return c.json(result)
})

export default classFeed
