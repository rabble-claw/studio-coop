import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native'
import { notificationApi } from '@/lib/api'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  sent_at: string
  read_at: string | null
}

const TYPE_ICONS: Record<string, string> = {
  booking_confirmed: '✅',
  class_reminder_24h: '📅',
  feed_milestone: '🏆',
  waitlist_promoted: '🎉',
  class_cancelled: '❌',
  payment_received: '💳',
  reengagement: '👋',
  new_achievement: '🏅',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await notificationApi.list() as Notification[]
      setNotifications(data)
    } catch (e) {
      console.error('Failed to load notifications:', e)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  async function handleMarkRead(id: string) {
    try {
      await notificationApi.markRead(id)
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      ))
    } catch (e) {
      console.error('Failed to mark read:', e)
    }
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={notifications}
        keyExtractor={n => n.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadNotifications} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item: notif }) => (
          <TouchableOpacity
            className={`bg-card rounded-2xl border p-4 mb-3 ${notif.read_at === null ? 'border-primary/30' : 'border-border'}`}
            onPress={() => notif.read_at === null && handleMarkRead(notif.id)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-start">
              <Text className="text-2xl mr-3">{TYPE_ICONS[notif.type] || '📬'}</Text>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-foreground font-semibold text-sm flex-1">{notif.title}</Text>
                  {notif.read_at === null && (
                    <View className="w-2 h-2 rounded-full bg-primary ml-2" />
                  )}
                </View>
                <Text className="text-muted text-sm mt-0.5">{notif.body}</Text>
                <Text className="text-muted text-xs mt-1">{timeAgo(notif.sent_at)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">🔔</Text>
              <Text className="text-foreground font-medium">No notifications yet</Text>
              <Text className="text-muted text-sm mt-1">You&apos;ll see booking confirmations, reminders, and updates here.</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}
