'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SpotPicker } from '@/components/spot-picker'
import { formatTime, formatDate } from '@/lib/utils'
import { subRequestApi } from '@/lib/api-client'

interface ClassDetail {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  notes: string | null
  feed_enabled: boolean
  studio_id: string
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

interface Reaction {
  emoji: string
  count: number
  reacted: boolean
}

interface FeedPost {
  id: string
  content: string | null
  media_urls: string[] | null
  post_type: string
  created_at: string
  user: { id: string; name: string; avatar_url: string | null }
  reactions: Reaction[]
}

function downloadICS(classInfo: ClassDetail) {
  const datePart = classInfo.date.replace(/-/g, '')
  const [sh = '00', sm = '00'] = classInfo.start_time.split(':')
  const [eh = '00', em = '00'] = classInfo.end_time.split(':')
  const dtStart = `${datePart}T${sh.padStart(2, '0')}${sm.padStart(2, '0')}00`
  const dtEnd = `${datePart}T${eh.padStart(2, '0')}${em.padStart(2, '0')}00`
  const summary = classInfo.template?.name ?? 'Class'
  const description = classInfo.teacher ? `Class with ${classInfo.teacher.name}` : ''
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Studio Co-op//Booking//EN',
    'BEGIN:VEVENT',
    `UID:class-${classInfo.id}@studiocoop`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n'

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${summary.replace(/\s+/g, '-').toLowerCase()}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

const REACTION_EMOJIS = ['❤️', '🔥', '👏']

function groupReactions(
  reactions: Array<{ post_id: string; emoji: string; user_id: string }>,
  viewerId: string,
): Record<string, Reaction[]> {
  const byPost: Record<string, Reaction[]> = {}
  for (const r of reactions) {
    if (!byPost[r.post_id]) byPost[r.post_id] = []
    const existing = byPost[r.post_id].find((x) => x.emoji === r.emoji)
    if (existing) {
      existing.count++
      if (r.user_id === viewerId) existing.reacted = true
    } else {
      byPost[r.post_id].push({ emoji: r.emoji, count: 1, reacted: r.user_id === viewerId })
    }
  }
  return byPost
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
  const [currentUserId, setCurrentUserId] = useState('')

  // Spot selection state
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null)
  const [bookingInProgress, setBookingInProgress] = useState(false)
  const [userBooking, setUserBooking] = useState<BookingWithUser | null>(null)

  // Feed composer state
  const [postText, setPostText] = useState('')
  const [postFile, setPostFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sub request state
  const [subRequest, setSubRequest] = useState<{ id: string; status: string; reason: string | null; requesting_teacher: { id: string; name: string } | null; substitute_teacher: { id: string; name: string } | null } | null>(null)
  const [showSubForm, setShowSubForm] = useState(false)
  const [subReason, setSubReason] = useState('')
  const [submittingSub, setSubmittingSub] = useState(false)
  const [isAssignedTeacher, setIsAssignedTeacher] = useState(false)

  const supabase = createClient()

  async function loadFeed(userId: string) {
    const { data: posts } = await supabase
      .from('feed_posts')
      .select('id, content, media_urls, post_type, created_at, user:users!feed_posts_user_id_fkey(id, name, avatar_url)')
      .eq('class_instance_id', classId)
      .order('created_at', { ascending: false })

    const postIds = (posts ?? []).map((p) => p.id)
    let reactionsByPost: Record<string, Reaction[]> = {}

    if (postIds.length > 0) {
      const { data: reactions } = await supabase
        .from('feed_reactions')
        .select('post_id, emoji, user_id')
        .in('post_id', postIds)
      reactionsByPost = groupReactions(reactions ?? [], userId)
    }

    setFeed(
      (posts ?? []).map((p) => {
        const u = p.user as unknown as { id: string; name: string; avatar_url: string | null }
        return {
          id: p.id,
          content: p.content,
          media_urls: p.media_urls,
          post_type: p.post_type,
          created_at: p.created_at,
          user: u,
          reactions: reactionsByPost[p.id] ?? [],
        }
      }),
    )
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: cls } = await supabase
        .from('class_instances')
        .select('*, teacher:users!class_instances_teacher_id_fkey(id, name, avatar_url), template:class_templates!class_instances_template_id_fkey(name, description)')
        .eq('id', classId)
        .single()

      if (!cls) return setLoading(false)
      setClassData(cls)

      const { data: membership } = await supabase
        .from('memberships')
        .select('role')
        .eq('studio_id', cls.studio_id)
        .eq('user_id', user.id)
        .single()

      const staffRoles = ['teacher', 'admin', 'owner']
      setIsStaff(staffRoles.includes(membership?.role ?? ''))

      const [{ data: bks }, { data: att }] = await Promise.all([
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
      ])

      setBookings(bks ?? [])
      setAttendance(att ?? [])

      // Check if current user already has a booking
      const myBooking = (bks ?? []).find((b: BookingWithUser) => b.user.id === user.id)
      if (myBooking) setUserBooking(myBooking)

      // Check if the current user is the assigned teacher
      if (cls.teacher_id === user.id) {
        setIsAssignedTeacher(true)
      }

      // Load sub request for this class
      try {
        const subs = await subRequestApi.list(cls.studio_id, 'all') as Array<{ id: string; status: string; reason: string | null; requesting_teacher: { id: string; name: string } | null; substitute_teacher: { id: string; name: string } | null; class_info: { id: string } | null }>
        const classSub = subs.find(s => s.class_info?.id === classId && (s.status === 'open' || s.status === 'accepted'))
        if (classSub) setSubRequest(classSub)
      } catch {
        // Sub requests may not be available
      }

      await loadFeed(user.id)
      setLoading(false)
    }
    load()
  }, [classId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBookClass() {
    if (!classData) return
    setBookingInProgress(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await fetch(`${API_URL}/studios/${classData.studio_id}/classes/${classId}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ spot: selectedSpot }),
      })

      if (res.ok) {
        const result = await res.json()
        // Update the spot on the booking in DB if spot was selected
        if (selectedSpot && result.bookingId) {
          await supabase
            .from('bookings')
            .update({ spot: String(selectedSpot) })
            .eq('id', result.bookingId)
        }
        // Refresh bookings
        const { data: bks } = await supabase
          .from('bookings')
          .select('*, user:users!bookings_user_id_fkey(id, name, email, avatar_url)')
          .eq('class_instance_id', classId)
          .in('status', ['booked', 'confirmed'])
          .order('booked_at')
        setBookings(bks ?? [])
        const myBooking = (bks ?? []).find((b: BookingWithUser) => b.user.id === user.id)
        if (myBooking) setUserBooking(myBooking)
      }
    } finally {
      setBookingInProgress(false)
    }
  }

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

    const { data: att } = await supabase
      .from('attendance')
      .select('*, user:users!attendance_user_id_fkey(id, name, avatar_url)')
      .eq('class_instance_id', classId)
    setAttendance(att ?? [])
  }

  async function submitPost() {
    if (!postText.trim() && !postFile) return
    if (!classData) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    let mediaUrls: string[] = []

    if (postFile) {
      const ext = postFile.type.split('/')[1].replace('jpeg', 'jpg')
      const path = `feed/${classData.studio_id}/${classId}/${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('feed-media')
        .upload(path, postFile, { contentType: postFile.type })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('feed-media').getPublicUrl(path)
        mediaUrls = [publicUrl]
      }
    }

    await supabase.from('feed_posts').insert({
      class_instance_id: classId,
      user_id: user.id,
      content: postText.trim() || null,
      media_urls: mediaUrls,
      post_type: 'post',
    })

    setPostText('')
    setPostFile(null)
    setSubmitting(false)
    await loadFeed(user.id)
  }

  async function toggleReaction(postId: string, emoji: string) {
    if (!currentUserId) return
    const post = feed.find((p) => p.id === postId)
    const existing = post?.reactions.find((r) => r.emoji === emoji && r.reacted)

    if (existing) {
      await supabase.from('feed_reactions').delete()
        .eq('post_id', postId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji)
    } else {
      await supabase.from('feed_reactions').upsert(
        { post_id: postId, user_id: currentUserId, emoji },
        { onConflict: 'post_id,user_id,emoji' },
      )
    }
    await loadFeed(currentUserId)
  }

  async function deletePost(postId: string) {
    await supabase.from('feed_posts').delete().eq('id', postId)
    await loadFeed(currentUserId)
  }

  async function handleRequestSub() {
    if (!classData) return
    setSubmittingSub(true)
    try {
      await subRequestApi.create(classData.studio_id, {
        class_instance_id: classId,
        reason: subReason || undefined,
      })
      setSubRequest({
        id: 'pending',
        status: 'open',
        reason: subReason || null,
        requesting_teacher: { id: currentUserId, name: 'You' },
        substitute_teacher: null,
      })
      setShowSubForm(false)
      setSubReason('')
    } catch {
      // handle error silently
    }
    setSubmittingSub(false)
  }

  async function handleAcceptSub() {
    if (!classData || !subRequest) return
    try {
      await subRequestApi.accept(classData.studio_id, subRequest.id)
      setSubRequest({ ...subRequest, status: 'accepted', substitute_teacher: { id: currentUserId, name: 'You' } })
    } catch {
      // handle error silently
    }
  }

  async function handleCancelSub() {
    if (!classData || !subRequest) return
    try {
      await subRequestApi.cancel(classData.studio_id, subRequest.id)
      setSubRequest(null)
    } catch {
      // handle error silently
    }
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
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Badge variant={classData.status === 'scheduled' ? 'secondary' : classData.status === 'completed' ? 'outline' : 'destructive'}>
            {classData.status}
          </Badge>
          <Badge variant="outline">{bookings.length}/{classData.max_capacity} booked</Badge>
          {classData.feed_enabled && <Badge variant="outline">Feed enabled</Badge>}
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => downloadICS(classData)}>
            Add to Calendar
          </Button>
        </div>
      </div>

      {/* Sub Request Section */}
      {subRequest && subRequest.status === 'open' && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-orange-800">Substitute requested</p>
                <p className="text-xs text-orange-700">
                  {subRequest.requesting_teacher?.name ?? 'Teacher'} needs a sub
                  {subRequest.reason && ` - ${subRequest.reason}`}
                </p>
              </div>
              <div className="flex gap-2">
                {isStaff && currentUserId !== subRequest.requesting_teacher?.id && (
                  <Button size="sm" onClick={handleAcceptSub}>Accept Sub</Button>
                )}
                {(currentUserId === subRequest.requesting_teacher?.id || isStaff) && (
                  <Button size="sm" variant="outline" onClick={handleCancelSub}>Cancel Request</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {subRequest && subRequest.status === 'accepted' && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-green-800">Substitute confirmed</p>
            <p className="text-xs text-green-700">
              {subRequest.substitute_teacher?.name ?? 'A teacher'} is covering this class
            </p>
          </CardContent>
        </Card>
      )}

      {isAssignedTeacher && classData.status === 'scheduled' && !subRequest && !showSubForm && (
        <Button variant="outline" className="mb-6" onClick={() => setShowSubForm(true)}>
          Request Substitute
        </Button>
      )}

      {showSubForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Request Substitute</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="sub-reason-detail" className="text-sm font-medium">Reason (optional)</label>
              <input
                id="sub-reason-detail"
                className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                value={subReason}
                onChange={(e) => setSubReason(e.target.value)}
                placeholder="e.g., Doctor appointment"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRequestSub} disabled={submittingSub}>
                {submittingSub ? 'Requesting...' : 'Request Sub'}
              </Button>
              <Button variant="outline" onClick={() => { setShowSubForm(false); setSubReason('') }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spot Picker + Book (for members who haven't booked yet) */}
      {classData.status === 'scheduled' && !userBooking && (
        <Card className="mb-6">
          <CardContent className="py-6 space-y-4">
            <SpotPicker
              maxCapacity={classData.max_capacity}
              takenSpots={bookings
                .filter((b) => b.spot != null)
                .map((b) => parseInt(b.spot!, 10))
                .filter((n) => !isNaN(n))}
              selectedSpot={selectedSpot}
              onSelectSpot={setSelectedSpot}
            />
            <Button
              className="w-full"
              onClick={handleBookClass}
              disabled={bookingInProgress}
            >
              {bookingInProgress
                ? 'Booking...'
                : selectedSpot
                  ? `Book Class - Spot ${selectedSpot}`
                  : 'Book Class'}
            </Button>
          </CardContent>
        </Card>
      )}

      {userBooking && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-green-700">
              You are booked for this class
              {userBooking.spot ? ` - Spot ${userBooking.spot}` : ''}
            </p>
          </CardContent>
        </Card>
      )}

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
              {/* Composer */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <textarea
                    className="w-full text-sm border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]"
                    placeholder="Share a moment from class..."
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4"
                      className="hidden"
                      onChange={(e) => setPostFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📷 {postFile ? postFile.name : 'Add photo'}
                    </Button>
                    {postFile && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setPostFile(null)}
                      >
                        Remove
                      </button>
                    )}
                    <Button
                      size="sm"
                      className="ml-auto"
                      disabled={submitting || (!postText.trim() && !postFile)}
                      onClick={submitPost}
                    >
                      {submitting ? 'Posting...' : 'Post'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Posts */}
              {feed.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No posts yet. Be the first to share!
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
                        <div className="flex-1">
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
                        {(post.user.id === currentUserId || isStaff) && (
                          <button
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => deletePost(post.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      {post.content && <p className="text-sm mb-3">{post.content}</p>}

                      {/* Media grid */}
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className={`grid gap-2 mb-3 ${post.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {post.media_urls.map((url, i) =>
                            url.includes('.mp4') ? (
                              <video
                                key={i}
                                src={url}
                                controls
                                className="rounded-lg w-full max-h-64 object-cover"
                              />
                            ) : (
                              <img
                                key={i}
                                src={url}
                                alt="Post media"
                                className="rounded-lg w-full max-h-64 object-cover cursor-pointer"
                                onClick={() => window.open(url, '_blank')}
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
                ))
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
