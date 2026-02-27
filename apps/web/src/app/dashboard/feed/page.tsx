'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { feedApi, type FeedPost } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ClassOption {
  id: string
  date: string
  name: string
}

const REACTION_EMOJIS = ['❤️', '🔥', '👏']

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [studioId, setStudioId] = useState('')
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)
  const supabase = createClient()

  const loadFeed = useCallback(async (sid: string) => {
    setLoading(true)
    try {
      const data = await feedApi.getStudioFeed(sid)
      setPosts(data)
    } catch (e) {
      console.error('Failed to load feed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) return

      const sid = membership.studio_id
      setStudioId(sid)

      const { data: recentClasses } = await supabase
        .from('class_instances')
        .select('id, date, template:class_templates!class_instances_template_id_fkey(name)')
        .eq('studio_id', sid)
        .order('date', { ascending: false })
        .limit(20)

      const classOptions: ClassOption[] = (recentClasses ?? []).map((c) => ({
        id: c.id,
        date: c.date,
        name: (c.template as { name: string } | null)?.name ?? 'Class',
      }))
      setClasses(classOptions)
      if (classOptions.length > 0) setSelectedClassId(classOptions[0].id)

      await loadFeed(sid)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleReaction(postId: string, emoji: string) {
    const post = posts.find((p) => p.id === postId)
    const existing = post?.reactions.find((r) => r.emoji === emoji && r.reacted)

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const hasEmoji = p.reactions.some((r) => r.emoji === emoji)
        const reactions = hasEmoji
          ? p.reactions
              .map((r) =>
                r.emoji !== emoji
                  ? r
                  : existing
                  ? { ...r, count: r.count - 1, reacted: false }
                  : { ...r, count: r.count + 1, reacted: true },
              )
              .filter((r) => r.count > 0)
          : [...p.reactions, { emoji, count: 1, reacted: true }]
        return { ...p, reactions }
      }),
    )

    try {
      if (existing) {
        await feedApi.removeReaction(postId, emoji)
      } else {
        await feedApi.addReaction(postId, emoji)
      }
    } catch (e) {
      console.error('Failed to toggle reaction:', e)
      // Revert optimistic update on failure
      await loadFeed(studioId)
    }
  }

  async function submitPost() {
    if (!selectedClassId || !newPostContent.trim()) return
    setPosting(true)
    try {
      const post = await feedApi.createPost(selectedClassId, { content: newPostContent.trim() })
      setNewPostContent('')
      setPosts((prev) => [post, ...prev])
    } catch (e) {
      console.error('Failed to create post:', e)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Community Feed</h1>
        <p className="text-muted-foreground mt-1">Recent posts from your classes</p>
      </div>

      {/* Compose form */}
      {classes.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Post to:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="flex h-8 rounded-lg border border-border bg-card px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} &middot; {new Date(c.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Share something with your class..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={submitPost}
                disabled={posting || !newPostContent.trim() || !selectedClassId}
              >
                {posting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-muted-foreground text-center py-20">Loading feed...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📸</div>
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
                      <span>{post.class_instance.template?.name}</span>
                      <span>&middot;</span>
                      <span>
                        {new Date(post.class_instance.date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </Link>
                  </div>
                )}

                {/* Author */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.author.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {post.author.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {post.author.name}
                      {post.post_type === 'milestone' && (
                        <Badge variant="outline" className="text-xs">
                          milestone
                        </Badge>
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
                  <div
                    className={`grid gap-2 mb-3 ${post.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
                  >
                    {post.media_urls.map((url, i) =>
                      url.includes('.mp4') ? (
                        <video key={i} src={url} controls className="rounded-lg w-full max-h-64 object-cover" />
                      ) : (
                        <img
                          key={i}
                          src={url}
                          alt="Post media"
                          className="rounded-lg w-full max-h-64 object-cover cursor-pointer"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ),
                    )}
                  </div>
                )}

                {/* Reactions */}
                <div className="flex gap-2 flex-wrap">
                  {REACTION_EMOJIS.map((emoji) => {
                    const r = post.reactions.find((x) => x.emoji === emoji)
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(post.id, emoji)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-all ${
                          r?.reacted
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{emoji}</span>
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
