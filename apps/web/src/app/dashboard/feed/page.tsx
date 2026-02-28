'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface FeedPost {
  id: string
  content: string | null
  media_urls: string[] | null
  post_type: string
  created_at: string
  class_instance_id: string
  user: { id: string; name: string; avatar_url: string | null }
  class_instance: {
    id: string
    date: string
    template: { name: string } | null
    studio: { id: string; name: string } | null
  } | null
  reactions: Array<{ emoji: string; count: number; reacted: boolean }>
}

const REACTION_EMOJIS = ['❤️', '🔥', '👏']

export default function FeedPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const supabase = useMemo(() => createClient(), [])

  async function loadFeed(userId: string) {
    setLoading(true)

    // Fetch recent posts across all accessible classes (RLS enforces access)
    const { data: rawPosts } = await supabase
      .from('feed_posts')
      .select(`
        id, content, media_urls, post_type, created_at, class_instance_id,
        user:users!feed_posts_user_id_fkey(id, name, avatar_url),
        class_instance:class_instances!feed_posts_class_instance_id_fkey(
          id, date,
          template:class_templates!class_instances_template_id_fkey(name),
          studio:studios!class_instances_studio_id_fkey(id, name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    const postIds = (rawPosts ?? []).map((p) => p.id)
    let reactionsByPost: Record<string, Array<{ emoji: string; count: number; reacted: boolean }>> = {}

    if (postIds.length > 0) {
      const { data: reactions } = await supabase
        .from('feed_reactions')
        .select('post_id, emoji, user_id')
        .in('post_id', postIds)

      const byPost: typeof reactionsByPost = {}
      for (const r of reactions ?? []) {
        if (!byPost[r.post_id]) byPost[r.post_id] = []
        const existing = byPost[r.post_id].find((x) => x.emoji === r.emoji)
        if (existing) {
          existing.count++
          if (r.user_id === userId) existing.reacted = true
        } else {
          byPost[r.post_id].push({ emoji: r.emoji, count: 1, reacted: r.user_id === userId })
        }
      }
      reactionsByPost = byPost
    }

    setPosts(
      (rawPosts ?? []).map((p) => ({
        id: p.id,
        content: p.content,
        media_urls: p.media_urls,
        post_type: p.post_type,
        created_at: p.created_at,
        class_instance_id: p.class_instance_id,
        user: p.user as FeedPost['user'],
        class_instance: p.class_instance as FeedPost['class_instance'],
        reactions: reactionsByPost[p.id] ?? [],
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)
      try {
        await loadFeed(user.id)
      } catch {
        setError('Failed to load feed. Please try again.')
        setLoading(false)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleReaction(postId: string, emoji: string) {
    if (!currentUserId) return
    const post = posts.find((p) => p.id === postId)
    const existing = post?.reactions.find((r) => r.emoji === emoji && r.reacted)

    if (existing) {
      await supabase.from('feed_reactions').delete()
        .eq('post_id', postId).eq('user_id', currentUserId).eq('emoji', emoji)
    } else {
      await supabase.from('feed_reactions').upsert(
        { post_id: postId, user_id: currentUserId, emoji },
        { onConflict: 'post_id,user_id,emoji' },
      )
    }
    await loadFeed(currentUserId)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Community Feed</h1>
        <p className="text-muted-foreground mt-1">Recent posts from your classes</p>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-muted-foreground text-center py-20" aria-busy="true" role="status">Loading feed...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4" aria-hidden="true">📸</div>
          <p className="text-lg font-semibold">No posts yet</p>
          <p className="text-muted-foreground mt-1">Posts appear here after classes are completed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                {/* Class context */}
                {post.class_instance && (
                  <div className="mb-3">
                    <Link
                      href={`/dashboard/classes/${post.class_instance_id}`}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <span>{post.class_instance.studio?.name}</span>
                      <span>&middot;</span>
                      <span>{post.class_instance.template?.name}</span>
                      <span>&middot;</span>
                      <span>{new Date(post.class_instance.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </Link>
                  </div>
                )}

                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.user.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {post.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {post.user.name}
                      {post.post_type === 'milestone' && (
                        <Badge variant="outline" className="text-xs">milestone</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {post.content && <p className="text-sm mb-3">{post.content}</p>}

                {/* Media */}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className={`grid gap-2 mb-3 ${post.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {post.media_urls.map((url, i) =>
                      url.includes('.mp4') ? (
                        <video key={i} src={url} controls className="rounded-lg w-full max-h-64 object-cover" aria-label={`Video from ${post.user.name}`} />
                      ) : (
                        <button
                          key={i}
                          type="button"
                          className="rounded-lg overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={() => window.open(url, '_blank')}
                          aria-label={`View full-size image from ${post.user.name}`}
                        >
                          <img
                            src={url}
                            alt={`Photo shared by ${post.user.name}`}
                            className="w-full max-h-64 object-cover"
                          />
                        </button>
                      )
                    )}
                  </div>
                )}

                {/* Reactions */}
                <div className="flex gap-2 flex-wrap" role="group" aria-label="Reactions">
                  {REACTION_EMOJIS.map((emoji) => {
                    const r = post.reactions.find((x) => x.emoji === emoji)
                    const emojiName = emoji === '❤️' ? 'love' : emoji === '🔥' ? 'fire' : 'applause'
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        aria-pressed={r?.reacted ?? false}
                        aria-label={`React with ${emojiName}${r && r.count > 0 ? `, ${r.count} ${r.count === 1 ? 'reaction' : 'reactions'}` : ''}`}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                          r?.reacted
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span aria-hidden="true">{emoji}</span>
                        {r && r.count > 0 && <span>{r.count}</span>}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
