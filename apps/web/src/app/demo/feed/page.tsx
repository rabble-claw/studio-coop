'use client'

import { useState } from 'react'
import Link from 'next/link'
import { demoFeedPosts, demoStudio, DemoFeedPost } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const REACTION_EMOJIS = ['❤️', '🔥', '👏']

export default function DemoFeedPage() {
  const [posts, setPosts] = useState<DemoFeedPost[]>(demoFeedPosts)
  const [newPostContent, setNewPostContent] = useState('')
  // Track which reactions the current user has toggled: { [postId]: Set<emoji> }
  const [userReactions, setUserReactions] = useState<Record<string, Set<string>>>({})

  function handleToggleReaction(postId: string, emoji: string) {
    const currentSet = userReactions[postId] ?? new Set<string>()
    const alreadyReacted = currentSet.has(emoji)

    // Update user reaction tracking
    const newSet = new Set(currentSet)
    if (alreadyReacted) {
      newSet.delete(emoji)
    } else {
      newSet.add(emoji)
    }
    setUserReactions((prev) => ({ ...prev, [postId]: newSet }))

    // Update the post's reaction count
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        const existingReaction = post.reactions.find((r) => r.emoji === emoji)
        let newReactions
        if (existingReaction) {
          newReactions = post.reactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: alreadyReacted ? Math.max(0, r.count - 1) : r.count + 1 }
              : r
          )
        } else {
          newReactions = [...post.reactions, { emoji, count: 1 }]
        }
        return { ...post, reactions: newReactions }
      })
    )
  }

  function handleCreatePost() {
    if (!newPostContent.trim()) return
    const newPost: DemoFeedPost = {
      id: `post-new-${Date.now()}`,
      author: 'You',
      author_id: 'demo-user',
      content: newPostContent.trim(),
      created_at: new Date().toISOString(),
      class_name: null,
      class_id: null,
      post_type: 'post',
      media_urls: [],
      reactions: [],
    }
    setPosts((prev) => [newPost, ...prev])
    setNewPostContent('')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Community Feed</h1>
        <p className="text-muted-foreground mt-1">Recent posts from Empire Aerial Arts</p>
      </div>

      {/* New Post Composer */}
      <Card className="mb-6">
        <CardContent className="p-4 space-y-3">
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="Share something with the community..."
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleCreatePost}
              disabled={!newPostContent.trim()}
              size="sm"
            >
              Post
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="p-4">
              {/* Class context */}
              {post.class_name && post.class_id && (
                <div className="mb-3">
                  <Link
                    href={`/demo/classes/${post.class_id}`}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <span>{demoStudio.name}</span>
                    <span>&middot;</span>
                    <span>{post.class_name}</span>
                  </Link>
                </div>
              )}

              {/* Author */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {post.author[0]}
                </div>
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {post.author}
                    {post.post_type === 'milestone' && (
                      <Badge variant="outline" className="text-xs">milestone</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Content */}
              <p className="text-sm mb-3">{post.content}</p>

              {/* Media */}
              {post.media_urls.length > 0 && (
                <div className={`grid gap-2 mb-3 ${post.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {post.media_urls.map((url, i) =>
                    url.includes('.mp4') || url.includes('.webm') ? (
                      <video key={i} src={url} controls className="rounded-lg w-full max-h-64 object-cover" />
                    ) : (
                      <img
                        key={i}
                        src={url}
                        alt="Post media"
                        className="rounded-lg w-full max-h-64 object-cover"
                      />
                    )
                  )}
                </div>
              )}

              {/* Reactions */}
              <div className="flex gap-2 flex-wrap">
                {REACTION_EMOJIS.map((emoji) => {
                  const r = post.reactions.find((x) => x.emoji === emoji)
                  const hasReacted = userReactions[post.id]?.has(emoji) ?? false
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleToggleReaction(post.id, emoji)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition-colors cursor-pointer ${
                        hasReacted
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
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
    </div>
  )
}
