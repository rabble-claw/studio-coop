'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  getDemoClassById,
  getDemoBookingsForClass,
  getDemoAttendanceForClass,
  getDemoClassFeedPosts,
  getDemoMemberById,
  type DemoClass,
} from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatTime, formatDate, getRoleBadgeColor } from '@/lib/utils'

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-700'
    case 'booked':
      return 'bg-blue-100 text-blue-700'
    case 'cancelled':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
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

  const bookings = getDemoBookingsForClass(id)
  const attendance = getDemoAttendanceForClass(id)
  const feedPosts = getDemoClassFeedPosts(id)
  const fillPercent = (cls.booked_count / cls.max_capacity) * 100

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
            </div>

            {cls.template.description && (
              <p className="text-sm text-muted-foreground">{cls.template.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

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
              {(() => {
                const nonCancelledBookings = bookings.filter((b) => b.status !== 'cancelled')
                const attendanceMap = new Map(attendance.map((a) => [a.member_id, a]))
                const walkIns = attendance.filter((a) => a.walk_in)

                if (nonCancelledBookings.length === 0 && walkIns.length === 0) {
                  return <p className="text-sm text-muted-foreground">No attendees for this class</p>
                }

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                      {nonCancelledBookings.map((booking) => {
                        const att = attendanceMap.get(booking.member_id)
                        const isCheckedIn = att?.checked_in ?? false
                        return (
                          <div key={booking.id} className="flex flex-col items-center gap-1">
                            <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold relative ${
                                isCheckedIn
                                  ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                                  : 'bg-gray-100 text-gray-500 ring-2 ring-gray-300'
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
                          </div>
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
                            return (
                              <div key={att.id} className="flex flex-col items-center gap-1">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold bg-green-100 text-green-700 ring-2 ring-green-500 relative">
                                  {memberName[0]}
                                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px]">
                                    &#10003;
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground text-center truncate w-full">
                                  {memberName}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground italic">
                      Check-in is disabled in demo mode
                    </p>
                  </div>
                )
              })()}
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
                {/* Disabled input placeholder */}
                <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground bg-muted/50 cursor-not-allowed">
                  Write a post...
                </div>

                {feedPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No posts for this class yet</p>
                ) : (
                  <div className="space-y-4">
                    {feedPosts.map((post) => (
                      <div key={post.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {post.author[0]}
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="text-sm">
                            <span className="font-medium">{post.author}</span>
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
                            {post.reactions.map((reaction, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 rounded-full bg-muted"
                              >
                                {reaction.emoji} {reaction.count}
                              </span>
                            ))}
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
