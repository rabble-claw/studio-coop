'use client'

import { demoFeedPosts } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'

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
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {post.author[0]}
                </div>
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {post.author}
                    {post.class_name && (
                      <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{post.class_name}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-sm mb-3">{post.content}</p>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border border-border text-muted-foreground">
                  ❤️ {post.likes}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
