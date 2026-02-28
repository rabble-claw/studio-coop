import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { notificationApi } from './api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return null

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data

  // Register with backend
  try {
    await notificationApi.registerPush(token)
  } catch {
    // Silently fail — token will be retried next launch
  }

  return token
}

/**
 * Deep link types mapped from notification data:
 * - class_detail: navigate to class detail screen
 * - booking_confirmed: navigate to class detail screen
 * - feed_post: navigate to class detail screen (feed tab)
 * - notification: navigate to notifications screen
 */
interface NotificationData {
  type?: string
  class_id?: string
  booking_id?: string
  post_id?: string
  studio_id?: string
}

function handleNotificationNavigation(data: NotificationData) {
  const { type, class_id } = data

  switch (type) {
    case 'class_detail':
    case 'booking_confirmed':
    case 'class_reminder_24h':
    case 'class_cancelled':
    case 'waitlist_promoted':
      if (class_id) {
        router.push({ pathname: '/(tabs)/class/[id]', params: { id: class_id } })
      }
      break

    case 'feed_post':
    case 'feed_milestone':
      if (class_id) {
        router.push({ pathname: '/(tabs)/class/[id]', params: { id: class_id } })
      }
      break

    case 'payment_received':
    case 'new_achievement':
      router.push('/(tabs)/profile')
      break

    default:
      // Fall back to notifications tab
      router.push('/(tabs)/notifications')
      break
  }
}

/**
 * Set up listeners for notification taps (deep linking).
 * Call this once in the root layout after auth is established.
 * Returns a cleanup function.
 */
export function setupNotificationListeners(): () => void {
  // Handle notification tapped while app is in foreground/background
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData
    if (data) {
      handleNotificationNavigation(data)
    }
  })

  // Check if app was opened from a notification (cold start)
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const data = response.notification.request.content.data as NotificationData
      if (data) {
        // Small delay to ensure router is ready
        setTimeout(() => handleNotificationNavigation(data), 500)
      }
    }
  })

  return () => {
    responseSubscription.remove()
  }
}
