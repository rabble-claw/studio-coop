'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import {
  getDemoClassById,
  getDemoBookingsForClass,
  getDemoAttendanceForClass,
  getDemoClassFeedPosts,
  getDemoMemberById,
  type DemoClass,
  type DemoAttendance,
} from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SpotPicker } from '@/components/spot-picker'
import { formatTime, formatDate, getRoleBadgeColor } from '@/lib/utils'

function downloadICS(cls: DemoClass) {
  const datePart = cls.date.replace(/-/g, '')
  const [sh = '00', sm = '00'] = cls.start_time.split(':')
  const [eh = '00', em = '00'] = cls.end_time.split(':')
  const dtStart = `${datePart}T${sh.padStart(2, '0')}${sm.padStart(2, '0')}00`
  const dtEnd = `${datePart}T${eh.padStart(2, '0')}${em.padStart(2, '0')}00`
  const summary = cls.template.name
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Studio Co-op//Booking//EN',
    'BEGIN:VEVENT',
    `UID:class-${cls.id}@studiocoop`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:Class with ${cls.teacher.name}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n'

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${summary.replace(/\s+/g, '-').toLowerCase()}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-700 text-white'
    case 'booked':
      return 'bg-blue-700 text-white'
    case 'cancelled':
      return 'bg-red-700 text-white'
    default:
      return 'bg-gray-600 text-white'
  }
}

type ClassFeedPost = {
  id: string
  class_id: string
  author: string
  author_id?: string
  content: string
  created_at: string
  media_urls: string[]
  reactions: Array<{ emoji: string; count: number }>
}

