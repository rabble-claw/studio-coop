'use client'

import Link from 'next/link'
import { demoStudio, demoClasses, demoMembers, demoFeedPosts, demoTeachers, getLocalDateStr } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/utils'

export default function DemoPage() {
  const todayStr = getLocalDateStr(demoStudio.timezone)
  const todayClasses = demoClasses.filter((c) => c.date === todayStr)
  const upcomingClasses = demoClasses.filter((c) => c.date >= todayStr!)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{demoStudio.name}</h1>
        <p className="text-muted-foreground capitalize">{demoStudio.discipline} studio · {demoStudio.tier} plan</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/demo/members">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{demoMembers.length}</div></CardContent>
          </Card>
        </Link>
        <Link href="/demo/schedule">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Classes</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{upcomingClasses.length}</div></CardContent>
          </Card>
        </Link>
        <Link href="/demo/schedule">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Classes</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{todayClasses.length}</div></CardContent>
          </Card>
        </Link>
        <Link href="/demo/schedule">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Check-ins Today</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{todayClasses.reduce((sum, c) => sum + c.booked_count, 0)}</div></CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today&apos;s Schedule</CardTitle>
              <Link href="/demo/schedule" className="text-sm text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            {todayClasses.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No classes today.</p>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((cls) => (
                  <Link key={cls.id} href={`/demo/classes/${cls.id}`} className="block">
                    <div className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="font-medium text-sm">{cls.template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(cls.start_time)} — {formatTime(cls.end_time)} · <Link href={`/demo/members/${cls.teacher.id}`} className="hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{cls.teacher.name}</Link>
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{cls.booked_count}</span>
                        <span className="text-muted-foreground">/{cls.max_capacity}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Community Feed</CardTitle>
              <Link href="/demo/feed" className="text-sm text-primary hover:underline">View all &rarr;</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {demoFeedPosts.slice(0, 4).map((post) => (
                <div key={post.id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/demo/members/${post.author_id}`} className="flex items-center gap-2 hover:opacity-80">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {post.author[0]}
                      </div>
                      <span className="font-medium text-sm hover:underline">{post.author}</span>
                    </Link>
                    {post.class_name && post.class_id && (
                      <Link href={`/demo/classes/${post.class_id}`}>
                        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded hover:bg-secondary/80">{post.class_name}</span>
                      </Link>
                    )}
                    {post.class_name && !post.class_id && (
                      <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{post.class_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">{post.content}</p>
                  {post.media_urls.length > 0 && (
                    <div className="ml-8 mt-2 flex gap-1.5">
                      {post.media_urls.slice(0, 2).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-20 h-14 rounded object-cover" />
                      ))}
                    </div>
                  )}
                  <div className="ml-8 mt-1 flex gap-1.5">
                    {post.reactions.map((r) => (
                      <span key={r.emoji} className="text-xs text-muted-foreground">{r.emoji} {r.count}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild><Link href="/demo/schedule">📅 Manage Schedule</Link></Button>
            <Button variant="outline" asChild><Link href="/demo/members">👥 View Members</Link></Button>
            <Button variant="outline" asChild><Link href="/demo/schedule">📸 View Schedule</Link></Button>
            <Button variant="outline" asChild><Link href="/demo/reports">📊 View Reports</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
