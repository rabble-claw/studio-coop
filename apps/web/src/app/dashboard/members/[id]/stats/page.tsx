'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// TODO: These stats are computed client-side from Supabase queries.
// For performance at scale, add a dedicated API endpoint:
//   GET /api/studios/:studioId/members/:memberId/stats
// which could return pre-aggregated streak, favorite class/teacher, monthly counts, and badge data.

// ── Badge definitions ────────────────────────────────────────────────────────

interface BadgeDef {
  id: string
  emoji: string
  label: string
  description: string
}

const BADGE_DEFS: BadgeDef[] = [
  { id: 'first_class', emoji: '⭐', label: 'First Class', description: 'Attended their very first class' },
  { id: 'streak_7d', emoji: '🔥', label: '7-Day Streak', description: 'Attended at least once per week for 1 week' },
  { id: 'streak_4w', emoji: '💪', label: '4-Week Streak', description: 'Attended at least once per week for 4 consecutive weeks' },
  { id: 'classes_10', emoji: '🎯', label: '10 Classes', description: 'Attended 10 classes' },
  { id: 'classes_25', emoji: '🏅', label: '25 Classes', description: 'Attended 25 classes' },
  { id: 'classes_50', emoji: '🥈', label: '50 Classes', description: 'Attended 50 classes' },
  { id: 'classes_100', emoji: '💯', label: '100 Classes', description: 'Attended 100 classes — legend!' },
  { id: 'regular', emoji: '🏆', label: 'Regular', description: '4+ classes per month for 3 consecutive months' },
]

