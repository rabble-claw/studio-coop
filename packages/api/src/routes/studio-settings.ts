// Studio notification settings
//
// Mounted at /api/studios in index.ts so paths here are:
//   GET  /:studioId/settings/notifications  — get notification settings
//   PUT  /:studioId/settings/notifications  — update (owner only)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireOwner } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound } from '../lib/errors'

const studioSettings = new Hono()

// Default notification settings returned when a studio hasn't configured them
const DEFAULT_NOTIFICATION_SETTINGS = {
  reminderHours: [24, 2],
  confirmationEnabled: true,
  reengagementEnabled: true,
  reengagementDays: 14,
  feedNotifications: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/settings/notifications
// ─────────────────────────────────────────────────────────────────────────────

studioSettings.get('/:studioId/settings/notifications', authMiddleware, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const notifSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...((settings.notifications ?? {}) as Record<string, unknown>),
  }

  return c.json({ studioId, notifications: notifSettings })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/settings/notifications — owner only
// ─────────────────────────────────────────────────────────────────────────────

studioSettings.put('/:studioId/settings/notifications', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  // Fetch current studio settings
  const { data: studio } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  const currentSettings = (studio.settings ?? {}) as Record<string, unknown>

  // Build updated notification settings — merge with defaults then apply body
  const currentNotif = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...((currentSettings.notifications ?? {}) as Record<string, unknown>),
  }

  // Only allow known keys
  const updated: Record<string, unknown> = { ...currentNotif }
  if (Array.isArray(body.reminderHours)) updated.reminderHours = body.reminderHours
  if (typeof body.confirmationEnabled === 'boolean') updated.confirmationEnabled = body.confirmationEnabled
  if (typeof body.reengagementEnabled === 'boolean') updated.reengagementEnabled = body.reengagementEnabled
  if (typeof body.reengagementDays === 'number' && body.reengagementDays > 0) updated.reengagementDays = body.reengagementDays
  if (typeof body.feedNotifications === 'boolean') updated.feedNotifications = body.feedNotifications

  const newSettings = {
    ...currentSettings,
    notifications: updated,
  }

  const { error } = await supabase
    .from('studios')
    .update({ settings: newSettings })
    .eq('id', studioId)

  if (error) throw new Error(error.message)

  return c.json({ studioId, notifications: updated })
})

export { studioSettings }
export default studioSettings
