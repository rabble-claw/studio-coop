// Notification routes — push token management + in-app notification center
//
// Mounted at /api/my in index.ts so paths here are:
//   POST   /push-token                     — Task 2: register device token
//   DELETE /push-token                     — Task 2: unregister device token
//   GET    /notifications                  — Task 4: list notifications
//   POST   /notifications/:id/read         — Task 4: mark single notification read
//   POST   /notifications/read-all         — Task 4: mark all notifications read
//   GET    /notifications/count            — Task 4: unread count (badge)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'
import { registerPushToken, unregisterPushToken } from '../lib/push'

const notifications = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Register device push token
// POST /api/my/push-token
// ─────────────────────────────────────────────────────────────────────────────

notifications.post('/push-token', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const token = body.token as string | undefined
  const platform = body.platform as string | undefined

  if (!token) throw badRequest('token is required')
  if (!platform || !['ios', 'android'].includes(platform)) {
    throw badRequest('platform must be ios or android')
  }

  await registerPushToken({ userId: user.id, token, platform: platform as 'ios' | 'android' })
  return c.json({ registered: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Unregister device push token
// DELETE /api/my/push-token
// ─────────────────────────────────────────────────────────────────────────────

notifications.delete('/push-token', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const token = body.token as string | undefined
  if (!token) throw badRequest('token is required')

  await unregisterPushToken(user.id, token)
  return c.json({ unregistered: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: Unread notification count (for badge)
// GET /api/my/notifications/count
// Must be before /:id route to avoid param conflict
// ─────────────────────────────────────────────────────────────────────────────

notifications.get('/notifications/count', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
    .not('sent_at', 'is', null)

  if (error) throw new Error(error.message)

  return c.json({ unreadCount: count ?? 0 })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: Mark all notifications as read
// POST /api/my/notifications/read-all
// Must be before /:id route to avoid param conflict
// ─────────────────────────────────────────────────────────────────────────────

notifications.post('/notifications/read-all', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  return c.json({ markedRead: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: List notifications
// GET /api/my/notifications?unread=true
// ─────────────────────────────────────────────────────────────────────────────

notifications.get('/notifications', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()
  const onlyUnread = c.req.query('unread') === 'true'

  let query = supabase
    .from('notifications')
    .select('id, type, title, body, data, sent_at, read_at, scheduled_for, studio_id')
    .eq('user_id', user.id)
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(50)

  if (onlyUnread) {
    query = query.is('read_at', null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return c.json({ notifications: data ?? [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: Mark single notification as read
// POST /api/my/notifications/:id/read
// ─────────────────────────────────────────────────────────────────────────────

notifications.post('/notifications/:id/read', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const notifId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: notif } = await supabase
    .from('notifications')
    .select('id, user_id, read_at')
    .eq('id', notifId)
    .single()

  if (!notif) throw notFound('Notification')
  if (notif.user_id !== user.id) throw notFound('Notification')

  if (!notif.read_at) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifId)
  }

  return c.json({ read: true })
})

export { notifications }
export default notifications
