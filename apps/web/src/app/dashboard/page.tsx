'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's studio membership (first one for now)
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

        // Get counts
        const [{ count: memberCount }, { count: classCount }] = await Promise.all([
          supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('studio_id', studioId).eq('status', 'active'),
          supabase.from('class_instances').select('*', { count: 'exact', head: true }).eq('studio_id', studioId).eq('status', 'scheduled'),
        ])

        setStudio({
          id: studioId,
          name: s.name as string,
          slug: s.slug as string,
          discipline: s.discipline as string,
          description: s.description as string | null,
          tier: s.tier as string,
          memberCount: memberCount ?? 0,
          upcomingClasses: classCount ?? 0,
        })
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading your studio...</div>
      </div>
    )
  }

  if (!studio) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <h2 className="text-2xl font-bold mb-2">Welcome to Studio Co-op!</h2>
        <p className="text-muted-foreground mb-6">
          You&apos;re not part of a studio yet. Create one to get started.
        </p>
        <Button size="lg">Create a studio</Button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{studio.name}</h1>
        <p className="text-muted-foreground mt-1">
          {studio.discipline.charAt(0).toUpperCase() + studio.discipline.slice(1)} studio
          {studio.description && ` — ${studio.description}`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{studio.memberCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{studio.upcomingClasses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold capitalize">{studio.tier}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/schedule">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>📅</span> Class Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and manage your class schedule. Create templates, edit instances, and track attendance.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/members">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>👥</span> Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage your community. View members, assign roles, and add notes.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/${studio.slug}`}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🌐</span> Public Page
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View your public studio page at studio.coop/{studio.slug}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <span>⚙️</span> Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Studio settings, billing, and integrations coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
