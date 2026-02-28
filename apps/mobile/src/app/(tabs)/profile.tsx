import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { profileApi, subscriptionApi } from '@/lib/api'

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

interface ClassPass {
  id: string
  name: string
  remaining: number
  total: number
  expires_at: string | null
}

interface CompCredit {
  id: string
  reason: string
  remaining: number
  expires_at: string | null
}

interface Subscription {
  id: string
  plan_name: string
  status: string
  current_period_end: string
  cancel_at_period_end: boolean
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
  const [classPasses, setClassPasses] = useState<ClassPass[]>([])
  const [comps, setComps] = useState<CompCredit[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)

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
        const [attendanceData, passesData, compsData, subData] = await Promise.all([
          profileApi.attendance(studioId).catch(() => []) as Promise<AttendanceRecord[]>,
          profileApi.classPasses(studioId).catch(() => []) as Promise<ClassPass[]>,
          profileApi.comps(studioId).catch(() => []) as Promise<CompCredit[]>,
          subscriptionApi.mine(studioId).catch(() => null) as Promise<Subscription | null>,
        ])
        setAttendance(attendanceData ?? [])
        setClassPasses(passesData ?? [])
        setComps(compsData ?? [])
        setSubscription(subData)
      }
    } catch (e) {
      console.error('Failed to load profile:', e)
    } finally {
      setLoading(false)
    }
  }, [studioId])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function handleCancelSubscription() {
    if (!subscription) return
    Alert.alert(
      'Cancel Subscription',
      'Your subscription will remain active until the end of the current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await subscriptionApi.cancel(subscription.id)
              loadProfile()
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to cancel subscription.')
            }
          },
        },
      ],
    )
  }

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
          { label: 'Streak', value: stats.streak.toString() },
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
          {/* Active Subscription */}
          {subscription && (
            <View className="bg-card rounded-2xl border border-border p-4">
              <View className="flex-row justify-between items-start mb-2">
                <View>
                  <Text className="text-foreground font-semibold">Subscription</Text>
                  <Text className="text-muted text-sm">{subscription.plan_name}</Text>
                </View>
                <View className={`rounded-full px-2 py-0.5 ${subscription.status === 'active' ? 'bg-green-100' : 'bg-secondary'}`}>
                  <Text className={`text-xs font-medium ${subscription.status === 'active' ? 'text-green-700' : 'text-muted'}`}>
                    {subscription.cancel_at_period_end ? 'Cancelling' : subscription.status}
                  </Text>
                </View>
              </View>
              <Text className="text-muted text-xs">
                {subscription.cancel_at_period_end
                  ? `Active until ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
              </Text>
              {!subscription.cancel_at_period_end && subscription.status === 'active' && (
                <TouchableOpacity className="mt-3" onPress={handleCancelSubscription}>
                  <Text className="text-red-500 text-sm font-medium">Cancel Subscription</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Class Passes */}
          {classPasses.map(p => (
            <View key={p.id} className="bg-card rounded-2xl border border-border p-4">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-foreground font-semibold">{p.name}</Text>
                  <Text className="text-muted text-sm">Class Pack</Text>
                </View>
              </View>
              <View className="mt-2 flex-row items-center">
                <View className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <View className="h-full bg-primary rounded-full" style={{ width: `${Math.min((p.remaining / p.total) * 100, 100)}%` }} />
                </View>
                <Text className="text-muted text-xs ml-2">{p.remaining}/{p.total} left</Text>
              </View>
              {p.expires_at && (
                <Text className="text-muted text-xs mt-1">Expires {new Date(p.expires_at).toLocaleDateString()}</Text>
              )}
            </View>
          ))}

          {/* Comp Credits */}
          {comps.map(c => (
            <View key={c.id} className="bg-card rounded-2xl border border-border p-4">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="text-foreground font-semibold">Comp Credit</Text>
                  <Text className="text-muted text-sm">{c.reason}</Text>
                </View>
                <View className="bg-blue-100 rounded-full px-2 py-0.5">
                  <Text className="text-xs text-blue-700 font-medium">{c.remaining} left</Text>
                </View>
              </View>
              {c.expires_at && (
                <Text className="text-muted text-xs mt-1">Expires {new Date(c.expires_at).toLocaleDateString()}</Text>
              )}
            </View>
          ))}

          {/* Other Memberships */}
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

          {!subscription && classPasses.length === 0 && comps.length === 0 && memberships.length === 0 && !loading && (
            <View className="items-center py-8">
              <Text className="text-muted text-sm">No active memberships</Text>
            </View>
          )}
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
              <View className={`rounded-full px-2 py-0.5 ${a.checked_in ? 'bg-green-100' : 'bg-red-50'}`}>
                <Text className={`text-xs font-medium ${a.checked_in ? 'text-green-700' : 'text-red-600'}`}>
                  {a.checked_in ? 'Present' : 'Absent'}
                </Text>
              </View>
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