function computeBadges(
  totalClasses: number,
  streakWeeks: number,
  longestStreak: number,
  monthlyHistory: { month: string; count: number }[],
): string[] {
  const earned: string[] = []

  if (totalClasses >= 1) earned.push('first_class')
  if (longestStreak >= 1 || streakWeeks >= 1) earned.push('streak_7d')
  if (longestStreak >= 4 || streakWeeks >= 4) earned.push('streak_4w')
  if (totalClasses >= 10) earned.push('classes_10')
  if (totalClasses >= 25) earned.push('classes_25')
  if (totalClasses >= 50) earned.push('classes_50')
  if (totalClasses >= 100) earned.push('classes_100')

  // Regular: 4+ classes/month for 3 consecutive months
  const sorted = [...monthlyHistory].sort((a, b) => (a.month > b.month ? 1 : -1))
  let consecutive = 0
  let maxConsecutive = 0
  for (const m of sorted) {
    if (m.count >= 4) {
      consecutive++
      maxConsecutive = Math.max(maxConsecutive, consecutive)
    } else {
      consecutive = 0
    }
  }
  if (maxConsecutive >= 3) earned.push('regular')

  return earned
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRow {
  id: string
  class_instance_id: string
  date: string
  class_name: string
  teacher_name: string | null
}

interface MemberInfo {
  name: string
  studioId: string
}

interface MonthlyCount {
  month: string
  count: number
}

// ── Week key helper (matches server logic) ───────────────────────────────────

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dayOfWeek = d.getUTCDay()
  const weekStart = new Date(d)
  weekStart.setUTCDate(d.getUTCDate() - dayOfWeek)
  const year = weekStart.getUTCFullYear()
  const startOfYear = new Date(`${year}-01-01T00:00:00Z`)
  const diff = Math.floor((weekStart.getTime() - startOfYear.getTime()) / 86400000)
  const week = Math.floor(diff / 7) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

function computeStreaks(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 }

  const weekSet = new Set(dates.map(getWeekKey))
  const today = new Date()

  // Current streak: consecutive weeks back from now
  let current = 0
  for (let i = 0; i < 52; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    const key = getWeekKey(d.toISOString().slice(0, 10))
    if (weekSet.has(key)) {
      current++
    } else if (i > 0) {
      break
    }
  }

  // Longest streak: scan sorted week keys
  const sortedWeeks = Array.from(weekSet).sort()
  let longest = 0
  let run = 0
  let prevYear = 0
  let prevWeek = 0
  for (const key of sortedWeeks) {
    const [yearStr, weekStr] = key.split('-W')
    const yr = parseInt(yearStr)
    const wk = parseInt(weekStr)
    const isConsecutive =
      (yr === prevYear && wk === prevWeek + 1) ||
      (yr === prevYear + 1 && prevWeek >= 52 && wk === 1)
    if (isConsecutive) {
      run++
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    prevYear = yr
    prevWeek = wk
  }

  return { current, longest }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MemberStatsPage() {
  const params = useParams()
  const memberId = params.id as string
  const supabase = useRef(createClient()).current

  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not authenticated'); setLoading(false); return }

        // Get member info from memberships
        const { data: membership } = await supabase
          .from('memberships')
          .select('studio_id, user:users!memberships_user_id_fkey(name)')
          .eq('user_id', memberId)
          .single()

        if (!membership) { setError('Member not found'); setLoading(false); return }

        const u = Array.isArray(membership.user) ? membership.user[0] : membership.user
        setMemberInfo({ name: (u as { name: string })?.name ?? 'Unknown', studioId: membership.studio_id })

        // Get studio's class instance IDs (to scope attendance to this studio)
        const { data: studioClasses } = await supabase
          .from('class_instances')
          .select('id, date, template:class_templates!class_instances_template_id_fkey(name), teacher:users!class_instances_teacher_id_fkey(name)')
          .eq('studio_id', membership.studio_id)
          .order('date', { ascending: false })

        const classMap = new Map<string, { date: string; className: string; teacherName: string | null }>()
        for (const c of studioClasses ?? []) {
          const tmpl = c.template as { name: string } | null
          const teacher = c.teacher as { name: string } | null
          classMap.set(c.id, {
            date: c.date,
            className: tmpl?.name ?? 'Unknown',
            teacherName: teacher?.name ?? null,
          })
        }

        const classIds = Array.from(classMap.keys())
        if (classIds.length === 0) { setLoading(false); return }

        // Get this member's checked-in attendance
        const { data: att } = await supabase
          .from('attendance')
          .select('id, class_instance_id')
          .eq('user_id', memberId)
          .eq('checked_in', true)
          .in('class_instance_id', classIds)

        const rows: AttendanceRow[] = (att ?? [])
          .map((a) => {
            const cls = classMap.get(a.class_instance_id)
            return {
              id: a.id,
              class_instance_id: a.class_instance_id,
              date: cls?.date ?? '',
              class_name: cls?.className ?? 'Unknown',
              teacher_name: cls?.teacherName ?? null,
            }
          })
          .filter((r) => r.date !== '')
          .sort((a, b) => (b.date > a.date ? 1 : -1))

        setAttendance(rows)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [memberId, supabase])

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading member stats...</div>
  }

  if (error || !memberInfo) {
    return (
      <div className="text-red-600 py-20 text-center">
        {error ?? 'Failed to load.'}{' '}
        <Link href={`/dashboard/members/${memberId}`} className="underline text-primary">Back to member</Link>
      </div>
    )
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  const totalClasses = attendance.length

  const dates = attendance.map((a) => a.date)
  const { current: currentStreak, longest: longestStreak } = computeStreaks(dates)

  // Classes by type
  const byType = new Map<string, number>()
  for (const a of attendance) {
    byType.set(a.class_name, (byType.get(a.class_name) ?? 0) + 1)
  }
  const classCounts = Array.from(byType.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  const favoriteClass = classCounts[0]?.name ?? null

  // Favorite teacher
  const byTeacher = new Map<string, number>()
  for (const a of attendance) {
    if (a.teacher_name) {
      byTeacher.set(a.teacher_name, (byTeacher.get(a.teacher_name) ?? 0) + 1)
    }
  }
  const teacherCounts = Array.from(byTeacher.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  const favoriteTeacher = teacherCounts[0]?.name ?? null

  // Monthly attendance (last 6 months)
  const monthlyMap = new Map<string, number>()
  for (const a of attendance) {
    const key = a.date.slice(0, 7) // YYYY-MM
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1)
  }
  const now = new Date()
  const monthlyHistory: MonthlyCount[] = []
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    monthlyHistory.push({ month: label, count: monthlyMap.get(key) ?? 0 })
  }

  const maxMonthly = Math.max(...monthlyHistory.map((m) => m.count), 1)

  // Badges
  const earnedBadgeIds = computeBadges(totalClasses, currentStreak, longestStreak, monthlyHistory)
  const earnedBadges = BADGE_DEFS.filter((b) => earnedBadgeIds.includes(b.id))
  const unearnedBadges = BADGE_DEFS.filter((b) => !earnedBadgeIds.includes(b.id))

  // This month
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthCount = monthlyMap.get(thisMonthKey) ?? 0

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/members/${memberId}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to {memberInfo.name}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{memberInfo.name} — Stats</h1>
        <p className="text-muted-foreground">{totalClasses} total classes attended</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalClasses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currentStreak > 0 ? `${currentStreak}w` : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">consecutive weeks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Longest Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{longestStreak > 0 ? `${longestStreak}w` : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">all-time best</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{thisMonthCount}</div>
            <p className="text-xs text-muted-foreground mt-1">classes</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges &amp; Achievements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {earnedBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No badges earned yet — keep showing up!</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {earnedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border bg-amber-50 border-amber-200 min-w-[80px]"
                  title={badge.description}
                >
                  <span className="text-3xl">{badge.emoji}</span>
                  <span className="text-xs font-semibold text-amber-800 text-center leading-tight">{badge.label}</span>
                </div>
              ))}
            </div>
          )}
          {unearnedBadges.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {unearnedBadges.length} badge{unearnedBadges.length !== 1 ? 's' : ''} not yet earned
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {unearnedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-muted bg-muted/30"
                    title={badge.description}
                  >
                    <span className="text-lg grayscale opacity-40">{badge.emoji}</span>
                    <span className="text-xs text-muted-foreground">{badge.label}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Favorites */}
      {(favoriteClass || favoriteTeacher) && (
        <Card>
          <CardHeader>
            <CardTitle>Favorites</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Favorite Class</div>
              <div className="font-medium">{favoriteClass ?? '—'}</div>
              {favoriteClass && (
                <div className="text-xs text-muted-foreground">{byType.get(favoriteClass)} times attended</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Favorite Teacher</div>
              <div className="font-medium">{favoriteTeacher ?? '—'}</div>
              {favoriteTeacher && (
                <div className="text-xs text-muted-foreground">{byTeacher.get(favoriteTeacher)} classes together</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Classes by type */}
      {classCounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Classes by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {classCounts.map((c) => (
                <div key={c.name} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-0.5">
                      <span>{c.name}</span>
                      <span className="font-medium">{c.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(c.count / (classCounts[0]?.count ?? 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly attendance chart (CSS bars) */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Attendance (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-32">
            {monthlyHistory.map((p) => (
              <div key={p.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs font-medium text-muted-foreground">{p.count || ''}</div>
                <div className="w-full flex items-end" style={{ height: '80px' }}>
                  <div
                    className="w-full bg-primary rounded-t transition-all"
                    style={{ height: `${(p.count / maxMonthly) * 100}%`, minHeight: p.count > 0 ? '4px' : '0' }}
                  />
                </div>
                <div className="text-xs text-muted-foreground text-center leading-tight">{p.month}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent attendance */}
      {attendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendance.slice(0, 10).map((a) => (
                <div key={a.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                  <div>
                    <span className="font-medium">{a.class_name}</span>
                    {a.teacher_name && (
                      <span className="text-muted-foreground ml-2">with {a.teacher_name}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
              {attendance.length > 10 && (
                <p className="text-xs text-muted-foreground pt-1">+{attendance.length - 10} more classes</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
