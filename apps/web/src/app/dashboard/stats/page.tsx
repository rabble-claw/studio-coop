'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// TODO: Wire to real API endpoints once available:
//   - Revenue summary: GET /api/studios/:studioId/reports/revenue
//   - Retention rate: GET /api/studios/:studioId/reports/retention
//   - Top teachers: GET /api/studios/:studioId/reports/teachers

interface StudioStats {
  studioId: string
  totalMembers: number
  activeMembers: number
  newThisMonth: number
  avgAttendanceRate: number
  totalClassesThisMonth: number
  totalCheckins: number
}

interface WeeklyAttendance {
  week: string
  classes: number
  checkins: number
  rate: number
}

interface TeacherStat {
  teacherId: string
  name: string
  classCount: number
  totalCheckins: number
}

interface MemberGrowthPoint {
  month: string
  count: number
}

interface ClassTypeStat {
  name: string
  count: number
  checkins: number
  fillRate: number
  capacity: number
}

export default function StatsPage() {
  const supabase = useRef(createClient()).current

  const [stats, setStats] = useState<StudioStats | null>(null)
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeeklyAttendance[]>([])
  const [teacherStats, setTeacherStats] = useState<TeacherStat[]>([])
  const [memberGrowth, setMemberGrowth] = useState<MemberGrowthPoint[]>([])
  const [classTypeStats, setClassTypeStats] = useState<ClassTypeStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not authenticated'); setLoading(false); return }

        // Get the user's studio
        const { data: membership } = await supabase
          .from('memberships')
          .select('studio_id, role')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .single()

        if (!membership?.studio_id) { setError('No studio found'); setLoading(false); return }

        const studioId = membership.studio_id
        const now = new Date()
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0]
        const todayStr = now.toISOString().split('T')[0]

        // ── Member counts ──────────────────────────────────────────────────────
        const [
          { count: totalMembers },
          { count: activeMembers },
          { count: newThisMonth },
        ] = await Promise.all([
          supabase.from('memberships').select('*', { count: 'exact', head: true })
            .eq('studio_id', studioId),
          supabase.from('memberships').select('*', { count: 'exact', head: true })
            .eq('studio_id', studioId).eq('status', 'active'),
          supabase.from('memberships').select('*', { count: 'exact', head: true })
            .eq('studio_id', studioId).gte('joined_at', firstOfMonthStr),
        ])

        // ── This month's class instances ───────────────────────────────────────
        const { data: thisMonthClasses } = await supabase
          .from('class_instances')
          .select('id, max_capacity, template:class_templates!class_instances_template_id_fkey(name), teacher:users!class_instances_teacher_id_fkey(id, name)')
          .eq('studio_id', studioId)
          .gte('date', firstOfMonthStr)
          .lte('date', todayStr)
          .in('status', ['completed', 'in_progress'])

        const classIds = (thisMonthClasses ?? []).map((c) => c.id)

        // ── Attendance for those classes ───────────────────────────────────────
        const { data: attendanceData } = classIds.length > 0
          ? await supabase
              .from('attendance')
              .select('class_instance_id, user_id, checked_in')
              .in('class_instance_id', classIds)
              .eq('checked_in', true)
          : { data: [] }

        const checkinsByClass = new Map<string, number>()
        for (const a of attendanceData ?? []) {
          checkinsByClass.set(a.class_instance_id, (checkinsByClass.get(a.class_instance_id) ?? 0) + 1)
        }

        const totalCheckins = attendanceData?.length ?? 0
        const totalClassCount = thisMonthClasses?.length ?? 0
        const avgRate = totalClassCount > 0
          ? (thisMonthClasses ?? []).reduce((sum, c) => {
              const checkins = checkinsByClass.get(c.id) ?? 0
              const cap = c.max_capacity || 1
              return sum + Math.min(checkins / cap, 1)
            }, 0) / totalClassCount
          : 0

        setStats({
          studioId,
          totalMembers: totalMembers ?? 0,
          activeMembers: activeMembers ?? 0,
          newThisMonth: newThisMonth ?? 0,
          avgAttendanceRate: avgRate,
          totalClassesThisMonth: totalClassCount,
          totalCheckins,
        })

        // ── Weekly attendance trend (last 4 weeks) ─────────────────────────────
        const weeklyData: WeeklyAttendance[] = []
        for (let w = 3; w >= 0; w--) {
          const weekEnd = new Date(now)
          weekEnd.setDate(now.getDate() - w * 7)
          const weekStart = new Date(weekEnd)
          weekStart.setDate(weekEnd.getDate() - 6)
          const fromStr = weekStart.toISOString().split('T')[0]
          const toStr = weekEnd.toISOString().split('T')[0]

          const { data: weekClasses } = await supabase
            .from('class_instances')
            .select('id, max_capacity')
            .eq('studio_id', studioId)
            .gte('date', fromStr)
            .lte('date', toStr)
            .in('status', ['completed', 'in_progress'])

          const weekClassIds = (weekClasses ?? []).map((c) => c.id)
          const { count: weekCheckins } = weekClassIds.length > 0
            ? await supabase
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .in('class_instance_id', weekClassIds)
                .eq('checked_in', true)
            : { count: 0 }

          const totalCap = (weekClasses ?? []).reduce((sum, c) => sum + (c.max_capacity ?? 0), 0)
          const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          weeklyData.push({
            week: label,
            classes: weekClassIds.length,
            checkins: weekCheckins ?? 0,
            rate: totalCap > 0 ? Math.min((weekCheckins ?? 0) / totalCap, 1) : 0,
          })
        }
        setWeeklyAttendance(weeklyData)

        // ── Top teachers ───────────────────────────────────────────────────────
        const teacherMap = new Map<string, { name: string; classCount: number; totalCheckins: number }>()
        for (const cls of thisMonthClasses ?? []) {
          const teacher = cls.teacher as { id: string; name: string } | null
          if (!teacher?.id) continue
          const existing = teacherMap.get(teacher.id) ?? { name: teacher.name, classCount: 0, totalCheckins: 0 }
          existing.classCount++
          existing.totalCheckins += checkinsByClass.get(cls.id) ?? 0
          teacherMap.set(teacher.id, existing)
        }
        const teachers: TeacherStat[] = Array.from(teacherMap.entries())
          .map(([id, d]) => ({ teacherId: id, ...d }))
          .sort((a, b) => b.classCount - a.classCount)
          .slice(0, 5)
        setTeacherStats(teachers)

        // ── Class type stats ───────────────────────────────────────────────────
        const classTypeMap = new Map<string, { count: number; checkins: number; totalCap: number }>()
        for (const cls of thisMonthClasses ?? []) {
          const name = (cls.template as { name: string } | null)?.name ?? 'Unknown'
          const existing = classTypeMap.get(name) ?? { count: 0, checkins: 0, totalCap: 0 }
          existing.count++
          existing.checkins += checkinsByClass.get(cls.id) ?? 0
          existing.totalCap += cls.max_capacity ?? 0
          classTypeMap.set(name, existing)
        }
        const classTypes: ClassTypeStat[] = Array.from(classTypeMap.entries())
          .map(([name, d]) => ({
            name,
            count: d.count,
            checkins: d.checkins,
            fillRate: d.totalCap > 0 ? d.checkins / d.totalCap : 0,
            capacity: d.totalCap,
          }))
          .sort((a, b) => b.checkins - a.checkins)
          .slice(0, 8)
        setClassTypeStats(classTypes)

        // ── Member growth (last 6 months) ──────────────────────────────────────
        const growthPoints: MemberGrowthPoint[] = []
        for (let m = 5; m >= 0; m--) {
          const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
          const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
          const { count } = await supabase
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('studio_id', studioId)
            .lte('joined_at', endOfMonth.toISOString())
          growthPoints.push({ month: label, count: count ?? 0 })
        }
        setMemberGrowth(growthPoints)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading stats...</div>
  }

  if (error || !stats) {
    return <div className="text-red-600 py-20 text-center">{error ?? 'Failed to load stats.'}</div>
  }

  const maxGrowth = Math.max(...memberGrowth.map((p) => p.count), 1)
  const maxWeekly = Math.max(...weeklyAttendance.map((w) => w.checkins), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Studio Stats</h1>
        <p className="text-muted-foreground">Performance overview for this month</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.newThisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Fill Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(stats.avgAttendanceRate * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">of capacity used</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalCheckins}</div>
            <p className="text-xs text-muted-foreground mt-1">across {stats.totalClassesThisMonth} classes</p>
          </CardContent>
        </Card>
      </div>

      {/* TODO: Revenue summary card — needs GET /api/studios/:studioId/reports/revenue */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Revenue data coming soon — requires <code className="text-xs bg-secondary px-1 rounded">/api/studios/:id/reports/revenue</code> endpoint.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance Trend</TabsTrigger>
          <TabsTrigger value="teachers">Top Teachers</TabsTrigger>
          <TabsTrigger value="classes">Class Types</TabsTrigger>
          <TabsTrigger value="growth">Member Growth</TabsTrigger>
        </TabsList>

        {/* Weekly attendance trend */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Attendance (Last 4 Weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyAttendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance data available.</p>
              ) : (
                <div className="space-y-3">
                  {weeklyAttendance.map((w) => (
                    <div key={w.week} className="flex items-center gap-4">
                      <div className="w-16 text-sm text-muted-foreground shrink-0">{w.week}</div>
                      <div className="flex-1">
                        <div className="h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${maxWeekly > 0 ? (w.checkins / maxWeekly) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-36 text-sm text-right shrink-0">
                        <span className="font-medium">{w.checkins}</span>
                        <span className="text-muted-foreground"> check-ins</span>
                        {w.classes > 0 && (
                          <span className="text-muted-foreground"> · {(w.rate * 100).toFixed(0)}% fill</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top teachers */}
        <TabsContent value="teachers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Teachers This Month</CardTitle>
            </CardHeader>
            <CardContent>
              {teacherStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teacher data for this period.</p>
              ) : (
                <div className="space-y-3">
                  {teacherStats.map((t, i) => (
                    <div key={t.teacherId} className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.classCount} classes · {t.totalCheckins} check-ins
                        </div>
                      </div>
                      <div className="text-sm font-medium text-right shrink-0">
                        {t.classCount > 0
                          ? (t.totalCheckins / t.classCount).toFixed(1)
                          : '0'} avg
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Class type stats */}
        <TabsContent value="classes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Class Types This Month</CardTitle>
            </CardHeader>
            <CardContent>
              {classTypeStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No class data for this period.</p>
              ) : (
                <div className="space-y-3">
                  {classTypeStats.map((c) => (
                    <div key={c.name} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground">{c.count} classes · {c.checkins} check-ins</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(c.fillRate * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-12 text-sm text-right shrink-0 font-medium">
                        {(c.fillRate * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Member growth chart (CSS bars) */}
        <TabsContent value="growth" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Growth (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {memberGrowth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No growth data available.</p>
              ) : (
                <div className="flex items-end gap-3 h-40">
                  {memberGrowth.map((p) => (
                    <div key={p.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs font-medium text-muted-foreground">{p.count}</div>
                      <div className="w-full flex items-end" style={{ height: '100px' }}>
                        <div
                          className="w-full bg-primary rounded-t transition-all"
                          style={{ height: `${(p.count / maxGrowth) * 100}%`, minHeight: p.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-center">{p.month}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 text-sm">
        <Link href="/dashboard/reports" className="text-primary hover:underline">→ Full Reports</Link>
        <Link href="/dashboard/members" className="text-primary hover:underline">→ Members</Link>
      </div>
    </div>
  )
}
