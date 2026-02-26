import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface ClassDetail {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  feed_enabled: boolean
  studio_id: string
  template: { name: string; description: string | null } | null
  teacher: { id: string; name: string } | null
}

interface Booking {
  id: string
  status: string
  user: { id: string; name: string; avatar_url: string | null }
}

interface FeedPost {
  id: string
  content: string | null
  post_type: string
  created_at: string
  user: { name: string }
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [classData, setClassData] = useState<ClassDetail | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [feed, setFeed] = useState<FeedPost[]>([])
  const [myBooking, setMyBooking] = useState<Booking | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'roster' | 'feed' | 'checkin'>('info')

  async function loadData() {
    if (!user) return
    setLoading(true)

    const { data: cls } = await supabase
      .from('class_instances')
      .select('*, template:class_templates!class_instances_template_id_fkey(name, description), teacher:users!class_instances_teacher_id_fkey(id, name)')
      .eq('id', id)
      .single()

    if (!cls) return setLoading(false)
    setClassData(cls)

    const [{ data: bks }, { data: fd }, { data: membership }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*, user:users!bookings_user_id_fkey(id, name, avatar_url)')
        .eq('class_instance_id', id)
        .in('status', ['booked', 'confirmed']),
      supabase
        .from('feed_posts')
        .select('*, user:users!feed_posts_user_id_fkey(name)')
        .eq('class_instance_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('memberships')
        .select('role')
        .eq('studio_id', cls.studio_id)
        .eq('user_id', user.id)
        .single(),
    ])

    setBookings(bks ?? [])
    setFeed(fd ?? [])
    setMyBooking((bks ?? []).find((b) => b.user.id === user.id) ?? null)
    setIsStaff(['teacher', 'admin', 'owner'].includes(membership?.role ?? ''))
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBook() {
    if (!user) return
    const { error } = await supabase.from('bookings').insert({
      class_instance_id: id,
      user_id: user.id,
      status: 'booked',
    })
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      loadData()
    }
  }

  async function handleCancel() {
    if (!myBooking) return
    await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', myBooking.id)
    loadData()
  }

  async function toggleCheckIn(userId: string) {
    if (!user) return
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_instance_id', id)
      .eq('user_id', userId)
      .single()

    if (existing) {
      await supabase.from('attendance').update({
        checked_in: !existing.checked_in,
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id,
      }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert({
        class_instance_id: id,
        user_id: userId,
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id,
      })
    }
    loadData()
  }

  if (!classData) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted">{loading ? 'Loading...' : 'Class not found'}</Text>
      </SafeAreaView>
    )
  }

  const dateStr = new Date(classData.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}>
        {/* Header */}
        <View className="px-4 pt-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-base mb-2">&larr; Back</Text>
          </TouchableOpacity>

          <Text className="text-2xl font-bold text-foreground">{classData.template?.name ?? 'Class'}</Text>
          <Text className="text-muted mt-1">{dateStr}</Text>
          <Text className="text-muted">
            {formatTime(classData.start_time)} — {formatTime(classData.end_time)}
            {classData.teacher ? ` with ${classData.teacher.name}` : ''}
          </Text>
          {classData.template?.description && (
            <Text className="text-muted mt-2">{classData.template.description}</Text>
          )}

          <View className="flex-row mt-3 gap-2">
            <View className="bg-secondary rounded-full px-3 py-1">
              <Text className="text-xs font-medium capitalize">{classData.status}</Text>
            </View>
            <View className="bg-secondary rounded-full px-3 py-1">
              <Text className="text-xs font-medium">{bookings.length}/{classData.max_capacity} booked</Text>
            </View>
          </View>

          {/* Book / Cancel */}
          {classData.status === 'scheduled' && (
            <View className="mt-4">
              {myBooking ? (
                <TouchableOpacity className="bg-red-50 border border-red-200 rounded-xl py-3 items-center" onPress={handleCancel}>
                  <Text className="text-red-600 font-semibold">Cancel Booking</Text>
                </TouchableOpacity>
              ) : bookings.length < classData.max_capacity ? (
                <TouchableOpacity className="bg-primary rounded-xl py-3 items-center" onPress={handleBook}>
                  <Text className="text-white font-semibold">Book This Class</Text>
                </TouchableOpacity>
              ) : (
                <View className="bg-secondary rounded-xl py-3 items-center">
                  <Text className="text-muted font-semibold">Class Full</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Tab bar */}
        <View className="flex-row mt-6 mx-4 bg-secondary rounded-xl p-1">
          {(['info', 'roster', ...(classData.feed_enabled ? ['feed'] : []), ...(isStaff ? ['checkin'] : [])] as const).map((t) => (
            <TouchableOpacity
              key={t}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? 'bg-card' : ''}`}
              onPress={() => setTab(t as typeof tab)}
            >
              <Text className={`text-sm font-medium ${tab === t ? 'text-foreground' : 'text-muted'}`}>
                {t === 'checkin' ? 'Check-in' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View className="px-4 mt-4 pb-8">
          {tab === 'info' && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-2">Who&apos;s going</Text>
              {bookings.map((b) => (
                <View key={b.id} className="flex-row items-center py-2 border-b border-border">
                  <View className="w-9 h-9 rounded-full bg-secondary items-center justify-center mr-3">
                    <Text className="font-semibold text-sm">
                      {b.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </Text>
                  </View>
                  <Text className="text-foreground">{b.user.name}</Text>
                </View>
              ))}
              {bookings.length === 0 && <Text className="text-muted">No one booked yet</Text>}
            </View>
          )}

          {tab === 'roster' && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-2">Full Roster</Text>
              {bookings.map((b, i) => (
                <View key={b.id} className="flex-row items-center justify-between py-3 border-b border-border">
                  <View className="flex-row items-center">
                    <Text className="text-muted w-6">{i + 1}.</Text>
                    <Text className="text-foreground font-medium">{b.user.name}</Text>
                  </View>
                  <View className="bg-secondary rounded-full px-2 py-0.5">
                    <Text className="text-xs text-muted capitalize">{b.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {tab === 'feed' && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-2">Class Feed</Text>
              {feed.length === 0 ? (
                <Text className="text-muted">No posts yet. Attendees can post after class.</Text>
              ) : (
                feed.map((post) => (
                  <View key={post.id} className="bg-card rounded-xl border border-border p-4 mb-3">
                    <Text className="font-semibold text-foreground">{post.user.name}</Text>
                    <Text className="text-muted text-xs">{new Date(post.created_at).toLocaleString()}</Text>
                    {post.content && <Text className="text-foreground mt-2">{post.content}</Text>}
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'checkin' && isStaff && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-1">Check-in</Text>
              <Text className="text-muted text-sm mb-4">Tap to toggle attendance</Text>
              <View className="flex-row flex-wrap gap-3">
                {bookings.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    className="items-center w-20"
                    onPress={() => toggleCheckIn(b.user.id)}
                    activeOpacity={0.7}
                  >
                    <View className="w-16 h-16 rounded-2xl bg-secondary items-center justify-center border-2 border-border">
                      <Text className="text-xl font-bold">
                        {b.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-xs font-medium text-foreground mt-1 text-center" numberOfLines={1}>
                      {b.user.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
