import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useAuth } from '@/lib/auth-context'

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

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState<'memberships' | 'attendance' | 'settings'>('memberships')

  // Demo data
  const memberships: Membership[] = [
    { id: '1', plan_name: 'Unlimited Monthly', status: 'active', type: 'unlimited', classes_remaining: null, expires_at: null, studio_name: 'Empire Aerial Arts' },
    { id: '2', plan_name: '5-Class Pack', status: 'active', type: 'class_pack', classes_remaining: 3, expires_at: '2026-04-15', studio_name: 'Empire Aerial Arts' },
  ]

  const attendance: AttendanceRecord[] = [
    { date: '2026-02-26', class_name: 'Pole Level 2', checked_in: true },
    { date: '2026-02-25', class_name: 'Aerial Silks', checked_in: true },
    { date: '2026-02-24', class_name: 'Flexibility', checked_in: true },
    { date: '2026-02-22', class_name: 'Pole Level 2', checked_in: true },
    { date: '2026-02-20', class_name: 'Movement & Cirque', checked_in: false },
  ]

  const stats = {
    totalClasses: 47,
    thisMonth: 8,
    streak: 3,
    memberSince: 'Oct 2025',
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
      {/* Profile Header */}
      <View className="items-center mb-6">
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-3">
          <Text className="text-primary text-3xl font-bold">
            {user?.email?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text className="text-foreground text-xl font-bold">{user?.email || 'Member'}</Text>
        <Text className="text-muted text-sm mt-0.5">Member since {stats.memberSince}</Text>
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
                    <View className="h-full bg-primary rounded-full" style={{ width: `${(m.classes_remaining / 5) * 100}%` }} />
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
