'use client'

import Link from 'next/link'
import { demoFeedPosts, demoStudio } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const REACTION_EMOJIS = ['❤️', '🔥', '👏']

export default function DemoFeedPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Community Feed</h1>
        <p className="text-muted-foreground mt-1">Recent posts from Empire Aerial Arts</p>
      </div>

      <div className="space-y-4">
        {demoFeedPosts.map((post) => (
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
                  return (
                    <button
                      key={emoji}
                      disabled
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border border-border text-muted-foreground disabled:opacity-70 disabled:cursor-not-allowed"
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
