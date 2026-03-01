import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl,
  TextInput, Image, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth-context'
import { api, scheduleApi, bookingApi, feedApi, paymentApi } from '@/lib/api'
import { usePaymentSheet } from '@/lib/use-payment-sheet'

interface ClassDetail {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  booking_count: number
  feed_enabled: boolean
  studio_id: string
  notes: string | null
  template: { id: string; name: string; description: string | null } | null
  teacher: { id: string; name: string; avatar_url: string | null } | null
}

interface Booking {
  id: string
  status: string
  user: { id: string; name: string; avatar_url: string | null }
}

interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}

interface FeedPost {
  id: string
  content: string | null
  media_urls: string[] | null
  post_type: string
  created_at: string
  user: { id: string; name: string; avatar_url: string | null }
  reactions: Reaction[]
}

const REACTION_EMOJIS = ['\u2764\uFE0F', '\uD83D\uDD25', '\uD83D\uDC4F']

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, studioId } = useAuth()
  const router = useRouter()
  const [classData, setClassData] = useState<ClassDetail | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [feed, setFeed] = useState<FeedPost[]>([])
  const [myBooking, setMyBooking] = useState<Booking | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [tab, setTab] = useState<'info' | 'roster' | 'feed'>('info')

  // Drop-in payment
  const [dropInLoading, setDropInLoading] = useState(false)
  const { openPaymentSheet } = usePaymentSheet({
    onSuccess: () => {
      Alert.alert('Payment Complete', 'Your drop-in is confirmed. You are booked for this class.')
      loadData()
    },
  })

  // Feed composer
  const [postText, setPostText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadFeed = useCallback(async (_userId?: string) => {
    if (!id) return
    try {
      const data = await feedApi.getFeed(id) as FeedPost[]
      setFeed(data ?? [])
    } catch (e) {
      console.error('Failed to load class feed:', e)
    }
  }, [id])

  const loadData = useCallback(async () => {
    if (!user || !studioId) return
    setLoading(true)

    try {
      // Load class detail from API
      const cls = await scheduleApi.instanceDetail(studioId, id) as any
      if (!cls) { setLoading(false); return }
      setClassData(cls as ClassDetail)

      // Use bookings from API response if available, otherwise empty
      const bks: Booking[] = cls.bookings ?? []
      setBookings(bks)
      setMyBooking(bks.find((b: Booking) => b.user?.id === user.id) ?? null)
      setIsStaff(cls.is_staff ?? false)
      await loadFeed()
    } catch (e) {
      console.error('Failed to load class detail:', e)
    } finally {
      setLoading(false)
    }
  }, [id, user, studioId, loadFeed])

  useEffect(() => { loadData() }, [loadData])

  async function handleBook() {
    if (!user || !studioId) return
    setBookingLoading(true)
    try {
      await bookingApi.book(studioId, id)
      Alert.alert('Booked!', 'You have been booked for this class.')
      loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to book class.')
    } finally {
      setBookingLoading(false)
    }
  }

  async function handleCancel() {
    if (!myBooking) return
    setBookingLoading(true)
    try {
      await bookingApi.cancel(myBooking.id)
      Alert.alert('Cancelled', 'Your booking has been cancelled.')
      loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to cancel booking.')
    } finally {
      setBookingLoading(false)
    }
  }

  async function handleDropIn() {
    if (!user || !studioId) return
    setDropInLoading(true)
    try {
      const { clientSecret, amount, currency } = await paymentApi.dropIn(studioId, id)
      const priceLabel = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount / 100)

      Alert.alert(
        'Drop-in Payment',
        `This class requires a ${priceLabel} drop-in fee. Continue to payment?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setDropInLoading(false) },
          {
            text: 'Pay',
            onPress: async () => {
              await openPaymentSheet(clientSecret, 'Studio Co-op')
              setDropInLoading(false)
            },
          },
        ],
      )
    } catch (e: any) {
      // If the error indicates no drop-in plan, fall back to regular booking
      if (e.message?.includes('drop-in plan')) {
        handleBook()
      } else {
        Alert.alert('Error', e.message || 'Could not start drop-in payment')
      }
      setDropInLoading(false)
    }
  }

  async function submitPost() {
    if (!postText.trim() || !user || !classData || !studioId) return
    setSubmitting(true)

    try {
      await feedApi.createPost(id, {
        content: postText.trim(),
        class_instance_id: id,
      })
      setPostText('')
      await loadFeed(user.id)
    } catch (e) {
      Alert.alert('Error', 'Failed to post. Try again.')
    }
    setSubmitting(false)
  }

  async function toggleReaction(postId: string, emoji: string) {
    if (!user) return
    try {
      await feedApi.react(postId, emoji)
      await loadFeed()
    } catch (e) {
      console.error('Failed to toggle reaction:', e)
    }
  }

  async function deletePost(postId: string) {
    try {
      await api.delete(`/api/feed/${postId}`)
      await loadFeed()
    } catch (e) {
      console.error('Failed to delete post:', e)
    }
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

  const tabs = [
    'info',
    'roster',
    ...(classData.feed_enabled ? ['feed'] : []),
  ] as const

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
                <TouchableOpacity
                  className="bg-red-50 border border-red-200 rounded-xl py-3 items-center"
                  onPress={handleCancel}
                  disabled={bookingLoading}
                >
                  <Text className="text-red-600 font-semibold">
                    {bookingLoading ? 'Cancelling...' : 'Cancel Booking'}
                  </Text>
                </TouchableOpacity>
              ) : bookings.length < classData.max_capacity ? (
                <View className="gap-2">
                  <TouchableOpacity
                    className="bg-primary rounded-xl py-3 items-center"
                    onPress={handleBook}
                    disabled={bookingLoading || dropInLoading}
                  >
                    <Text className="text-white font-semibold">
                      {bookingLoading ? 'Booking...' : 'Book This Class'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-card border border-primary rounded-xl py-3 items-center flex-row justify-center"
                    onPress={handleDropIn}
                    disabled={bookingLoading || dropInLoading}
                  >
                    {dropInLoading ? (
                      <ActivityIndicator color="#e85d4a" size="small" />
                    ) : (
                      <Text className="text-primary font-semibold">Drop-in (Pay Per Class)</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  className="bg-yellow-50 border border-yellow-200 rounded-xl py-3 items-center"
                  onPress={async () => {
                    if (!studioId) return
                    setBookingLoading(true)
                    try {
                      await bookingApi.joinWaitlist(studioId, id)
                      Alert.alert('Waitlisted!', 'You have been added to the waitlist.')
                      loadData()
                    } catch (e: any) {
                      Alert.alert('Error', e.message || 'Failed to join waitlist.')
                    } finally {
                      setBookingLoading(false)
                    }
                  }}
                  disabled={bookingLoading}
                >
                  <Text className="text-yellow-700 font-semibold">
                    {bookingLoading ? 'Joining...' : 'Class Full \u2014 Join Waitlist'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Check-in button for staff */}
          {isStaff && (
            <TouchableOpacity
              className="mt-3 bg-secondary rounded-xl py-3 items-center"
              onPress={() => router.push({ pathname: '/(tabs)/class/[id]/checkin', params: { id } })}
            >
              <Text className="text-foreground font-semibold">Open Check-in</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab bar */}
        <View className="flex-row mt-6 mx-4 bg-secondary rounded-xl p-1">
          {tabs.map((t) => (
            <TouchableOpacity
              key={t}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? 'bg-card' : ''}`}
              onPress={() => setTab(t as typeof tab)}
            >
              <Text className={`text-sm font-medium ${tab === t ? 'text-foreground' : 'text-muted'}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View className="px-4 mt-4 pb-8">
          {tab === 'info' && (
            <View className="gap-4">
              <Text className="text-lg font-semibold text-foreground">Class Details</Text>

              {classData.template?.description && (
                <View>
                  <Text className="text-muted text-sm font-medium mb-1">Description</Text>
                  <Text className="text-foreground">{classData.template.description}</Text>
                </View>
              )}

              {classData.teacher && (
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                    <Text className="text-primary font-bold">
                      {classData.teacher.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-muted text-sm">Teacher</Text>
                    <Text className="text-foreground font-medium">{classData.teacher.name}</Text>
                  </View>
                </View>
              )}

              <View className="flex-row gap-4">
                <View className="flex-1 bg-secondary rounded-xl p-3">
                  <Text className="text-muted text-xs">Date</Text>
                  <Text className="text-foreground font-medium text-sm">{dateStr}</Text>
                </View>
                <View className="flex-1 bg-secondary rounded-xl p-3">
                  <Text className="text-muted text-xs">Time</Text>
                  <Text className="text-foreground font-medium text-sm">
                    {formatTime(classData.start_time)} - {formatTime(classData.end_time)}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1 bg-secondary rounded-xl p-3">
                  <Text className="text-muted text-xs">Capacity</Text>
                  <Text className="text-foreground font-medium text-sm">{bookings.length}/{classData.max_capacity}</Text>
                </View>
                <View className="flex-1 bg-secondary rounded-xl p-3">
                  <Text className="text-muted text-xs">Status</Text>
                  <Text className="text-foreground font-medium text-sm capitalize">{classData.status}</Text>
                </View>
              </View>

              {classData.notes && (
                <View>
                  <Text className="text-muted text-sm font-medium mb-1">Notes</Text>
                  <Text className="text-foreground">{classData.notes}</Text>
                </View>
              )}
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
              <Text className="text-lg font-semibold text-foreground mb-3">Class Feed</Text>

              {/* Composer */}
              <View className="bg-card rounded-xl border border-border p-3 mb-4">
                <TextInput
                  style={{ color: '#111827', fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
                  placeholder="Share a moment from class..."
                  placeholderTextColor="#9ca3af"
                  value={postText}
                  onChangeText={setPostText}
                  multiline
                />
                <TouchableOpacity
                  className={`self-end px-4 py-2 rounded-lg mt-2 ${postText.trim() && !submitting ? 'bg-primary' : 'bg-secondary'}`}
                  onPress={submitPost}
                  disabled={!postText.trim() || submitting}
                >
                  <Text className={`text-sm font-semibold ${postText.trim() && !submitting ? 'text-white' : 'text-muted'}`}>
                    {submitting ? 'Posting...' : 'Post'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Posts */}
              {feed.length === 0 ? (
                <Text className="text-muted text-center py-4">No posts yet. Be the first to share!</Text>
              ) : (
                feed.map((post) => (
                  <View key={post.id} className="bg-card rounded-xl border border-border p-4 mb-3">
                    {/* Author row */}
                    <View className="flex-row items-center mb-2">
                      <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center mr-2">
                        <Text className="font-semibold text-xs">
                          {post.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground text-sm">{post.user.name}</Text>
                        <Text className="text-muted text-xs">{new Date(post.created_at).toLocaleString()}</Text>
                      </View>
                      {(post.user.id === user?.id || isStaff) && (
                        <TouchableOpacity onPress={() => deletePost(post.id)}>
                          <Text className="text-xs text-muted">Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {post.content && (
                      <Text className="text-foreground mb-2">{post.content}</Text>
                    )}

                    {/* Media */}
                    {post.media_urls && post.media_urls.length > 0 && (
                      <View className="flex-row flex-wrap gap-1 mb-2">
                        {post.media_urls.map((url, i) => (
                          <Image
                            key={i}
                            source={{ uri: url }}
                            className="rounded-lg"
                            style={{ width: post.media_urls!.length > 1 ? '48%' : '100%', height: 160 }}
                            resizeMode="cover"
                          />
                        ))}
                      </View>
                    )}

                    {/* Reaction buttons */}
                    <View className="flex-row gap-2 flex-wrap mt-1">
                      {REACTION_EMOJIS.map((emoji) => {
                        const r = post.reactions.find((x) => x.emoji === emoji)
                        return (
                          <TouchableOpacity
                            key={emoji}
                            onPress={() => toggleReaction(post.id, emoji)}
                            className={`flex-row items-center px-3 py-1 rounded-full border ${
                              r?.reacted ? 'border-primary bg-primary/10' : 'border-border'
                            }`}
                          >
                            <Text className="text-base">{emoji}</Text>
                            {r && r.count > 0 && (
                              <Text className={`text-xs ml-1 font-medium ${r.reacted ? 'text-primary' : 'text-muted'}`}>
                                {r.count}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
