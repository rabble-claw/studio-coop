import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, RefreshControl, SectionList, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { bookingApi, scheduleApi, feedApi } from '@/lib/api'

interface UpcomingBooking {
  id: string
  status: string
  class_instance: {
    id: string
    date: string
    start_time: string
    end_time: string
    template: { name: string } | null
    teacher: { name: string } | null
  }
}

interface AvailableClass {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  booking_count: number
  max_capacity: number
  template: { id: string; name: string } | null
  teacher: { name: string } | null
}

interface FeedPost {
  id: string
  content: string | null
  post_type: string
  created_at: string
  user: { name: string }
  class_name: string | null
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h!)
  return `${hr > 12 ? hr - 12 : hr}:${m}${hr >= 12 ? 'pm' : 'am'}`
}

export default function HomeScreen() {
  const [bookings, setBookings] = useState<UpcomingBooking[]>([])
  const [todayClasses, setTodayClasses] = useState<AvailableClass[]>([])
  const [recentPosts, setRecentPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const { user, studioId } = useAuth()
  const router = useRouter()

  const loadData = useCallback(async () => {
    if (!user || !studioId) {
      setLoading(false)
      return
    }
    setLoading(true)

    try {
      const today = new Date().toISOString().split('T')[0]

      const [bookingsData, classesData, feedData] = await Promise.all([
        bookingApi.myBookings().catch(() => []) as Promise<UpcomingBooking[]>,
        scheduleApi.list(studioId, `from=${today}&to=${today}`).catch(() => []) as Promise<AvailableClass[]>,
        feedApi.getFeed(studioId).catch(() => []) as Promise<FeedPost[]>,
      ])

      // Only show upcoming (future) bookings, sorted by date, limit 5
      setBookings((bookingsData ?? []).slice(0, 5))
      // Filter to classes with spots available
      setTodayClasses((classesData ?? []).filter(c => c.booking_count < c.max_capacity).slice(0, 5))
      setRecentPosts((feedData ?? []).slice(0, 5))
    } catch (e) {
      console.error('Failed to load home data:', e)
    } finally {
      setLoading(false)
    }
  }, [user, studioId])

  useEffect(() => { loadData() }, [loadData])

  type SectionItem = UpcomingBooking | AvailableClass | FeedPost

  const sections: Array<{ title: string; type: string; data: SectionItem[] }> = []

  if (bookings.length > 0) {
    sections.push({ title: 'Upcoming Classes', type: 'booking', data: bookings })
  }
  if (todayClasses.length > 0) {
    sections.push({ title: 'Quick Book - Today', type: 'available', data: todayClasses })
  }
  if (recentPosts.length > 0) {
    sections.push({ title: 'Recent Feed', type: 'feed', data: recentPosts })
  }

  function renderItem({ item, section }: { item: SectionItem; section: { type: string } }) {
    if (section.type === 'booking') {
      const b = item as UpcomingBooking
      const ci = b.class_instance
      return (
        <TouchableOpacity
          className="bg-card rounded-2xl border border-border p-4 mb-3"
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/(tabs)/class/[id]', params: { id: ci.id } })}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base">
                {ci.template?.name ?? 'Class'}
              </Text>
              <Text className="text-muted text-sm mt-0.5">
                {new Date(ci.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' '}{formatTime(ci.start_time)}
                {ci.teacher ? ` with ${ci.teacher.name}` : ''}
              </Text>
            </View>
            <View className="bg-green-100 rounded-full px-3 py-1">
              <Text className="text-xs text-green-700 font-medium">Booked</Text>
            </View>
          </View>
        </TouchableOpacity>
      )
    }

    if (section.type === 'available') {
      const cls = item as AvailableClass
      const spotsLeft = cls.max_capacity - cls.booking_count
      return (
        <TouchableOpacity
          className="bg-card rounded-2xl border border-border p-4 mb-3"
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/(tabs)/class/[id]', params: { id: cls.id } })}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-foreground font-semibold text-base">
                {cls.template?.name ?? 'Class'}
              </Text>
              <Text className="text-muted text-sm mt-0.5">
                {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                {cls.teacher ? ` with ${cls.teacher.name}` : ''}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-muted text-xs">{spotsLeft} spots</Text>
              <View className="mt-1 bg-primary/10 rounded-full px-3 py-1">
                <Text className="text-xs text-primary font-medium">Book</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )
    }

    // Feed post
    const p = item as FeedPost
    return (
      <View className="bg-card rounded-xl border border-border p-4 mb-3">
        <View className="flex-row items-center mb-1">
          <View className="w-7 h-7 rounded-full bg-primary/10 items-center justify-center mr-2">
            <Text className="text-primary font-bold text-xs">{p.user.name[0]}</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground">{p.user.name}</Text>
          {p.class_name && <Text className="text-muted text-xs ml-2">{p.class_name}</Text>}
        </View>
        {p.content && (
          <Text className="text-foreground text-sm" numberOfLines={2}>{p.content}</Text>
        )}
        {p.post_type === 'milestone' && (
          <View className="mt-1 self-start bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
            <Text className="text-xs text-yellow-700 font-medium">milestone</Text>
          </View>
        )}
      </View>
    )
  }

  if (!studioId && !loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-5xl mb-4">&#x1F3E0;</Text>
        <Text className="text-lg font-semibold text-foreground mb-1">No studio yet</Text>
        <Text className="text-muted text-center">Ask your studio to invite you, or create your own.</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => ('id' in item ? (item as { id: string }).id : String(index))}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        contentContainerStyle={{ padding: 16 }}
        renderSectionHeader={({ section }) => (
          <Text className="text-xl font-bold text-foreground mb-3 mt-2">{section.title}</Text>
        )}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-20">
              <ActivityIndicator size="large" />
            </View>
          ) : (
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">&#x2600;&#xFE0F;</Text>
              <Text className="text-foreground font-medium">Nothing here yet</Text>
              <Text className="text-muted text-sm mt-1">Check the schedule to book your first class.</Text>
            </View>
          )
        }
      />
    </View>
  )
}
