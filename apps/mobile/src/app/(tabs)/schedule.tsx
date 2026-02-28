import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { scheduleApi, bookingApi } from '@/lib/api'

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  booking_count: number
  max_capacity: number
  is_booked?: boolean
  template: {
    id: string
    name: string
  } | null
  teacher: { name: string } | null
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
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null)

  const weekDates = getWeekDates(weekOffset)

  const loadClasses = useCallback(async () => {
    setLoading(true)
    try {
      if (studioId) {
        const data = await scheduleApi.list(studioId, `from=${selectedDate}&to=${selectedDate}`) as ClassInstance[]
        setClasses(data ?? [])
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

  async function handleQuickBook(cls: ClassInstance) {
    if (!studioId) return
    setBookingInProgress(cls.id)
    try {
      await bookingApi.book(studioId, cls.id)
      Alert.alert('Booked!', `You're booked for ${cls.template?.name ?? 'class'}.`)
      loadClasses()
    } catch (e: any) {
      Alert.alert('Booking Failed', e.message || 'Could not book this class.')
    } finally {
      setBookingInProgress(null)
    }
  }

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
          <Text className="text-4xl mb-3">&#x1F3E0;</Text>
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
        renderItem={({ item: cls }) => {
          const spotsLeft = cls.max_capacity - cls.booking_count
          const isFull = spotsLeft <= 0
          return (
            <TouchableOpacity
              className="bg-card rounded-2xl border border-border p-4 mb-3"
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/(tabs)/class/[id]', params: { id: cls.id } })}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold text-base">{cls.template?.name ?? 'Class'}</Text>
                  <Text className="text-muted text-sm mt-0.5">
                    {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                    {cls.teacher ? ` with ${cls.teacher.name}` : ''}
                  </Text>
                  <Text className={`text-xs mt-1 ${isFull ? 'text-red-500' : 'text-muted'}`}>
                    {cls.booking_count}/{cls.max_capacity} booked
                    {spotsLeft > 0 ? ` - ${spotsLeft} spots left` : ' - Full'}
                  </Text>
                </View>
                <View className="items-end ml-3">
                  {cls.is_booked ? (
                    <View className="bg-green-100 rounded-full px-3 py-1.5">
                      <Text className="text-xs text-green-700 font-medium">Booked</Text>
                    </View>
                  ) : isFull ? (
                    <View className="bg-yellow-100 rounded-full px-3 py-1.5">
                      <Text className="text-xs text-yellow-700 font-medium">Waitlist</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="bg-primary rounded-full px-4 py-1.5"
                      onPress={(e) => {
                        e.stopPropagation?.()
                        handleQuickBook(cls)
                      }}
                      disabled={bookingInProgress === cls.id}
                    >
                      <Text className="text-xs text-white font-medium">
                        {bookingInProgress === cls.id ? 'Booking...' : 'Book'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          !loading && studioId ? (
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">&#x1F4C5;</Text>
              <Text className="text-foreground font-medium">No classes on this day</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}
