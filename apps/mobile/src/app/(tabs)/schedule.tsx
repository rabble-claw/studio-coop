import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { scheduleApi } from '@/lib/api'

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  booked_count: number
  max_capacity: number
  is_booked: boolean
  template: {
    id: string
    name: string
    discipline_type: string
    level: string | null
  }
  teacher: { name: string }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekDates(offset: number = 0): Date[] {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() + (offset * 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hr = parseInt(h!)
  return `${hr > 12 ? hr - 12 : hr}:${m}${hr >= 12 ? 'pm' : 'am'}`
}

export default function ScheduleScreen() {
  const router = useRouter()
  const { studioId } = useAuth()
  const [classes, setClasses] = useState<ClassInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]!)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = getWeekDates(weekOffset)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    try {
      if (studioId) {
        const data = await scheduleApi.instances(studioId, `date=${selectedDate}`) as ClassInstance[]
        setClasses(data)
      } else {
        setClasses([])
      }
    } catch (e) {
      console.error('Failed to load schedule:', e)
      setClasses([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate, studioId])

  useEffect(() => { loadClasses() }, [loadClasses])

  return (
    <View className="flex-1 bg-background">
      {/* Date Picker */}
      <View className="bg-card border-b border-border px-4 py-3">
        <View className="flex-row justify-between items-center mb-3">
          <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)}>
            <Text className="text-primary text-lg">{'\u2190'} Prev</Text>
          </TouchableOpacity>
          <Text className="text-foreground font-semibold">
            {weekDates[0]!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDates[6]!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)}>
            <Text className="text-primary text-lg">Next {'\u2192'}</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row justify-between">
          {weekDates.map((date) => {
            const dateStr = date.toISOString().split('T')[0]!
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            return (
              <TouchableOpacity
                key={dateStr}
                className={`items-center px-3 py-2 rounded-xl ${isSelected ? 'bg-primary' : ''}`}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text className={`text-xs ${isSelected ? 'text-white' : 'text-muted'}`}>
                  {DAYS[date.getDay()]}
                </Text>
                <Text className={`text-lg font-bold ${isSelected ? 'text-white' : isToday ? 'text-primary' : 'text-foreground'}`}>
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {!studioId && !loading && (
        <View className="items-center py-20 px-6">
          <Text className="text-4xl mb-3">🏠</Text>
          <Text className="text-foreground font-medium text-center">No studio found</Text>
          <Text className="text-muted text-sm text-center mt-1">Join a studio to see your class schedule.</Text>
        </View>
      )}

      {/* Class List */}
      <FlatList
        data={classes}
        keyExtractor={c => c.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadClasses} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item: cls }) => (
          <TouchableOpacity
            className="bg-card rounded-2xl border border-border p-4 mb-3"
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/(tabs)/class/[id]', params: { id: cls.id } })}
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-base">{cls.template.name}</Text>
                <Text className="text-muted text-sm mt-0.5">
                  {formatTime(cls.start_time)} — {formatTime(cls.end_time)} · {cls.teacher.name}
                </Text>
                {cls.template.level && (
                  <View className="mt-1 self-start bg-secondary rounded-full px-2 py-0.5">
                    <Text className="text-xs text-foreground">Level {cls.template.level}</Text>
                  </View>
                )}
              </View>
              <View className="items-end">
                <Text className={`text-sm font-medium ${cls.booked_count >= cls.max_capacity ? 'text-red-500' : 'text-foreground'}`}>
                  {cls.booked_count}/{cls.max_capacity}
                </Text>
                {cls.is_booked ? (
                  <View className="mt-1 bg-green-100 rounded-full px-3 py-1">
                    <Text className="text-xs text-green-700 font-medium">Booked</Text>
                  </View>
                ) : cls.booked_count >= cls.max_capacity ? (
                  <View className="mt-1 bg-yellow-100 rounded-full px-3 py-1">
                    <Text className="text-xs text-yellow-700 font-medium">Waitlist</Text>
                  </View>
                ) : (
                  <View className="mt-1 bg-primary/10 rounded-full px-3 py-1">
                    <Text className="text-xs text-primary font-medium">Book</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && studioId ? (
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">📅</Text>
              <Text className="text-foreground font-medium">No classes on this day</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}
