import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, RefreshControl, SectionList } from 'react-native'
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

interface RecentPost {
  id: string
  content: string | null
  post_type: string
  created_at: string
  class_instance_id: string
  user: { name: string }
  class_instance: {
    date: string
    template: { name: string } | null
    studio: { name: string } | null
  } | null
}

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

export default function HomeScreen() {
  const [studios, setStudios] = useState<StudioMembership[]>([])
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const router = useRouter()

  async function loadData() {
    if (!user) return
    setLoading(true)

    const [{ data: memberships }, { data: posts }] = await Promise.all([
      supabase
        .from('memberships')
        .select('id, role, studio:studios!memberships_studio_id_fkey(id, name, slug, discipline, description)')
        .eq('user_id', user.id)
        .eq('status', 'active'),
      // Recent feed posts visible to this user (RLS enforces access)
      supabase
        .from('feed_posts')
        .select(`
          id, content, post_type, created_at, class_instance_id,
          user:users!feed_posts_user_id_fkey(name),
          class_instance:class_instances!feed_posts_class_instance_id_fkey(
            date,
            template:class_templates!class_instances_template_id_fkey(name),
            studio:studios!class_instances_studio_id_fkey(name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    setStudios((memberships ?? []) as unknown as StudioMembership[])
    setRecentPosts((posts ?? []) as unknown as RecentPost[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build sections: Studios always first, then Recent Feed if posts exist
  const sections: Array<{ title: string; data: (StudioMembership | RecentPost)[] }> = [
    { title: 'Your Studios', data: studios },
    ...(recentPosts.length > 0 ? [{ title: 'Recent Feed', data: recentPosts }] : []),
  ]

  function renderItem({ item, section }: { item: StudioMembership | RecentPost; section: { title: string } }) {
    if (section.title === 'Your Studios') {
      const s = item as StudioMembership
      return (
        <TouchableOpacity
          className="bg-card rounded-2xl border border-border p-5 mb-3"
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/(tabs)/studio/[id]', params: { id: s.studio.id } })}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Text className="text-3xl mr-3">
                {disciplineEmoji[s.studio.discipline] ?? '🏢'}
              </Text>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-foreground">{s.studio.name}</Text>
                {s.studio.description && (
                  <Text className="text-muted text-sm mt-0.5" numberOfLines={1}>
                    {s.studio.description}
                  </Text>
                )}
              </View>
            </View>
            <View className="bg-secondary rounded-full px-3 py-1">
              <Text className="text-xs font-medium text-foreground capitalize">{s.role}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )
    }

    // Recent Feed item
    const p = item as RecentPost
    return (
      <TouchableOpacity
        className="bg-card rounded-xl border border-border p-4 mb-3"
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/(tabs)/class/[id]', params: { id: p.class_instance_id } })}
      >
        {p.class_instance && (
          <Text className="text-xs text-muted mb-1">
            {p.class_instance.studio?.name} · {p.class_instance.template?.name} ·{' '}
            {new Date(p.class_instance.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        )}
        <Text className="text-sm font-semibold text-foreground">{p.user.name}</Text>
        {p.content && (
          <Text className="text-foreground text-sm mt-1" numberOfLines={2}>{p.content}</Text>
        )}
        {p.post_type === 'milestone' && (
          <View className="mt-1 self-start bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
            <Text className="text-xs text-yellow-700 font-medium">milestone</Text>
          </View>
        )}
        <Text className="text-xs text-muted mt-1">
          {new Date(p.created_at).toLocaleString()}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        contentContainerStyle={{ padding: 16 }}
        renderSectionHeader={({ section }) => (
          <Text className="text-xl font-bold text-foreground mb-3 mt-2">{section.title}</Text>
        )}
        renderItem={renderItem}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-20">
              <Text className="text-5xl mb-4">🏠</Text>
              <Text className="text-lg font-semibold text-foreground mb-1">No studios yet</Text>
              <Text className="text-muted text-center">Ask your studio to invite you, or create your own.</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}
