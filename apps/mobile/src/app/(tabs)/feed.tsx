import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, TextInput, Image } from 'react-native'

interface FeedPost {
  id: string
  content: string | null
  post_type: 'text' | 'photo' | 'video' | 'milestone'
  media_urls: string[]
  created_at: string
  user: { id: string; name: string; avatar_url: string | null }
  class_name: string | null
  reactions: { emoji: string; count: number; reacted: boolean }[]
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [composing, setComposing] = useState(false)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    // TODO: Replace with real API
    setPosts([
      {
        id: '1', content: 'Finally nailed my ayesha today! 🎉 Months of work paying off!',
        post_type: 'text', media_urls: [], created_at: new Date(Date.now() - 3600000).toISOString(),
        user: { id: 'u1', name: 'Jamie L.', avatar_url: null },
        class_name: 'Pole Level 3',
        reactions: [{ emoji: '❤️', count: 8, reacted: false }, { emoji: '🔥', count: 3, reacted: true }],
      },
      {
        id: '2', content: null,
        post_type: 'milestone', media_urls: [], created_at: new Date(Date.now() - 7200000).toISOString(),
        user: { id: 'u2', name: 'Alex M.', avatar_url: null },
        class_name: null,
        reactions: [{ emoji: '🎉', count: 12, reacted: false }],
      },
      {
        id: '3', content: 'Great aerial silks class this morning. That drop sequence though 😱',
        post_type: 'text', media_urls: [], created_at: new Date(Date.now() - 14400000).toISOString(),
        user: { id: 'u3', name: 'Sam W.', avatar_url: null },
        class_name: 'Aerial Silks Beginner',
        reactions: [{ emoji: '❤️', count: 5, reacted: true }],
      },
    ])
    setLoading(false)
  }, [])

  useEffect(() => { loadFeed() }, [loadFeed])

  function handlePost() {
    if (!newPost.trim()) return
    const post: FeedPost = {
      id: Date.now().toString(), content: newPost, post_type: 'text',
      media_urls: [], created_at: new Date().toISOString(),
      user: { id: 'me', name: 'You', avatar_url: null },
      class_name: null, reactions: [],
    }
    setPosts([post, ...posts])
    setNewPost('')
    setComposing(false)
  }

  function handleReact(postId: string, emoji: string) {
    setPosts(posts.map(p => {
      if (p.id !== postId) return p
      const reactions = p.reactions.map(r =>
        r.emoji === emoji ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted } : r
      )
      return { ...p, reactions }
    }))
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFeed} />}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View className="mb-4">
            {composing ? (
              <View className="bg-card rounded-2xl border border-border p-4">
                <TextInput
                  className="text-foreground text-base min-h-[80px]"
                  placeholder="Share something with your studio..."
                  placeholderTextColor="#999"
                  multiline
                  value={newPost}
                  onChangeText={setNewPost}
                  autoFocus
                />
                <View className="flex-row justify-between mt-3">
                  <TouchableOpacity onPress={() => setComposing(false)}>
                    <Text className="text-muted">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-primary rounded-full px-4 py-2"
                    onPress={handlePost}
                  >
                    <Text className="text-white font-medium text-sm">Post</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                className="bg-card rounded-2xl border border-border p-4"
                onPress={() => setComposing(true)}
              >
                <Text className="text-muted">Share something with your studio...</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item: post }) => (
          <View className="bg-card rounded-2xl border border-border p-4 mb-3">
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-2">
                <Text className="text-primary font-bold text-sm">{post.user.name[0]}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-medium text-sm">{post.user.name}</Text>
                <Text className="text-muted text-xs">
                  {new Date(post.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {post.class_name && ` · ${post.class_name}`}
                </Text>
              </View>
            </View>

            {post.post_type === 'milestone' ? (
              <View className="bg-yellow-50 rounded-xl p-3 items-center">
                <Text className="text-2xl">🏆</Text>
                <Text className="text-yellow-800 font-semibold mt-1">
                  {post.user.name} hit a milestone!
                </Text>
              </View>
            ) : (
              <Text className="text-foreground text-base">{post.content}</Text>
            )}

            {post.media_urls.length > 0 && (
              <Image source={{ uri: post.media_urls[0] }} className="w-full h-48 rounded-xl mt-2" resizeMode="cover" />
            )}

            {post.reactions.length > 0 && (
              <View className="flex-row gap-2 mt-3">
                {post.reactions.map(r => (
                  <TouchableOpacity
                    key={r.emoji}
                    className={`flex-row items-center rounded-full px-2 py-1 ${r.reacted ? 'bg-primary/10 border border-primary/30' : 'bg-secondary'}`}
                    onPress={() => handleReact(post.id, r.emoji)}
                  >
                    <Text className="text-sm">{r.emoji}</Text>
                    <Text className={`text-xs ml-1 ${r.reacted ? 'text-primary font-medium' : 'text-muted'}`}>{r.count}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      />
    </View>
  )
}
