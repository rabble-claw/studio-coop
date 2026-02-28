import { useEffect, useState } from 'react'
import { View, Text, SectionList, TouchableOpacity, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { studioApi, scheduleApi } from '@/lib/api'

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  booking_count: number
  template: { name: string; description: string | null } | null
  teacher: { name: string } | null
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}

function formatDateHeader(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export default function StudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [studioName, setStudioName] = useState('')
  const [classes, setClasses] = useState<ClassInstance[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function loadSchedule() {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      // Calculate 30 days from now
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const to = endDate.toISOString().split('T')[0]

      const [studioData, classesData] = await Promise.all([
        studioApi.get(id).catch(() => null) as Promise<{ name: string } | null>,
        scheduleApi.list(id, `from=${today}&to=${to}`).catch(() => []) as Promise<ClassInstance[]>,
      ])

      setStudioName((studioData as any)?.name ?? '')
      setClasses(classesData ?? [])
    } catch (e) {
      console.error('Failed to load studio schedule:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedule()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Group by date
  const sections = Object.entries(
    classes.reduce<Record<string, ClassInstance[]>>((acc, cls) => {
      if (!acc[cls.date]) acc[cls.date] = []
      acc[cls.date].push(cls)
      return acc
    }, {})
  ).map(([date, data]) => ({ title: formatDateHeader(date), data }))

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-base mb-2">&larr; Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-foreground">{studioName}</Text>
        <Text className="text-muted">Class Schedule</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSchedule} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-20">
              <Text className="text-muted">No upcoming classes</Text>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <Text className="text-sm font-semibold text-muted uppercase tracking-wider mt-6 mb-2">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-card rounded-xl border border-border p-4 mb-2"
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/(tabs)/class/[id]', params: { id: item.id } })}
          >
            <Text className="font-semibold text-foreground text-base">{item.template?.name ?? 'Class'}</Text>
            <Text className="text-muted text-sm mt-1">
              {formatTime(item.start_time)} — {formatTime(item.end_time)}
              {item.teacher ? ` with ${item.teacher.name}` : ''}
            </Text>
            {item.template?.description && (
              <Text className="text-muted text-sm mt-1" numberOfLines={2}>{item.template.description}</Text>
            )}
            <Text className="text-muted text-xs mt-2">
              {item.booking_count !== undefined ? `${item.booking_count}/` : ''}{item.max_capacity} spots
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}
