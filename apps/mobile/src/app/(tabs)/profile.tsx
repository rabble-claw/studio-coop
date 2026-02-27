import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { profileApi } from '@/lib/api'

interface Membership {
  id: string
  plan_name: string
  status: string
  type: string
  classes_remaining: number | null
  expires_at: string | null
  studio_name: string
}

interface AttendanceRecord {
  date: string
  class_name: string
  checked_in: boolean
}

interface ProfileData {
  name: string
  email: string
  total_classes: number
  this_month: number
  streak: number
  member_since: string
}

export default function ProfileScreen() {
  const { user, studioId, signOut } = useAuth()
  const [tab, setTab] = useState<'memberships' | 'attendance' | 'settings'>('memberships')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const [profileData, membershipsData] = await Promise.all([
        profileApi.get().catch(() => null),
        profileApi.memberships().catch(() => []),
      ]) as [ProfileData | null, Membership[]]

      if (profileData) setProfile(profileData)
      if (membershipsData) setMemberships(membershipsData)

      if (studioId) {
        const attendanceData = await profileApi.attendance(studioId).catch(() => []) as AttendanceRecord[]
        if (attendanceData) setAttendance(attendanceData)
      }
    } catch (e) {
      console.error('Failed to load profile:', e)
    } finally {
      setLoading(false)
    }
  }, [studioId])

  useEffect(() => { loadProfile() }, [loadProfile])

  const displayName = profile?.name || user?.email || 'Member'
  const stats = {
    totalClasses: profile?.total_classes ?? 0,
    thisMonth: profile?.this_month ?? 0,
    streak: profile?.streak ?? 0,
    memberSince: profile?.member_since ?? '',
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProfile} />}
    >
      {/* Profile Header */}
      <View className="items-center mb-6">
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-3">
          <Text className="text-primary text-3xl font-bold">
            {displayName[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text className="text-foreground text-xl font-bold">{displayName}</Text>
        {stats.memberSince ? (
          <Text className="text-muted text-sm mt-0.5">Member since {stats.memberSince}</Text>
        ) : null}
      </View>

      {/* Stats */}
      <View className="flex-row bg-card rounded-2xl border border-border p-4 mb-6">
        {[
          { label: 'Total Classes', value: stats.totalClasses.toString() },
          { label: 'This Month', value: stats.thisMonth.toString() },
          { label: 'Streak', value: `${stats.streak} 🔥` },
        ].map((s, i) => (
          <View key={s.label} className={`flex-1 items-center ${i < 2 ? 'border-r border-border' : ''}`}>
            <Text className="text-foreground text-xl font-bold">{s.value}</Text>
            <Text className="text-muted text-xs mt-0.5">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View className="flex-row bg-secondary rounded-xl p-1 mb-4">
        {(['memberships', 'attendance', 'settings'] as const).map(t => (
          <TouchableOpacity
            key={t}
            className={`flex-1 py-2 rounded-lg ${tab === t ? 'bg-card' : ''}`}
            onPress={() => setTab(t)}
          >
            <Text className={`text-center text-sm font-medium ${tab === t ? 'text-foreground' : 'text-muted'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'memberships' && (
        <View className="gap-3">
          {memberships.length === 0 && !loading && (
            <View className="items-center py-8">
              <Text className="text-muted text-sm">No active memberships</Text>
            </View>
          )}
          {memberships.map(m => (
            <View key={m.id} className="bg-card rounded-2xl border border-border p-4">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-foreground font-semibold">{m.plan_name}</Text>
                  <Text className="text-muted text-sm">{m.studio_name}</Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${m.status === 'active' ? 'bg-green-100' : 'bg-secondary'}`}>
                  <Text className={`text-xs font-medium ${m.status === 'active' ? 'text-green-700' : 'text-muted'}`}>
                    {m.status}
                  </Text>
                </View>
              </View>
              {m.classes_remaining !== null && (
                <View className="mt-2 flex-row items-center">
                  <View className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <View className="h-full bg-primary rounded-full" style={{ width: `${Math.min((m.classes_remaining / 10) * 100, 100)}%` }} />
                  </View>
                  <Text className="text-muted text-xs ml-2">{m.classes_remaining} left</Text>
                </View>
              )}
              {m.expires_at && (
                <Text className="text-muted text-xs mt-1">Expires {new Date(m.expires_at).toLocaleDateString()}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {tab === 'attendance' && (
        <View className="gap-2">
          {attendance.length === 0 && !loading && (
            <View className="items-center py-8">
              <Text className="text-muted text-sm">No attendance records yet</Text>
            </View>
          )}
          {attendance.map((a, i) => (
            <View key={i} className="bg-card rounded-xl border border-border p-3 flex-row items-center justify-between">
              <View>
                <Text className="text-foreground font-medium text-sm">{a.class_name}</Text>
                <Text className="text-muted text-xs">
                  {new Date(a.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text className="text-sm">{a.checked_in ? '✅' : '❌'}</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'settings' && (
        <View className="gap-3">
          <TouchableOpacity className="bg-card rounded-xl border border-border p-4">
            <Text className="text-foreground font-medium">Notification Preferences</Text>
            <Text className="text-muted text-sm">Manage push and email notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-card rounded-xl border border-border p-4">
            <Text className="text-foreground font-medium">Payment Methods</Text>
            <Text className="text-muted text-sm">Manage your saved cards</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-card rounded-xl border border-border p-4" onPress={signOut}>
            <Text className="text-red-500 font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}
