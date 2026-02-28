'use client'

import { use, useState } from 'react'
import { getDemoMemberById, getDemoClassesForMember, getDemoMemberBadges, getDemoMemberStats } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatTime, formatDate, getRoleBadgeColor } from '@/lib/utils'
import Link from 'next/link'

interface CompClass {
  id: string
  count: number
  reason: string
  grantedLabel: string
  status: 'used' | 'available'
}

export default function DemoMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const member = getDemoMemberById(id)

  const compVariants: CompClass[][] = [
    [
      { id: 'comp-1', count: 1, reason: 'Holiday gift', grantedLabel: 'Granted Dec 2025', status: 'used' },
      { id: 'comp-2', count: 1, reason: 'Welcome bonus', grantedLabel: 'Granted on signup', status: 'available' },
    ],
    [
      { id: 'comp-1', count: 2, reason: 'Referral reward', grantedLabel: 'Granted Jan 2026', status: 'available' },
    ],
    [
      { id: 'comp-1', count: 1, reason: 'Class cancellation makeup', grantedLabel: 'Granted Nov 2025', status: 'used' },
      { id: 'comp-2', count: 3, reason: 'Loyalty bonus', grantedLabel: 'Granted Feb 2026', status: 'available' },
    ],
    [
      { id: 'comp-1', count: 1, reason: 'Birthday class', grantedLabel: 'Granted Oct 2025', status: 'used' },
    ],
    [],
  ]
  const memberIndex = parseInt(id.replace(/\D/g, '') || '0', 10) % compVariants.length
  const [compClasses, setCompClasses] = useState<CompClass[]>(compVariants[memberIndex]!)
  const [showCompForm, setShowCompForm] = useState(false)
  const [compCount, setCompCount] = useState(1)
  const [compReason, setCompReason] = useState('')

  if (!member) {
    return (
      <div className="space-y-4">
        <Link href="/demo/members" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to members
        </Link>
        <h1 className="text-2xl font-bold">Member not found</h1>
      </div>
    )
  }

  const classBookings = getDemoClassesForMember(id)
  const memberBadges = getDemoMemberBadges(id)
  const memberStats = getDemoMemberStats(id)

  function getBookingStatusColor(status: string) {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'booked': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  function handleGrantComp() {
    if (compCount < 1 || !compReason.trim()) return

    const now = new Date()
    const monthYear = now.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })

    const newComp: CompClass = {
      id: `comp-${Date.now()}`,
      count: compCount,
      reason: compReason.trim(),
      grantedLabel: `Granted ${monthYear}`,
      status: 'available',
    }

    setCompClasses((prev) => [...prev, newComp])
    setCompCount(1)
    setCompReason('')
    setShowCompForm(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-6">
          <Link href="/demo/members" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to members
          </Link>

          <div className="mt-4 flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {member.name[0]}
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              <p className="text-muted-foreground">{member.email}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${getRoleBadgeColor(member.role)}`}>
                  {member.role}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Joined {new Date(member.joined).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {memberStats && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Quick Stats</h3>
              <Link href={`/demo/members/${id}/stats`} className="text-sm text-primary hover:underline">
                View Stats &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{memberStats.totalClasses}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{memberStats.thisMonth}</div>
                <div className="text-xs text-muted-foreground">This Month</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{memberStats.currentStreak}w</div>
                <div className="text-xs text-muted-foreground">Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{memberStats.longestStreak}w</div>
                <div className="text-xs text-muted-foreground">Best</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {memberBadges.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Badges</h3>
              <Link href={`/demo/members/${id}/badges`} className="text-sm text-primary hover:underline">
                View all badges &rarr;
              </Link>
            </div>
            <div className="flex gap-3 flex-wrap">
              {memberBadges.map((mb) => (
                <div
                  key={mb.badge.id}
                  className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-lg"
                  title={`${mb.badge.name}: ${mb.badge.description}`}
                >
                  <span className="text-lg">{mb.badge.icon}</span>
                  <span className="text-xs font-medium">{mb.badge.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Class History</CardTitle>
        </CardHeader>
        <CardContent>
          {classBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No class history</p>
          ) : (
            <div className="space-y-3">
              {classBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <Link
                      href={`/demo/classes/${booking.class!.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {booking.class!.template.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(booking.class!.date)} &middot; {formatTime(booking.class!.start_time)}
                    </p>
                  </div>
                  <Badge className={getBookingStatusColor(booking.status)}>
                    {booking.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comp Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {compClasses.map((comp) => (
              <div key={comp.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">
                    {comp.count} comp {comp.count === 1 ? 'class' : 'classes'} &mdash; {comp.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">{comp.grantedLabel}</p>
                </div>
                <Badge className={comp.status === 'used' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'}>
                  {comp.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={() => setShowCompForm(true)}>Grant Comp Class</Button>
          </div>
        </CardContent>
      </Card>

      {showCompForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCompForm(false)}
          />
          <div className="relative bg-background rounded-lg shadow-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Grant Comp Class</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Number of classes</label>
                <Input
                  type="number"
                  min={1}
                  value={compCount}
                  onChange={(e) => setCompCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Reason</label>
                <Input
                  type="text"
                  placeholder="e.g. Holiday gift"
                  value={compReason}
                  onChange={(e) => setCompReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCompForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleGrantComp}>
                Grant
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
