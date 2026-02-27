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

/**
 * Send a notification via one or more channels.
 *
 * Flow:
 * 1. Create a notifications DB record (persists the in_app notification)
 * 2. For each channel, dispatch to channel-specific sender (in_app is already stored)
 * 3. Update sent_at — always, even if channel dispatches fail
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createServiceClient()

  // 1. Create notification DB record
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

  // 2. Dispatch to each channel, collecting errors without aborting
  const errors: string[] = []

  for (const channel of payload.channels) {
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

  // 3. Update sent_at — in_app was delivered; external channels were attempted
  await supabase
    .from('notifications')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', notification.id)

  if (errors.length > 0) {
    console.warn(`[notifications] Channel errors for ${notification.id}:`, errors)
  }
}
