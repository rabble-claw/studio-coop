'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTime, formatDate } from '@/lib/utils'

interface ClassDetail {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  notes: string | null
  feed_enabled: boolean
  teacher: { id: string; name: string; avatar_url: string | null } | null
  template: { name: string; description: string | null } | null
}

interface BookingWithUser {
  id: string
  status: string
  spot: string | null
  user: { id: string; name: string; email: string; avatar_url: string | null }
}

interface AttendanceRecord {
  id: string
  checked_in: boolean
  walk_in: boolean
  user: { id: string; name: string; avatar_url: string | null }
}

interface FeedPost {
  id: string
  content: string | null
  post_type: string
  created_at: string
  user: { id: string; name: string; avatar_url: string | null }
}

export default function ClassDetailPage() {
  const params = useParams()
  const classId = params.id as string
  const [classData, setClassData] = useState<ClassDetail | null>(null)
  const [bookings, setBookings] = useState<BookingWithUser[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [feed, setFeed] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [isStaff, setIsStaff] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch class details
      const { data: cls } = await supabase
        .from('class_instances')
        .select('*, teacher:users!class_instances_teacher_id_fkey(id, name, avatar_url), template:class_templates!class_instances_template_id_fkey(name, description)')
        .eq('id', classId)
        .single()

      if (!cls) return setLoading(false)
      setClassData(cls)

      // Check if user is staff
      const { data: membership } = await supabase
        .from('memberships')
        .select('role')
        .eq('studio_id', cls.studio_id)
        .eq('user_id', user.id)
        .single()

      const staffRoles = ['teacher', 'admin', 'owner']
      setIsStaff(staffRoles.includes(membership?.role ?? ''))

      // Fetch bookings, attendance, feed in parallel
      const [{ data: bks }, { data: att }, { data: fd }] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, user:users!bookings_user_id_fkey(id, name, email, avatar_url)')
          .eq('class_instance_id', classId)
          .in('status', ['booked', 'confirmed'])
          .order('booked_at'),
        supabase
          .from('attendance')
          .select('*, user:users!attendance_user_id_fkey(id, name, avatar_url)')
          .eq('class_instance_id', classId),
        supabase
          .from('feed_posts')
          .select('*, user:users!feed_posts_user_id_fkey(id, name, avatar_url)')
          .eq('class_instance_id', classId)
          .order('created_at', { ascending: false }),
      ])

      setBookings(bks ?? [])
      setAttendance(att ?? [])
      setFeed(fd ?? [])
      setLoading(false)
    }
    load()
  }, [classId, supabase])

  async function toggleCheckIn(userId: string) {
    const existing = attendance.find((a) => a.user.id === userId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (existing) {
      await supabase
        .from('attendance')
        .update({ checked_in: !existing.checked_in, checked_in_at: new Date().toISOString(), checked_in_by: user.id })
        .eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert({
        class_instance_id: classId,
        user_id: userId,
        checked_in: true,
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id,
      })
    }

    // Reload attendance
    const { data: att } = await supabase
      .from('attendance')
      .select('*, user:users!attendance_user_id_fkey(id, name, avatar_url)')
      .eq('class_instance_id', classId)
    setAttendance(att ?? [])
  }

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading class...</div>
  }

  if (!classData) {
    return <div className="text-muted-foreground py-20 text-center">Class not found.</div>
  }

  return (
    <div>
      <Link href="/dashboard/schedule" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        &larr; Back to schedule
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{classData.template?.name ?? 'Untitled Class'}</h1>
        <p className="text-muted-foreground mt-1">
          {formatDate(classData.date)} &middot; {formatTime(classData.start_time)} — {formatTime(classData.end_time)}
          {classData.teacher && ` with ${classData.teacher.name}`}
        </p>
        {classData.template?.description && (
          <p className="text-sm text-muted-foreground mt-2">{classData.template.description}</p>
        )}
        <div className="flex gap-2 mt-3">
          <Badge variant={classData.status === 'scheduled' ? 'secondary' : classData.status === 'completed' ? 'outline' : 'destructive'}>
            {classData.status}
          </Badge>
          <Badge variant="outline">{bookings.length}/{classData.max_capacity} booked</Badge>
          {classData.feed_enabled && <Badge variant="outline">Feed enabled</Badge>}
        </div>
      </div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster ({bookings.length})</TabsTrigger>
          {isStaff && <TabsTrigger value="checkin">Check-in</TabsTrigger>}
          {classData.feed_enabled && <TabsTrigger value="feed">Feed ({feed.length})</TabsTrigger>}
        </TabsList>

        {/* Roster */}
        <TabsContent value="roster">
          <div className="space-y-2 mt-4">
            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bookings yet.</p>
            ) : (
              bookings.map((b) => {
                const isCheckedIn = attendance.find((a) => a.user.id === b.user.id)?.checked_in
                return (
                  <Card key={b.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={b.user.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {b.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{b.user.name}</div>
                          <div className="text-xs text-muted-foreground">{b.user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCheckedIn && <Badge className="bg-green-100 text-green-800">Checked in</Badge>}
                        <Badge variant="outline">{b.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Check-in (staff only) */}
        {isStaff && (
          <TabsContent value="checkin">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Quick Check-in</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Tap a member to toggle their check-in status.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {bookings.map((b) => {
                    const isCheckedIn = attendance.find((a) => a.user.id === b.user.id)?.checked_in
                    return (
                      <button
                        key={b.id}
                        onClick={() => toggleCheckIn(b.user.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          isCheckedIn
                            ? 'border-green-500 bg-green-50'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={b.user.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {b.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-center">{b.user.name}</span>
                        {isCheckedIn && <span className="text-xs text-green-600 font-medium">Present</span>}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Feed */}
        {classData.feed_enabled && (
          <TabsContent value="feed">
            <div className="space-y-4 mt-4">
              {feed.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No posts yet. Attendees can post after class.
                </p>
              ) : (
                feed.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={post.user.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {post.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{post.user.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(post.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {post.content && <p className="text-sm">{post.content}</p>}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
