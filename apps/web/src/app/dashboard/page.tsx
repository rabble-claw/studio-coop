'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isDemoMode, demoStudio, demoClasses, demoMembers, demoFeedPosts } from '@/lib/demo-data'
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

export default function DashboardPage() {
  const [studio, setStudio] = useState<StudioData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemoMode()) {
      const todayStr = new Date().toISOString().split('T')[0]
      setStudio({
        id: demoStudio.id,
        name: demoStudio.name,
        slug: demoStudio.slug,
        discipline: demoStudio.discipline,
        description: demoStudio.description,
        tier: demoStudio.tier,
        memberCount: demoMembers.length,
        upcomingClasses: demoClasses.filter((c) => c.date >= todayStr).length,
      })
      setLoading(false)
      return
    }

    async function load() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id, role, studios(id, name, slug, discipline, description, tier)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (membership?.studios) {
        const s = membership.studios as Record<string, unknown>
        const studioId = s.id as string
        const [{ count: memberCount }, { count: classCount }] = await Promise.all([
          supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('studio_id', studioId).eq('status', 'active'),
          supabase.from('class_instances').select('*', { count: 'exact', head: true }).eq('studio_id', studioId).eq('status', 'scheduled'),
        ])
        setStudio({
          id: studioId, name: s.name as string, slug: s.slug as string,
          discipline: s.discipline as string, description: s.description as string | null,
          tier: s.tier as string, memberCount: memberCount ?? 0, upcomingClasses: classCount ?? 0,
        })
      }
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
        <Button size="lg">Create a studio</Button>
      </div>
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const todayClasses = isDemoMode()
    ? demoClasses.filter((c) => c.date === todayStr)
    : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{studio.name}</h1>
        <p className="text-muted-foreground capitalize">{studio.discipline} studio · {studio.tier} plan</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{studio.memberCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Classes</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{studio.upcomingClasses}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Classes</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{todayClasses.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Check-ins Today</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{todayClasses.reduce((sum, c) => sum + c.booked_count, 0)}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Schedule */}
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
                  <div key={cls.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium text-sm">{cls.template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(cls.start_time)} — {formatTime(cls.end_time)} · {cls.teacher.name}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{cls.booked_count}</span>
                      <span className="text-muted-foreground">/{cls.max_capacity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Community Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Community Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(isDemoMode() ? demoFeedPosts : []).map((post) => (
                <div key={post.id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {post.author[0]}
                    </div>
                    <span className="font-medium text-sm">{post.author}</span>
                    {post.class_name && (
                      <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{post.class_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground ml-8">{post.content}</p>
                  <div className="ml-8 mt-1 text-xs text-muted-foreground">❤️ {post.likes}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild><Link href="/dashboard/schedule">📅 Manage Schedule</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/members">👥 View Members</Link></Button>
            <Button variant="outline">📸 Check-in Mode</Button>
            <Button variant="outline">📊 View Reports</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
