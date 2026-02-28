import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, TextInput, Image } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { feedApi } from '@/lib/api'

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
  const { studioId } = useAuth()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [composing, setComposing] = useState(false)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      if (studioId) {
        const data = await feedApi.getFeed(studioId) as FeedPost[]
        setPosts(data)
      } else {
        setPosts([])
      }
    } catch (e) {
      console.error('Failed to load feed:', e)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [studioId])

  useEffect(() => { loadFeed() }, [loadFeed])

  async function handlePost() {
    if (!newPost.trim() || !studioId) return
    try {
      await feedApi.createPost(studioId, { content: newPost })
      setNewPost('')
      setComposing(false)
      loadFeed()
    } catch (e) {
      console.error('Failed to create post:', e)
    }
  }

  async function handleReact(postId: string, emoji: string) {
    if (!studioId) return
    try {
      await feedApi.react(studioId, postId, emoji)
      setPosts(posts.map(p => {
        if (p.id !== postId) return p
        const reactions = p.reactions.map(r =>
          r.emoji === emoji ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted } : r
        )
        return { ...p, reactions }
      }))
    } catch (e) {
      console.error('Failed to react:', e)
    }
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
                {post.content && <Text className="text-yellow-700 text-sm mt-1">{post.content}</Text>}
              </View>
            ) : (
              post.content && <Text className="text-foreground text-base">{post.content}</Text>
            )}

            {post.media_urls.length > 0 && (
              <Image source={{ uri: post.media_urls[0] }} className="w-full h-48 rounded-xl mt-2" resizeMode="cover" />
            )}

            <View className="flex-row gap-2 mt-3">
              {['\u2764\uFE0F', '\uD83D\uDD25', '\uD83D\uDC4F'].map(emoji => {
                const r = post.reactions.find(x => x.emoji === emoji)
                return (
                  <TouchableOpacity
                    key={emoji}
                    className={`flex-row items-center rounded-full px-2 py-1 ${r?.reacted ? 'bg-primary/10 border border-primary/30' : 'bg-secondary'}`}
                    onPress={() => handleReact(post.id, emoji)}
                  >
                    <Text className="text-sm">{emoji}</Text>
                    {r && r.count > 0 && (
                      <Text className={`text-xs ml-1 ${r.reacted ? 'text-primary font-medium' : 'text-muted'}`}>{r.count}</Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-20">
              <Text className="text-4xl mb-3">📸</Text>
              <Text className="text-foreground font-medium">No posts yet</Text>
              <Text className="text-muted text-sm mt-1">Be the first to share something!</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}
