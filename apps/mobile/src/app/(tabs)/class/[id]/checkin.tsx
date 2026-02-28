import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassInfo {
  id: string
  date: string
  start_time: string
  status: string
  max_capacity: number
  studio_id: string
  template: { name: string } | null
  teacher: { name: string } | null
}

interface RosterEntry {
  userId: string
  name: string
  avatarUrl: string | null
  bookingId: string | null
  bookingStatus: string | null
  spot: string | null
  checkedIn: boolean
  walkIn: boolean
  notes: string | null
  dirty: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [saving, setSaving] = useState(false)

  // Walk-in modal
  const [walkInVisible, setWalkInVisible] = useState(false)
  const [walkInEmail, setWalkInEmail] = useState('')
  const [walkInBusy, setWalkInBusy] = useState(false)
  const [walkInError, setWalkInError] = useState('')

  // ─── Load data ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return

    const { data: cls } = await supabase
      .from('class_instances')
      .select(`
        id, date, start_time, status, max_capacity, studio_id,
        template:class_templates!class_instances_template_id_fkey(name),
        teacher:users!class_instances_teacher_id_fkey(name)
      `)
      .eq('id', id)
      .single()

    if (!cls) {
      setLoading(false)
      setRefreshing(false)
      return
    }
    setClassInfo(cls as unknown as ClassInfo)

    // Verify staff
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('studio_id', cls.studio_id)
      .eq('user_id', user.id)
      .single()

    const staffRoles = ['teacher', 'admin', 'owner']
    if (!staffRoles.includes(membership?.role ?? '')) {
      setIsStaff(false)
      setLoading(false)
      setRefreshing(false)
      return
    }
    setIsStaff(true)

