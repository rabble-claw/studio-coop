import Expo, { type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk'
import { createServiceClient } from './supabase'

export interface PushPayload {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}

export interface RegisterTokenPayload {
  userId: string
  token: string
  platform: 'ios' | 'android'
}

let _expo: Expo | null = null

function getExpoClient(): Expo {
  if (!_expo) {
    _expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })
  }
  return _expo
}

/**
 * Send a push notification to all registered Expo tokens for a user.
 * No-op if user has no registered tokens.
 * Invalid/expired tokens are removed from the DB automatically.
 */
export async function sendPushNotification(payload: PushPayload): Promise<void> {
  const supabase = createServiceClient()

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('id, token')
    .eq('user_id', payload.userId)

  if (!tokens || tokens.length === 0) return

  const expo = getExpoClient()
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.token))
  if (validTokens.length === 0) return

  const messages: ExpoPushMessage[] = validTokens.map((t) => ({
    to: t.token,
    sound: 'default' as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }))

  const chunks = expo.chunkPushNotifications(messages)
  const invalidTokenIds: string[] = []

  for (const chunk of chunks) {
    let tickets: ExpoPushTicket[]
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk)
    } catch {
      continue
    }

    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        const details = (ticket as any).details
        if (details?.error === 'DeviceNotRegistered') {
          const tokenId = validTokens[i]?.id
          if (tokenId) invalidTokenIds.push(tokenId)
        }
      }
    })
  }

  if (invalidTokenIds.length > 0) {
    await supabase.from('push_tokens').delete().in('id', invalidTokenIds)
  }
}

/**
 * Register (upsert) a device push token for a user.
 */
export async function registerPushToken(payload: RegisterTokenPayload): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: payload.userId, token: payload.token, platform: payload.platform },
      { onConflict: 'user_id,token' },
    )
}

/**
 * Remove a device push token (called on logout).
 */
export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token)
}
