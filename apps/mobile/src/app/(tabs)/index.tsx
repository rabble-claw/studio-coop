import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface StudioMembership {
  id: string
  role: string
  studio: {
    id: string
    name: string
    slug: string
    discipline: string
    description: string | null
  }
}

export default function HomeScreen() {
  const [studios, setStudios] = useState<StudioMembership[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const router = useRouter()

  async function loadStudios() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('memberships')
      .select('id, role, studio:studios!memberships_studio_id_fkey(id, name, slug, discipline, description)')
      .eq('user_id', user.id)
      .eq('status', 'active')

    setStudios((data ?? []) as unknown as StudioMembership[])
    setLoading(false)
  }

  useEffect(() => {
    loadStudios()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const disciplineEmoji: Record<string, string> = {
    pole: '💃',
    bjj: '🥋',
    yoga: '🧘',
    crossfit: '🏋️',
    cycling: '🚴',
    pilates: '🤸',
    dance: '💃',
    aerial: '🎪',
    general: '🏢',
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={studios}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStudios} />}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View className="mb-4">
            <Text className="text-2xl font-bold text-foreground">Your Studios</Text>
            <Text className="text-muted mt-1">Tap a studio to view the schedule</Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-20">
              <Text className="text-5xl mb-4">🏠</Text>
              <Text className="text-lg font-semibold text-foreground mb-1">No studios yet</Text>
              <Text className="text-muted text-center">Ask your studio to invite you, or create your own.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-card rounded-2xl border border-border p-5 mb-3"
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/(tabs)/studio/[id]', params: { id: item.studio.id } })}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-3xl mr-3">
                  {disciplineEmoji[item.studio.discipline] ?? '🏢'}
                </Text>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">{item.studio.name}</Text>
                  {item.studio.description && (
                    <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
                      {item.studio.description}
                    </Text>
                  )}
                </View>
              </View>
              <View className="bg-secondary rounded-full px-3 py-1">
                <Text className="text-xs font-medium text-foreground capitalize">{item.role}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}