export default function DemoClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const cls = getDemoClassById(id)

  if (!cls) {
    return (
      <div className="space-y-4">
        <Link href="/demo/schedule" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to schedule
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Class not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <ClassDetailContent cls={cls} classId={id} />
}

function ClassDetailContent({ cls, classId }: { cls: DemoClass; classId: string }) {
  const bookings = getDemoBookingsForClass(classId)
  const initialAttendance = getDemoAttendanceForClass(classId)
  const initialFeedPosts = getDemoClassFeedPosts(classId)
  const fillPercent = (cls.booked_count / cls.max_capacity) * 100

  // Attendance state: map of member_id -> checked_in
  const [attendanceState, setAttendanceState] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const a of initialAttendance) {
      map[a.member_id] = a.checked_in
    }
    return map
  })

  // Feed state
  const [feedPosts, setFeedPosts] = useState<ClassFeedPost[]>(initialFeedPosts)
  const [newPostContent, setNewPostContent] = useState('')

  // Spot selection state
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null)
  const [booked, setBooked] = useState(false)

  // Compute taken spots from non-cancelled bookings
  const takenSpots = bookings
    .filter((b) => b.status !== 'cancelled' && b.spot != null)
    .map((b) => b.spot!)

  // Reactions state: track which reactions the user has toggled
  // Key: "postId-emoji", value: true if user has reacted
  const [userReactions, setUserReactions] = useState<Record<string, boolean>>({})

  function toggleCheckIn(memberId: string) {
    setAttendanceState((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }))
  }

  function handlePostSubmit() {
    const content = newPostContent.trim()
    if (!content) return
    const newPost: ClassFeedPost = {
      id: `cfp-new-${Date.now()}`,
      class_id: classId,
      author: 'You',
      content,
      created_at: new Date().toISOString(),
      media_urls: [],
      reactions: [],
    }
    setFeedPosts((prev) => [newPost, ...prev])
    setNewPostContent('')
  }

  function toggleReaction(postId: string, emoji: string) {
    const key = `${postId}-${emoji}`
    const alreadyReacted = userReactions[key] ?? false

    setUserReactions((prev) => ({
      ...prev,
      [key]: !alreadyReacted,
    }))

    setFeedPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          reactions: post.reactions.map((r) => {
            if (r.emoji !== emoji) return r
            return { ...r, count: alreadyReacted ? r.count - 1 : r.count + 1 }
          }),
        }
      })
    )
  }

  const nonCancelledBookings = bookings.filter((b) => b.status !== 'cancelled')
  const walkIns = initialAttendance.filter((a) => a.walk_in)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/demo/schedule" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to schedule
        </Link>
      </div>

      <Card>
        <CardContent className="py-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{cls.template.name}</h1>
              <p className="text-muted-foreground">
                {formatDate(cls.date)} &middot; {formatTime(cls.start_time)} &ndash; {formatTime(cls.end_time)} &middot; with {cls.teacher.name}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {cls.booked_count}/{cls.max_capacity} booked
              </span>
              <div className="flex-1 max-w-xs h-2 bg-secondary rounded-full">
                <div
                  className={`h-full rounded-full ${fillPercent > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(fillPercent, 100)}%` }}
                />
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => downloadICS(cls)}>
                Add to Calendar
              </Button>
            </div>

            {cls.template.description && (
              <p className="text-sm text-muted-foreground">{cls.template.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Spot Picker + Book */}
      {cls.status === 'scheduled' && !booked && (
        <Card>
          <CardContent className="py-6 space-y-4">
            <SpotPicker
              maxCapacity={cls.max_capacity}
              takenSpots={takenSpots}
              selectedSpot={selectedSpot}
              onSelectSpot={setSelectedSpot}
            />
            <Button
              className="w-full"
              onClick={() => setBooked(true)}
            >
              {selectedSpot ? `Book Class - Spot ${selectedSpot}` : 'Book Class'}
            </Button>
          </CardContent>
        </Card>
      )}

      {booked && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-green-700">
              Booked{selectedSpot ? ` - Spot ${selectedSpot}` : ''}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="feed">Feed</TabsTrigger>
        </TabsList>

        {/* Roster Tab */}
        <TabsContent value="roster">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Roster</CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet</p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {booking.member?.name?.[0] ?? '?'}
                        </div>
                        <div>
                          {booking.member ? (
                            <Link
                              href={`/demo/members/${booking.member.id}`}
                              className="font-medium hover:underline"
                            >
                              {booking.member.name}
                            </Link>
                          ) : (
                            <span className="font-medium">Unknown member</span>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {booking.member?.email ?? ''}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusBadgeColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Check-in Tab */}
        <TabsContent value="checkin">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Check-in</CardTitle>
            </CardHeader>
            <CardContent>
              {nonCancelledBookings.length === 0 && walkIns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendees for this class</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                    {nonCancelledBookings.map((booking) => {
                      const isCheckedIn = attendanceState[booking.member_id] ?? false
                      return (
                        <button
                          key={booking.id}
                          className="flex flex-col items-center gap-1 cursor-pointer"
                          onClick={() => toggleCheckIn(booking.member_id)}
                          title={isCheckedIn ? `Undo check-in for ${booking.member?.name ?? 'Unknown'}` : `Check in ${booking.member?.name ?? 'Unknown'}`}
                        >
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold relative transition-all ${
                              isCheckedIn
                                ? 'bg-emerald-700 text-white ring-2 ring-emerald-500'
                                : 'bg-gray-100 text-gray-500 ring-2 ring-gray-300 hover:ring-emerald-300'
                            }`}
                          >
                            {booking.member?.name?.[0] ?? '?'}
                            {isCheckedIn && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px]">
                                &#10003;
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground text-center truncate w-full">
                            {booking.member?.name ?? 'Unknown'}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {walkIns.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">Walk-ins</h4>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                        {walkIns.map((att) => {
                          const member = getDemoMemberById(att.member_id)
                          const memberName = member?.name ?? 'Walk-in'
                          const isCheckedIn = attendanceState[att.member_id] ?? att.checked_in
                          return (
                            <button
                              key={att.id}
                              className="flex flex-col items-center gap-1 cursor-pointer"
                              onClick={() => toggleCheckIn(att.member_id)}
                              title={isCheckedIn ? `Undo check-in for ${memberName}` : `Check in ${memberName}`}
                            >
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold relative transition-all ${
                                  isCheckedIn
                                    ? 'bg-emerald-700 text-white ring-2 ring-emerald-500'
                                    : 'bg-gray-100 text-gray-500 ring-2 ring-gray-300 hover:ring-emerald-300'
                                }`}
                              >
                                {memberName[0]}
                                {isCheckedIn && (
                                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px]">
                                    &#10003;
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground text-center truncate w-full">
                                {memberName}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feed Tab */}
        <TabsContent value="feed">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Class Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Post composer */}
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={2}
                    placeholder="Write a post..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handlePostSubmit()
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handlePostSubmit}
                      disabled={!newPostContent.trim()}
                    >
                      Post
                    </Button>
                  </div>
                </div>

                {feedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No posts for this class yet</p>
                ) : (
                  <div className="space-y-4">
                    {feedPosts.map((post) => (
                      <div key={post.id} className="flex gap-3">
                        {post.author_id ? (
                          <Link href={`/demo/members/${post.author_id}`} className="shrink-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {post.author[0]}
                            </div>
                          </Link>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {post.author[0]}
                          </div>
                        )}
                        <div className="space-y-1 flex-1">
                          <div className="text-sm">
                            {post.author_id ? (
                              <Link href={`/demo/members/${post.author_id}`} className="font-medium hover:underline">
                                {post.author}
                              </Link>
                            ) : (
                              <span className="font-medium">{post.author}</span>
                            )}
                          </div>
                          <p className="text-sm">{post.content}</p>
                          {post.media_urls && post.media_urls.length > 0 && (
                            <div className={`grid gap-2 ${post.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                              {post.media_urls.map((url: string, i: number) =>
                                url.includes('.mp4') || url.includes('.webm') ? (
                                  <video key={i} src={url} controls className="rounded-lg w-full max-h-48 object-cover" />
                                ) : (
                                  <img key={i} src={url} alt="" className="rounded-lg w-full max-h-48 object-cover" />
                                )
                              )}
                            </div>
                          )}
                          <div className="flex gap-2">
                            {post.reactions.map((reaction, idx) => {
                              const reactionKey = `${post.id}-${reaction.emoji}`
                              const hasReacted = userReactions[reactionKey] ?? false
                              return (
                                <button
                                  key={idx}
                                  onClick={() => toggleReaction(post.id, reaction.emoji)}
                                  className={`text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                                    hasReacted
                                      ? 'bg-primary/20 ring-1 ring-primary/40'
                                      : 'bg-muted hover:bg-muted/80'
                                  }`}
                                >
                                  {reaction.emoji} {reaction.count}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