    // Load bookings, attendance and notes in parallel
    const [{ data: bookings }, { data: attendanceData }, { data: memberships }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, status, spot, user:users!bookings_user_id_fkey(id, name, avatar_url)')
        .eq('class_instance_id', id)
        .in('status', ['booked', 'confirmed', 'waitlisted'])
        .order('booked_at'),
      supabase
        .from('attendance')
        .select('user_id, checked_in, walk_in')
        .eq('class_instance_id', id),
      supabase
        .from('memberships')
        .select('user_id, notes')
        .eq('studio_id', cls.studio_id),
    ])

    const attMap = new Map((attendanceData ?? []).map((a) => [a.user_id, a]))
    const notesMap = new Map((memberships ?? []).map((m) => [m.user_id, m.notes]))

    const bookedEntries: RosterEntry[] = (bookings ?? []).map((b) => {
      const u = b.user as any
      const att = attMap.get(u.id)
      return {
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatar_url ?? null,
        bookingId: b.id,
        bookingStatus: b.status,
        spot: b.spot ?? null,
        checkedIn: att?.checked_in ?? false,
        walkIn: att?.walk_in ?? false,
        notes: notesMap.get(u.id) ?? null,
        dirty: false,
      }
    })

    // Append walk-ins with no booking
    const bookedIds = new Set(bookedEntries.map((e) => e.userId))
    const walkOnlyAtt = (attendanceData ?? []).filter(
      (a) => a.walk_in && !bookedIds.has(a.user_id),
    )
    if (walkOnlyAtt.length > 0) {
      const { data: walkInUsers } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', walkOnlyAtt.map((a) => a.user_id))

      const userMap = new Map((walkInUsers ?? []).map((u) => [u.id, u]))
      for (const a of walkOnlyAtt) {
        const u = userMap.get(a.user_id)
        if (u) {
          bookedEntries.push({
            userId: u.id,
            name: u.name,
            avatarUrl: u.avatar_url ?? null,
            bookingId: null,
            bookingStatus: null,
            spot: null,
            checkedIn: true,
            walkIn: true,
            notes: null,
            dirty: false,
          })
        }
      }
    }

    setRoster(bookedEntries)
    setLoading(false)
    setRefreshing(false)
  }, [id, user])

  useEffect(() => { loadData() }, [loadData])

  // ─── Toggle check-in (optimistic) ────────────────────────────────────────

  function toggleCheckedIn(userId: string) {
    setRoster((prev) =>
      prev.map((e) =>
        e.userId === userId ? { ...e, checkedIn: !e.checkedIn, dirty: true } : e,
      ),
    )
  }

  // ─── Save pending changes ─────────────────────────────────────────────────

  async function saveAll() {
    if (!user) return
    setSaving(true)

    const now = new Date().toISOString()
    const dirtyEntries = roster.filter((e) => e.dirty)

    for (const entry of dirtyEntries) {
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('class_instance_id', id)
        .eq('user_id', entry.userId)
        .single()

      const payload = {
        checked_in: entry.checkedIn,
        walk_in: entry.walkIn,
        checked_in_at: entry.checkedIn ? now : null,
        checked_in_by: entry.checkedIn ? user.id : null,
      }

      if (existing) {
        await supabase.from('attendance').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('attendance').insert({
          class_instance_id: id,
          user_id: entry.userId,
          ...payload,
        })
      }
    }

    // Transition to in_progress if first check-in
    if (classInfo?.status === 'scheduled' && dirtyEntries.some((e) => e.checkedIn)) {
      await supabase
        .from('class_instances')
        .update({ status: 'in_progress' })
        .eq('id', id)
      setClassInfo((prev) => prev ? { ...prev, status: 'in_progress' } : prev)
    }

    setRoster((prev) => prev.map((e) => ({ ...e, dirty: false })))
    setSaving(false)
  }

  // ─── Walk-in ──────────────────────────────────────────────────────────────

  async function handleAddWalkIn() {
    if (!walkInEmail.trim()) return
    setWalkInBusy(true)
    setWalkInError('')

    const { data: found } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('email', walkInEmail.trim().toLowerCase())
      .single()

    if (!found) {
      setWalkInError('No user found with that email.')
      setWalkInBusy(false)
      return
    }

    if (roster.some((e) => e.userId === found.id)) {
      setRoster((prev) =>
        prev.map((e) =>
          e.userId === found.id ? { ...e, checkedIn: true, walkIn: true, dirty: true } : e,
        ),
      )
    } else {
      setRoster((prev) => [
        ...prev,
        {
          userId: found.id,
          name: found.name,
          avatarUrl: found.avatar_url ?? null,
          bookingId: null,
          bookingStatus: null,
          spot: null,
          checkedIn: true,
          walkIn: true,
          notes: null,
          dirty: true,
        },
      ])
    }

    setWalkInEmail('')
    setWalkInBusy(false)
    setWalkInVisible(false)
  }

  // ─── Complete class ───────────────────────────────────────────────────────

  async function handleComplete() {
    Alert.alert(
      'Complete Class',
      'Mark this class as complete? Absent bookings will be marked as no-shows.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            await saveAll()

            const checkedInIds = new Set(roster.filter((e) => e.checkedIn).map((e) => e.userId))
            const { data: activeBookings } = await supabase
              .from('bookings')
              .select('id, user_id')
              .eq('class_instance_id', id)
              .in('status', ['booked', 'confirmed'])

            const noShows = (activeBookings ?? []).filter((b) => !checkedInIds.has(b.user_id))
            if (noShows.length > 0) {
              await supabase
                .from('bookings')
                .update({ status: 'no_show' })
                .in('id', noShows.map((b) => b.id))
            }

            await supabase
              .from('class_instances')
              .update({ status: 'completed', feed_enabled: true })
              .eq('id', id)

            router.back()
          },
        },
      ],
    )
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const checkedInCount = roster.filter((e) => e.checkedIn).length
  const dirtyCount = roster.filter((e) => e.dirty).length

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="text-muted mt-3">Loading check-in...</Text>
      </SafeAreaView>
    )
  }

  if (!classInfo || !isStaff) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted">{!classInfo ? 'Class not found' : 'Staff access required'}</Text>
        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="text-primary">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const dateStr = new Date(classInfo.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-1">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-base">&larr; Back</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground mt-1" numberOfLines={1}>
            {classInfo.template?.name ?? 'Check-in'}
          </Text>
          <Text className="text-muted text-sm">
            {dateStr} · {formatTime(classInfo.start_time)}
          </Text>
        </View>

        {/* Counter */}
        <View className="items-center ml-4">
          <Text className="text-3xl font-bold text-foreground tabular-nums">
            {checkedInCount}
            <Text className="text-xl text-muted">/{classInfo.max_capacity}</Text>
          </Text>
          <Text className="text-xs text-muted">checked in</Text>
        </View>
      </View>

      {/* Status strip */}
      <View className="flex-row px-4 py-2 gap-2">
        <View className="bg-secondary rounded-full px-3 py-1">
          <Text className="text-xs font-medium capitalize">
            {classInfo.status.replace('_', ' ')}
          </Text>
        </View>
        {dirtyCount > 0 && (
          <View className="bg-amber-100 rounded-full px-3 py-1">
            <Text className="text-xs font-medium text-amber-700">
              {dirtyCount} unsaved
            </Text>
          </View>
        )}
      </View>

      {/* Photo grid */}
      <FlatList
        data={roster}
        numColumns={3}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ padding: 12 }}
        columnWrapperStyle={{ gap: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData() }}
          />
        }
        renderItem={({ item }) => (
          <MemberCard entry={item} onToggle={() => toggleCheckedIn(item.userId)} />
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-muted text-center">
              No bookings yet. Add a walk-in below.
            </Text>
          </View>
        }
      />

      {/* Bottom action bar */}
      <View className="px-4 pb-4 pt-3 border-t border-border gap-3">
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-secondary rounded-xl py-3 items-center"
            onPress={() => setWalkInVisible(true)}
          >
            <Text className="text-foreground font-semibold">+ Walk-in</Text>
          </TouchableOpacity>

          {dirtyCount > 0 && (
            <TouchableOpacity
              className="flex-1 bg-secondary rounded-xl py-3 items-center"
              onPress={saveAll}
              disabled={saving}
            >
              <Text className="text-foreground font-semibold">
                {saving ? 'Saving...' : `Save (${dirtyCount})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${classInfo.status === 'completed' ? 'bg-secondary' : 'bg-destructive'}`}
          onPress={handleComplete}
          disabled={classInfo.status === 'completed'}
        >
          <Text className={`font-bold text-base ${classInfo.status === 'completed' ? 'text-muted' : 'text-white'}`}>
            {classInfo.status === 'completed' ? 'Class Completed' : 'Done — Complete Class'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Walk-in modal */}
      <Modal
        visible={walkInVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWalkInVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-card rounded-t-3xl px-4 pt-6 pb-8">
            <Text className="text-xl font-bold text-foreground mb-4">Add Walk-in</Text>

            <Text className="text-sm text-muted mb-2">Member email</Text>
            <TextInput
              className="border border-border rounded-xl px-4 py-3 text-foreground bg-background mb-2"
              placeholder="member@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={walkInEmail}
              onChangeText={setWalkInEmail}
              onSubmitEditing={handleAddWalkIn}
              returnKeyType="search"
              autoFocus
            />
            {walkInError ? (
              <Text className="text-destructive text-sm mb-3">{walkInError}</Text>
            ) : null}

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                className="flex-1 border border-border rounded-xl py-3 items-center"
                onPress={() => { setWalkInVisible(false); setWalkInEmail(''); setWalkInError('') }}
              >
                <Text className="text-foreground font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary rounded-xl py-3 items-center"
                onPress={handleAddWalkIn}
                disabled={walkInBusy}
              >
                <Text className="text-white font-semibold">
                  {walkInBusy ? 'Searching...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Member card component ────────────────────────────────────────────────────

function MemberCard({
  entry,
  onToggle,
}: {
  entry: RosterEntry
  onToggle: () => void
}) {
  const name = entry.name
  const abbr = initials(name)
  const firstName = name.split(' ')[0] ?? name

  return (
    <TouchableOpacity
      className={[
        'flex-1 items-center rounded-2xl p-3 border-2',
        entry.checkedIn ? 'bg-green-50 border-green-500' : 'bg-card border-border',
        entry.dirty ? 'opacity-90' : '',
      ].join(' ')}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View
        className={[
          'w-14 h-14 rounded-full items-center justify-center mb-2',
          entry.checkedIn ? 'bg-green-100' : 'bg-secondary',
        ].join(' ')}
      >
        <Text className="text-lg font-bold text-foreground">{abbr}</Text>
      </View>

      {/* Name */}
      <Text
        className="text-xs font-medium text-foreground text-center"
        numberOfLines={1}
      >
        {firstName}
      </Text>

      {/* Badges */}
      {entry.walkIn && (
        <View className="bg-blue-500 rounded-full px-1.5 mt-1">
          <Text className="text-white text-[9px] font-bold">Walk-in</Text>
        </View>
      )}

      {entry.notes && (
        <View className="bg-amber-100 rounded-full px-1.5 mt-1">
          <Text className="text-amber-700 text-[9px] font-medium">Note</Text>
        </View>
      )}

      {entry.checkedIn && (
        <View className="bg-green-500 rounded-full px-2 mt-1">
          <Text className="text-white text-[9px] font-bold">✓ Present</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
