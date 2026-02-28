'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatTime, formatDate } from '@/lib/utils'

interface StudioData {
  id: string
  name: string
  slug: string
  discipline: string
  description: string | null
  tier: string
  memberCount: number
  upcomingClasses: number
}

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  max_capacity: number
  booked_count: number
  template: { name: string } | null
  teacher: { name: string } | null
}

interface FeedPost {
  id: string
  content: string
  created_at: string
  user: { name: string } | null
  class_template: { name: string } | null
  reactions: { count: number }[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [studio, setStudio] = useState<StudioData | null>(null)
  const [todayClasses, setTodayClasses] = useState<ClassInstance[]>([])
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get user's studio via membership
      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id, role, studios(id, name, slug, discipline, description, tier)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership?.studios) { setLoading(false); return }

      const s = membership.studios as Record<string, unknown>
      const studioId = s.id as string
      const todayStr = new Date().toISOString().split('T')[0]

      const [
        { count: memberCount },
        { count: upcomingCount },
        { data: classes },
        { data: posts },
      ] = await Promise.all([
        supabase.from('memberships').select('*', { count: 'exact', head: true })
          .eq('studio_id', studioId).eq('status', 'active'),
        supabase.from('class_instances').select('*', { count: 'exact', head: true })
          .eq('studio_id', studioId).eq('status', 'scheduled').gte('date', todayStr),
        supabase.from('class_instances')
          .select('id, date, start_time, end_time, max_capacity, booked_count, template:class_templates(name), teacher:users!class_instances_teacher_id_fkey(name)')
          .eq('studio_id', studioId).eq('date', todayStr).eq('status', 'scheduled')
          .order('start_time'),
        supabase.from('feed_posts')
          .select('id, content, created_at, user:users(name), class_template:class_templates(name), reactions(count)')
          .eq('studio_id', studioId)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setStudio({
        id: studioId, name: s.name as string, slug: s.slug as string,
        discipline: s.discipline as string, description: s.description as string | null,
        tier: s.tier as string, memberCount: memberCount ?? 0, upcomingClasses: upcomingCount ?? 0,
      })
      setTodayClasses((classes ?? []) as unknown as ClassInstance[])
      setFeedPosts((posts ?? []) as unknown as FeedPost[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-muted-foreground">Loading your studio...</div></div>
  }

  if (!studio) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Welcome to Studio Co-op!</h2>
        <p className="text-muted-foreground mb-6">You&apos;re not part of a studio yet. Create one to get started.</p>
        <Button size="lg" asChild><Link href="/dashboard/setup">Create a studio</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{studio.name}</h1>
        <p className="text-muted-foreground capitalize">{studio.discipline} studio · {studio.tier} plan</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/members">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{studio.memberCount}</div></CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/schedule">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Classes</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{studio.upcomingClasses}</div></CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/schedule">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Classes</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{todayClasses.length}</div></CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/schedule">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Check-ins Today</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{todayClasses.reduce((sum, c) => sum + (c.booked_count ?? 0), 0)}</div></CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today&apos;s Schedule</CardTitle>
              <Link href="/dashboard/schedule" className="text-sm text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            {todayClasses.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No classes today.</p>
            ) : (
              <div className="space-y-3">
                {todayClasses.map((cls) => (
                  <Link key={cls.id} href={`/dashboard/classes/${cls.id}`} className="block">
                    <div className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="font-medium text-sm">{cls.template?.name ?? 'Class'}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(cls.start_time)} — {formatTime(cls.end_time)} · {cls.teacher?.name ?? 'TBA'}
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{cls.booked_count ?? 0}</span>
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
              <Link href="/dashboard/feed" className="text-sm text-primary hover:underline">View all &rarr;</Link>
            </div>
          </CardHeader>
          <CardContent>
            {feedPosts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No posts yet. Be the first!</p>
            ) : (
              <div className="space-y-4">
                {feedPosts.map((post) => (
                  <div key={post.id} className="border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {(post.user?.name ?? '?')[0]}
                      </div>
                      <span className="font-medium text-sm">{post.user?.name ?? 'Anonymous'}</span>
                      {post.class_template?.name && (
                        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{post.class_template.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground ml-8">{post.content}</p>
                    <div className="ml-8 mt-1 text-xs text-muted-foreground">
                      ❤️ {post.reactions?.[0]?.count ?? 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild><Link href="/dashboard/schedule">📅 Manage Schedule</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/members">👥 View Members</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/reports">📊 View Reports</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/settings">⚙️ Settings</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
