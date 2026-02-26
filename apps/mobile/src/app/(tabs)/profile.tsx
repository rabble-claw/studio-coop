import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface UserProfile {
  name: string
  email: string
  avatar_url: string | null
  created_at: string
}

interface AttendanceRecord {
  id: string
  checked_in_at: string
  class_instance: {
    date: string
    start_time: string
    template: { name: string } | null
    studio: { name: string } | null
  }
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  async function loadProfile() {
    if (!user) return
    setLoading(true)

    const [{ data: profileData }, { data: attendanceData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase
        .from('attendance')
        .select(`
          id, checked_in_at,
          class_instance:class_instances!attendance_class_instance_id_fkey(
            date, start_time,
            template:class_templates!class_instances_template_id_fkey(name),
            studio:studios!class_instances_studio_id_fkey(name)
          )
        `)
        .eq('user_id', user.id)
        .eq('checked_in', true)
        .order('checked_in_at', { ascending: false })
        .limit(20),
    ])

    setProfile(profileData)
    setAttendance((attendanceData ?? []) as unknown as AttendanceRecord[])
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProfile} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Profile header */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold">
              {profile?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-foreground">{profile?.name ?? 'Loading...'}</Text>
          <Text className="text-muted">{profile?.email}</Text>
          <Text className="text-muted text-xs mt-1">
            Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '...'}
          </Text>
        </View>

        {/* Stats */}
        <View className="bg-card rounded-2xl border border-border p-5 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Your Stats</Text>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-3xl font-bold text-primary">{attendance.length}</Text>
              <Text className="text-muted text-sm">Classes Attended</Text>
            </View>
          </View>
        </View>

        {/* Attendance History */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Recent Attendance</Text>
          {attendance.length === 0 ? (
            <Text className="text-muted text-center py-4">No attendance history yet</Text>
          ) : (
            attendance.map((a) => (
              <View key={a.id} className="bg-card rounded-xl border border-border p-4 mb-2">
                <Text className="font-medium text-foreground">
                  {a.class_instance?.template?.name ?? 'Class'}
                </Text>
                <Text className="text-muted text-sm">
                  {a.class_instance?.studio?.name} &middot;{' '}
                  {a.class_instance?.date ? new Date(a.class_instance.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          className="border border-border rounded-xl py-3 items-center"
          onPress={signOut}
          activeOpacity={0.7}
        >
          <Text className="text-muted font-medium">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
