// Studio settings — general info, notification, and cancellation policy
//
// Mounted at /api/studios in index.ts so paths here are:
//   GET  /:studioId/settings                   — get full settings (studio info + notifications + cancellation)
//   PUT  /:studioId/settings/general           — update name, description, contact info (owner only)
//   GET  /:studioId/settings/notifications     — get notification settings
//   PUT  /:studioId/settings/notifications     — update (owner only)
//   PUT  /:studioId/settings/cancellation      — update cancellation policy (owner only)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireOwner, requireMember } from '../middleware/studio-access'
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

// Default cancellation policy
const DEFAULT_CANCELLATION_POLICY = {
  hours_before: 12,
  late_cancel_fee_cents: 0,
  no_show_fee_cents: 0,
  allow_self_cancel: true,
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/settings — full settings (any member)
// ─────────────────────────────────────────────────────────────────────────────

studioSettings.get('/:studioId/settings', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: studio } = await supabase
    .from('studios')
    .select('id, name, slug, description, settings')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  const settings = (studio.settings ?? {}) as Record<string, unknown>

  return c.json({
    studioId,
    general: {
      name: studio.name,
      slug: studio.slug,
      description: studio.description,
      address: settings.address ?? '',
      city: settings.city ?? '',
      country: settings.country ?? '',
      timezone: settings.timezone ?? 'Pacific/Auckland',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      website: settings.website ?? '',
    },
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...((settings.notifications ?? {}) as Record<string, unknown>),
    },
    cancellation: {
      ...DEFAULT_CANCELLATION_POLICY,
      ...((settings.cancellation ?? {}) as Record<string, unknown>),
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/settings/general — update studio info (owner only)
// ─────────────────────────────────────────────────────────────────────────────

studioSettings.put('/:studioId/settings/general', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const { data: studio } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  const currentSettings = (studio.settings ?? {}) as Record<string, unknown>

  // Update top-level studio columns
  const studioUpdates: Record<string, unknown> = {}
  if (typeof body.name === 'string') studioUpdates.name = body.name
  if (typeof body.slug === 'string') studioUpdates.slug = body.slug
  if (typeof body.description === 'string') studioUpdates.description = body.description

  // Update settings JSONB for contact/location fields
  const newSettings = { ...currentSettings }
  for (const key of ['address', 'city', 'country', 'timezone', 'phone', 'email', 'website']) {
    if (typeof body[key] === 'string') {
      newSettings[key] = body[key]
    }
  }
  studioUpdates.settings = newSettings

  const { error } = await supabase
    .from('studios')
    .update(studioUpdates)
    .eq('id', studioId)

  if (error) throw new Error(error.message)

  return c.json({ studioId, updated: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/settings/cancellation — update cancellation policy (owner only)
// ─────────────────────────────────────────────────────────────────────────────

studioSettings.put('/:studioId/settings/cancellation', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const { data: studio } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', studioId)
    .single()

  if (!studio) throw notFound('Studio')

  const currentSettings = (studio.settings ?? {}) as Record<string, unknown>
  const currentCancellation = {
    ...DEFAULT_CANCELLATION_POLICY,
    ...((currentSettings.cancellation ?? {}) as Record<string, unknown>),
  }

  // Only allow known keys
  const updated: Record<string, unknown> = { ...currentCancellation }
  if (typeof body.hours_before === 'number' && body.hours_before >= 0) updated.hours_before = body.hours_before
  if (typeof body.late_cancel_fee_cents === 'number' && body.late_cancel_fee_cents >= 0) updated.late_cancel_fee_cents = body.late_cancel_fee_cents
  if (typeof body.no_show_fee_cents === 'number' && body.no_show_fee_cents >= 0) updated.no_show_fee_cents = body.no_show_fee_cents
  if (typeof body.allow_self_cancel === 'boolean') updated.allow_self_cancel = body.allow_self_cancel

  const newSettings = {
    ...currentSettings,
    cancellation: updated,
  }

  const { error } = await supabase
    .from('studios')
    .update({ settings: newSettings })
    .eq('id', studioId)

  if (error) throw new Error(error.message)

  return c.json({ studioId, cancellation: updated })
})

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
