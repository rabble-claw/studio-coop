import { createServiceClient } from './supabase'

export interface PushPayload {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Send a push notification to all registered Expo tokens for a user.
 * No-op if EXPO_ACCESS_TOKEN is not configured or user has no tokens.
 */
export async function sendPushNotification(_payload: PushPayload): Promise<void> {
  // Implemented in Task 2
}

export interface RegisterTokenPayload {
  userId: string
  token: string
  platform: 'ios' | 'android'
}

export async function registerPushToken(payload: RegisterTokenPayload): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('push_tokens').upsert(
    { user_id: payload.userId, token: payload.token, platform: payload.platform },
    { onConflict: 'user_id,token' },
  )
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token)
}
