import { createServiceClient } from './supabase'
import { sendPushNotification } from './push'
import { sendEmailForNotification } from './email'

export interface NotificationPayload {
  userId: string
  studioId: string
  type: string  // 'booking_confirmed', 'class_reminder_24h', 'waitlist_promoted', etc.
  title: string
  body: string
  data?: Record<string, string>  // deep link info
  channels: ('push' | 'email' | 'in_app')[]
}

interface UserPrefs {
  push: boolean
  email: boolean
  reminders: boolean
  feed: boolean
  marketing: boolean
}

// Notification types that fall under each preference key
const REMINDER_TYPES = new Set(['class_reminder_24h', 'class_reminder_2h'])
const FEED_TYPES = new Set(['class_completed', 'feed_milestone'])
const MARKETING_TYPES = new Set(['reengagement', 'promotion'])

/** Fetch user notification preferences, returning defaults if no row exists. */
async function getUserPrefs(userId: string): Promise<UserPrefs> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('notification_preferences')
    .select('push, email, reminders, feed, marketing')
    .eq('user_id', userId)
    .maybeSingle()
  return {
    push: data?.push ?? true,
    email: data?.email ?? true,
    reminders: data?.reminders ?? true,
    feed: data?.feed ?? true,
    marketing: data?.marketing ?? false,
  }
}

/** Returns true if the notification type is allowed by the user's preferences. */
function isTypeAllowed(type: string, prefs: UserPrefs): boolean {
  if (REMINDER_TYPES.has(type) && !prefs.reminders) return false
  if (FEED_TYPES.has(type) && !prefs.feed) return false
  if (MARKETING_TYPES.has(type) && !prefs.marketing) return false
  return true
}

/**
 * Send a notification via one or more channels.
 *
 * Flow:
 * 1. Check user's notification preferences; skip channels the user opted out of
 * 2. Create a notifications DB record (persists the in_app notification)
 * 3. For each allowed channel, dispatch to channel-specific sender
 * 4. Update sent_at on success
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createServiceClient()

  // 1. Load preferences and filter channels
  const prefs = await getUserPrefs(payload.userId)

  if (!isTypeAllowed(payload.type, prefs)) return

  const allowedChannels = payload.channels.filter((channel) => {
    if (channel === 'push' && !prefs.push) return false
    if (channel === 'email' && !prefs.email) return false
    return true
  })

  // If all external channels are blocked and we only had in_app, still record it
  const effectiveChannels = allowedChannels.length > 0 ? allowedChannels : ['in_app' as const]

  // 2. Create notification DB record
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id: payload.userId,
      studio_id: payload.studioId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? null,
    })
    .select('id')
    .single()

  if (error || !notification) {
    throw new Error(`Failed to create notification record: ${error?.message ?? 'unknown'}`)
  }

  // 3. Dispatch to each allowed channel, collecting errors without aborting
  const errors: string[] = []

  for (const channel of effectiveChannels) {
    try {
      if (channel === 'push') {
        await sendPushNotification({
          userId: payload.userId,
          title: payload.title,
          body: payload.body,
          data: payload.data,
        })
      } else if (channel === 'email') {
        await sendEmailForNotification({
          userId: payload.userId,
          studioId: payload.studioId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
        })
      }
      // 'in_app' channel is already stored via the DB insert above
    } catch (err) {
      errors.push(`${channel}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 4. Update sent_at — in_app was delivered; external channels were attempted
  await supabase
    .from('notifications')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', notification.id)

  if (errors.length > 0) {
    console.warn(`[notifications] Channel errors for ${notification.id}:`, errors)
  }
}
