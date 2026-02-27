'use client'

import { use } from 'react'
import Link from 'next/link'
import { getDemoMemberById, getDemoMemberStats } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DemoMemberStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const member = getDemoMemberById(id)
  const stats = getDemoMemberStats(id)

  if (!member || !stats) {
    return (
      <div className="space-y-4">
        <Link href={`/demo/members/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to member
        </Link>
        <h1 className="text-2xl font-bold">Stats not available</h1>
      </div>
    )
  }

  const maxBreakdown = Math.max(...stats.classBreakdown.map((c) => c.count))
  const maxMonthly = Math.max(...stats.monthlyHistory.map((m) => m.classes))

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/demo/members/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to {member.name}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{member.name}&apos;s Stats</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalClasses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.thisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.currentStreak} <span className="text-base font-normal text-muted-foreground">weeks</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Longest Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.longestStreak} <span className="text-base font-normal text-muted-foreground">weeks</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Favorite Class</p>
            <p className="font-semibold">{stats.favoriteClass}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Favorite Teacher</p>
            <p className="font-semibold">{stats.favoriteTeacher}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.classBreakdown.map((item) => (
              <div key={item.className}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{item.className}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(item.count / maxBreakdown) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {stats.monthlyHistory.map((item) => (
              <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium">{item.classes}</span>
                <div
                  className="w-full bg-primary rounded-t transition-all"
                  style={{ height: `${(item.classes / maxMonthly) * 100}%` }}
                />
                <span className="text-xs text-muted-foreground">{item.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {member.name} has attended {stats.thisMonth} classes this month, averaging{' '}
            {(stats.totalClasses / Math.max(stats.monthlyHistory.length, 1)).toFixed(1)} classes per month overall.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
