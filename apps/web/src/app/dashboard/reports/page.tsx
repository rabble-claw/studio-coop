'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyAttendance {
  week: string   // ISO week start date YYYY-MM-DD
  label: string  // e.g. "Feb 3"
  classes: number
  checkins: number
  capacity: number
  rate: number
}

interface MonthlyRevenue {
  month: string  // YYYY-MM
  label: string  // e.g. "Jan"
  total: number
  subscriptions: number
  dropins: number
  packs: number
  privateSessions: number
}

interface PopularClass {
  name: string
  totalInstances: number
  totalCheckins: number
  totalCapacity: number
  avgCapacity: number
  avgAttendance: number
  fillRate: number
}

interface AtRiskMember {
  name: string
  daysSinceLast: number
}

interface RetentionData {
  activeMembers: number
  newThisMonth: number
  cancelledThisMonth: number
  monthlyRetentionRate: number
  avgClassesPerMemberPerWeek: number
  atRisk: AtRiskMember[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=Sun
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // YYYY-MM
}

function monthLabel(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr + 'T00:00:00Z')
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function dateFromOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── Bar chart component ──────────────────────────────────────────────────────

function BarChart({
  value,
  max,
  color = 'bg-primary',
  height = 'h-5',
}: {
  value: number
  max: number
  color?: string
  height?: string
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={`w-full ${height} bg-muted rounded-full overflow-hidden`}>
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function StackedBar({
  segments,
  total,
  height = 'h-4',
}: {
  segments: { value: number; color: string; label: string }[]
  total: number
  height?: string
}) {
  return (
    <div className={`flex w-full ${height} rounded-full overflow-hidden bg-muted`}>
      {segments.map((seg) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0
        return pct > 0 ? (
          <div
            key={seg.label}
            className={`h-full ${seg.color} transition-all duration-500`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: $${formatCents(seg.value)}`}
          />
        ) : null
      })}
    </div>
  )
}

// ─── Summary stat card ────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  trend,
}: {
  title: string
  value: string
  sub?: string
  trend?: { dir: 'up' | 'down' | 'neutral'; label: string }
}) {
  const trendColor =
    trend?.dir === 'up'
      ? 'text-green-600'
      : trend?.dir === 'down'
      ? 'text-red-500'
      : 'text-muted-foreground'
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {trend && <p className={`text-xs mt-1 ${trendColor}`}>{trend.label}</p>}
        {!trend && sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />
}

// ─── Main page ────────────────────────────────────────────────────────────────

type DatePreset = '30' | '90' | '180' | 'custom'

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [studioId, setStudioId] = useState<string | null>(null)
  const [preset, setPreset] = useState<DatePreset>('90')
  const [fromDate, setFromDate] = useState(dateFromOffset(90))
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))

  // Data state
  const [weeklyData, setWeeklyData] = useState<WeeklyAttendance[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([])
  const [popularClasses, setPopularClasses] = useState<PopularClass[]>([])
  const [retention, setRetention] = useState<RetentionData | null>(null)

  // ── Step 1: resolve studio ID once ───────────────────────────────────────
  useEffect(() => {
    async function resolveStudio() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (membership?.studio_id) setStudioId(membership.studio_id)
      else setLoading(false)
    }
    resolveStudio()
  }, [])

  // ── Step 2: load report data when studioId or date range changes ──────────
  const loadReports = useCallback(async () => {
    if (!studioId) return
    setLoading(true)
    const supabase = createClient()
    const now = new Date()

    try {
      // ── Parallel fetch: class instances + payments + memberships ───────────
      const [
        { data: instances },
        { data: paymentRows },
        { data: allMemberships },
      ] = await Promise.all([
        supabase
          .from('class_instances')
          .select('id, date, max_capacity, template:class_templates!class_instances_template_id_fkey(name)')
          .eq('studio_id', studioId)
          .gte('date', fromDate)
          .lte('date', toDate)
          .not('status', 'eq', 'cancelled')
          .order('date'),

        supabase
          .from('payments')
          .select('type, amount_cents, created_at')
          .eq('studio_id', studioId)
          .eq('refunded', false)
          .gte('created_at', fromDate + 'T00:00:00')
          .lte('created_at', toDate + 'T23:59:59'),

        supabase
          .from('memberships')
          .select('user_id, status, joined_at, created_at, user:users!memberships_user_id_fkey(name)')
          .eq('studio_id', studioId),
      ])

      // ── Attendance: fetch checked-in records for all instances ─────────────
      const instanceIds = (instances ?? []).map((i) => i.id)
      let attendanceRows: { class_instance_id: string; user_id: string }[] = []
      if (instanceIds.length > 0) {
        // Supabase's .in() has a limit; for large sets chunk it
        const chunks: string[][] = []
        for (let i = 0; i < instanceIds.length; i += 200) {
          chunks.push(instanceIds.slice(i, i + 200))
        }
        const results = await Promise.all(
          chunks.map((chunk) =>
            supabase
              .from('attendance')
              .select('class_instance_id, user_id')
              .in('class_instance_id', chunk)
              .eq('checked_in', true)
          )
        )
        attendanceRows = results.flatMap((r) => r.data ?? [])
      }

      // ── Build attendance lookup: instanceId → checkin count ────────────────
      const checkinsByInstance = new Map<string, number>()
      for (const row of attendanceRows) {
        checkinsByInstance.set(
          row.class_instance_id,
          (checkinsByInstance.get(row.class_instance_id) ?? 0) + 1
        )
      }

      // ── Weekly attendance aggregation ──────────────────────────────────────
      const weekMap = new Map<string, { classes: number; checkins: number; capacity: number }>()
      for (const inst of instances ?? []) {
        const ws = isoWeekStart(inst.date)
        const cur = weekMap.get(ws) ?? { classes: 0, checkins: 0, capacity: 0 }
        cur.classes += 1
        cur.checkins += checkinsByInstance.get(inst.id) ?? 0
        cur.capacity += inst.max_capacity ?? 0
        weekMap.set(ws, cur)
      }
      const weekly: WeeklyAttendance[] = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, d]) => ({
          week,
          label: weekLabel(week),
          classes: d.classes,
          checkins: d.checkins,
          capacity: d.capacity,
          rate: d.capacity > 0 ? d.checkins / d.capacity : 0,
        }))
      setWeeklyData(weekly)

      // ── Monthly revenue aggregation ────────────────────────────────────────
      const revenueMap = new Map<
        string,
        { subscriptions: number; dropins: number; packs: number; privateSessions: number }
      >()
      for (const p of paymentRows ?? []) {
        const mk = monthKey(p.created_at)
        const cur = revenueMap.get(mk) ?? { subscriptions: 0, dropins: 0, packs: 0, privateSessions: 0 }
        const amt = p.amount_cents ?? 0
        if (p.type === 'subscription') cur.subscriptions += amt
        else if (p.type === 'drop_in') cur.dropins += amt
        else if (p.type === 'class_pack') cur.packs += amt
        else if (p.type === 'private_booking') cur.privateSessions += amt
        revenueMap.set(mk, cur)
      }
      const monthly: MonthlyRevenue[] = Array.from(revenueMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, d]) => ({
          month,
          label: monthLabel(month),
          total: d.subscriptions + d.dropins + d.packs + d.privateSessions,
          subscriptions: d.subscriptions,
          dropins: d.dropins,
          packs: d.packs,
          privateSessions: d.privateSessions,
        }))
      setMonthlyRevenue(monthly)

      // ── Popular classes ────────────────────────────────────────────────────
      const classMap = new Map<
        string,
        { totalInstances: number; totalCheckins: number; totalCapacity: number }
      >()
      for (const inst of instances ?? []) {
        const name = (inst.template as { name?: string } | null)?.name ?? 'Unknown'
        const cur = classMap.get(name) ?? { totalInstances: 0, totalCheckins: 0, totalCapacity: 0 }
        cur.totalInstances += 1
        cur.totalCheckins += checkinsByInstance.get(inst.id) ?? 0
        cur.totalCapacity += inst.max_capacity ?? 0
        classMap.set(name, cur)
      }
      const popular: PopularClass[] = Array.from(classMap.entries())
        .map(([name, d]) => ({
          name,
          totalInstances: d.totalInstances,
          totalCheckins: d.totalCheckins,
          totalCapacity: d.totalCapacity,
          avgCapacity: d.totalInstances > 0 ? Math.round(d.totalCapacity / d.totalInstances) : 0,
          avgAttendance:
            d.totalInstances > 0
              ? Math.round((d.totalCheckins / d.totalInstances) * 10) / 10
              : 0,
          fillRate: d.totalCapacity > 0 ? d.totalCheckins / d.totalCapacity : 0,
        }))
        .sort((a, b) => b.fillRate - a.fillRate)
        .slice(0, 10)
      setPopularClasses(popular)

      // ── Retention ──────────────────────────────────────────────────────────
      const activeMemberships = (allMemberships ?? []).filter((m) => m.status === 'active')
      const nowMonthKey = monthKey(now.toISOString())
      const newThisMonth = activeMemberships.filter(
        (m) => monthKey(m.created_at ?? m.joined_at ?? '') === nowMonthKey
      ).length

      // Cancelled in current month
      const cancelledThisMonth = (allMemberships ?? []).filter(
        (m) =>
          m.status === 'cancelled' &&
          monthKey(m.created_at ?? '') === nowMonthKey
      ).length

      // Monthly retention: (active - new) / (active - new + cancelled) * 100
      const existingStart = activeMemberships.length - newThisMonth
      const monthlyRetentionRate =
        existingStart + cancelledThisMonth > 0
          ? (existingStart / (existingStart + cancelledThisMonth)) * 100
          : 100

      // Avg classes per member per week (over the period)
      const periodWeeks = Math.max(
        1,
        (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (7 * 24 * 60 * 60 * 1000)
      )
      const totalCheckins = attendanceRows.length
      const avgClassesPerMemberPerWeek =
        activeMemberships.length > 0
          ? Math.round((totalCheckins / activeMemberships.length / periodWeeks) * 10) / 10
          : 0

      // At-risk: active members with no attendance in last 14 days
      const fourteenDaysAgo = new Date(now)
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10)

      // Get attendance in last 14 days
      const recentActiveUserIds = new Set<string>()
      if (instanceIds.length > 0) {
        const recentInstances = (instances ?? [])
          .filter((i) => i.date >= fourteenDaysAgoStr)
          .map((i) => i.id)
        if (recentInstances.length > 0) {
          const { data: recentAtt } = await supabase
            .from('attendance')
            .select('user_id')
            .in('class_instance_id', recentInstances)
            .eq('checked_in', true)
          for (const a of recentAtt ?? []) recentActiveUserIds.add(a.user_id)
        }
      }

      // Find active members who haven't attended in 14 days
      // We need their last attendance date — fetch from a broader window
      const atRiskCandidates = activeMemberships
        .filter((m) => !recentActiveUserIds.has(m.user_id))
        .slice(0, 20) // check top 20 candidates

      let atRisk: AtRiskMember[] = []
      if (atRiskCandidates.length > 0) {
        const { data: lastAttendance } = await supabase
          .from('attendance')
          .select('user_id, class_instance:class_instances!attendance_class_instance_id_fkey(date)')
          .in('class_instance_id', instanceIds.length > 0 ? instanceIds : ['00000000-0000-0000-0000-000000000000'])
          .in('user_id', atRiskCandidates.map((m) => m.user_id))
          .eq('checked_in', true)

        // Group by user: find max date
        const lastDateByUser = new Map<string, string>()
        for (const row of lastAttendance ?? []) {
          const inst = row.class_instance as { date?: string } | null
          const d = inst?.date
          if (!d) continue
          const prev = lastDateByUser.get(row.user_id)
          if (!prev || d > prev) lastDateByUser.set(row.user_id, d)
        }

        atRisk = atRiskCandidates
          .map((m) => {
            const u = m.user as { name?: string } | null
            const lastDate = lastDateByUser.get(m.user_id)
            const days = lastDate ? daysBetween(lastDate, now) : 999
            return { name: u?.name ?? 'Member', daysSinceLast: days }
          })
          .filter((m) => m.daysSinceLast >= 14)
          .sort((a, b) => b.daysSinceLast - a.daysSinceLast)
          .slice(0, 8)
      }

      setRetention({
        activeMembers: activeMemberships.length,
        newThisMonth,
        cancelledThisMonth,
        monthlyRetentionRate,
        avgClassesPerMemberPerWeek,
        atRisk,
      })
    } catch (err) {
      console.error('Reports load error:', err)
    } finally {
      setLoading(false)
    }
  }, [studioId, fromDate, toDate])

  useEffect(() => {
    if (studioId) loadReports()
  }, [studioId, loadReports])

  // ── Handle preset selection ────────────────────────────────────────────────
  function applyPreset(p: DatePreset) {
    setPreset(p)
    if (p !== 'custom') {
      const days = p === '30' ? 30 : p === '90' ? 90 : 180
      setFromDate(dateFromOffset(days))
      setToDate(new Date().toISOString().slice(0, 10))
    }
  }

  // ── Derived summary stats ──────────────────────────────────────────────────
  const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.total, 0)
  const latestMonthRevenue = monthlyRevenue.length > 0 ? monthlyRevenue[monthlyRevenue.length - 1] : null
  const prevMonthRevenue = monthlyRevenue.length > 1 ? monthlyRevenue[monthlyRevenue.length - 2] : null
  const revTrend =
    latestMonthRevenue && prevMonthRevenue && prevMonthRevenue.total > 0
      ? ((latestMonthRevenue.total - prevMonthRevenue.total) / prevMonthRevenue.total) * 100
      : null

  const avgAttendanceRate =
    weeklyData.length > 0
      ? weeklyData.reduce((s, w) => s + w.rate, 0) / weeklyData.length
      : null

  const maxWeeklyCheckins = Math.max(...weeklyData.map((w) => w.checkins), 1)
  const maxMonthlyRevenue = Math.max(...monthlyRevenue.map((m) => m.total), 1)

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!studioId && !loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">No studio found. Create a studio first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + date range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Track your studio&apos;s performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['30', '90', '180'] as DatePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {p}d
            </button>
          ))}
          <button
            onClick={() => applyPreset('custom')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              preset === 'custom'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Custom
          </button>
          {preset === 'custom' && (
            <div className="flex items-center gap-1 text-sm">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-9 w-24 mt-1" /><Skeleton className="h-3 w-36 mt-2" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Period Revenue"
              value={`$${formatCents(totalRevenue)}`}
              trend={
                revTrend !== null
                  ? {
                      dir: revTrend >= 0 ? 'up' : 'down',
                      label: `${revTrend >= 0 ? '↑' : '↓'} ${Math.abs(revTrend).toFixed(0)}% vs prior month`,
                    }
                  : undefined
              }
              sub="across selected period"
            />
            <StatCard
              title="Active Members"
              value={retention ? String(retention.activeMembers) : '—'}
              trend={
                retention
                  ? {
                      dir: retention.newThisMonth > 0 ? 'up' : 'neutral',
                      label: `+${retention.newThisMonth} new this month`,
                    }
                  : undefined
              }
            />
            <StatCard
              title="Avg Fill Rate"
              value={avgAttendanceRate !== null ? `${(avgAttendanceRate * 100).toFixed(0)}%` : '—'}
              sub="of class capacity filled"
            />
            <StatCard
              title="Retention Rate"
              value={retention ? `${retention.monthlyRetentionRate.toFixed(0)}%` : '—'}
              sub="members renewed this month"
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="popular">Popular Classes</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
        </TabsList>

        {/* ── Attendance tab ─────────────────────────────────────────────────── */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Weekly Attendance Trends</CardTitle>
                {!loading && weeklyData.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {weeklyData.reduce((s, w) => s + w.checkins, 0).toLocaleString()} total check-ins
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full" />
                  ))}
                </div>
              ) : weeklyData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No attendance data for this period.
                </p>
              ) : (
                <div className="space-y-2">
                  {weeklyData.map((w) => (
                    <div key={w.week} className="flex items-center gap-3">
                      <div className="w-14 text-xs text-muted-foreground shrink-0">{w.label}</div>
                      <div className="flex-1">
                        <BarChart value={w.checkins} max={maxWeeklyCheckins} height="h-5" />
                      </div>
                      <div className="w-36 text-xs text-right shrink-0">
                        <span className="font-semibold">{w.checkins}</span>
                        <span className="text-muted-foreground"> check-ins</span>
                        <span
                          className={`ml-2 font-medium ${
                            w.rate >= 0.8
                              ? 'text-green-600'
                              : w.rate >= 0.6
                              ? 'text-amber-600'
                              : 'text-red-500'
                          }`}
                        >
                          {(w.rate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance breakdown table */}
          {!loading && weeklyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Weekly Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 font-medium">Week</th>
                        <th className="text-right py-2 font-medium">Classes</th>
                        <th className="text-right py-2 font-medium">Check-ins</th>
                        <th className="text-right py-2 font-medium">Capacity</th>
                        <th className="text-right py-2 font-medium">Fill Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyData.map((w) => (
                        <tr key={w.week} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2">{w.label}</td>
                          <td className="text-right py-2">{w.classes}</td>
                          <td className="text-right py-2 font-medium">{w.checkins}</td>
                          <td className="text-right py-2 text-muted-foreground">{w.capacity}</td>
                          <td className="text-right py-2">
                            <span
                              className={`font-medium ${
                                w.rate >= 0.8
                                  ? 'text-green-600'
                                  : w.rate >= 0.6
                                  ? 'text-amber-600'
                                  : 'text-red-500'
                              }`}
                            >
                              {(w.rate * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Revenue tab ────────────────────────────────────────────────────── */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Monthly Revenue Breakdown</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-primary" /> Subscriptions
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Drop-ins
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" /> Class Packs
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-purple-500" /> Private
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : monthlyRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No payment data for this period.
                </p>
              ) : (
                <div className="space-y-4">
                  {monthlyRevenue.map((m) => (
                    <div key={m.month} className="space-y-1">
                      <div className="flex justify-between text-sm items-baseline">
                        <span className="font-medium">{m.label}</span>
                        <span className="font-bold">${formatCents(m.total)}</span>
                      </div>
                      <StackedBar
                        total={maxMonthlyRevenue}
                        height="h-5"
                        segments={[
                          { value: m.subscriptions, color: 'bg-primary', label: 'Subscriptions' },
                          { value: m.dropins, color: 'bg-green-500', label: 'Drop-ins' },
                          { value: m.packs, color: 'bg-amber-500', label: 'Class Packs' },
                          { value: m.privateSessions, color: 'bg-purple-500', label: 'Private' },
                        ]}
                      />
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {m.subscriptions > 0 && (
                          <span>Subscriptions ${formatCents(m.subscriptions)}</span>
                        )}
                        {m.dropins > 0 && <span>Drop-ins ${formatCents(m.dropins)}</span>}
                        {m.packs > 0 && <span>Packs ${formatCents(m.packs)}</span>}
                        {m.privateSessions > 0 && (
                          <span>Private ${formatCents(m.privateSessions)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue summary table */}
          {!loading && monthlyRevenue.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by Type</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const totals = monthlyRevenue.reduce(
                    (acc, m) => ({
                      subscriptions: acc.subscriptions + m.subscriptions,
                      dropins: acc.dropins + m.dropins,
                      packs: acc.packs + m.packs,
                      privateSessions: acc.privateSessions + m.privateSessions,
                    }),
                    { subscriptions: 0, dropins: 0, packs: 0, privateSessions: 0 }
                  )
                  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
                  const rows = [
                    { label: 'Subscriptions', value: totals.subscriptions, color: 'bg-primary' },
                    { label: 'Drop-ins', value: totals.dropins, color: 'bg-green-500' },
                    { label: 'Class Packs', value: totals.packs, color: 'bg-amber-500' },
                    { label: 'Private Sessions', value: totals.privateSessions, color: 'bg-purple-500' },
                  ].filter((r) => r.value > 0)
                  return (
                    <div className="space-y-2">
                      {rows.map((r) => (
                        <div key={r.label} className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-sm ${r.color} shrink-0`} />
                          <div className="flex-1 text-sm">{r.label}</div>
                          <div className="text-sm font-medium">${formatCents(r.value)}</div>
                          <div className="text-xs text-muted-foreground w-12 text-right">
                            {grandTotal > 0 ? ((r.value / grandTotal) * 100).toFixed(0) : 0}%
                          </div>
                          <div className="w-24">
                            <BarChart value={r.value} max={grandTotal} height="h-2" color={r.color} />
                          </div>
                        </div>
                      ))}
                      {rows.length === 0 && (
                        <p className="text-sm text-muted-foreground">No breakdown available.</p>
                      )}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Popular classes tab ────────────────────────────────────────────── */}
        <TabsContent value="popular" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Most Popular Classes</CardTitle>
                <span className="text-xs text-muted-foreground">by fill rate, {fromDate} – {toDate}</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="w-20 h-2 rounded" />
                    </div>
                  ))}
                </div>
              ) : popularClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No class data for this period.
                </p>
              ) : (
                <div className="space-y-3">
                  {popularClasses.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          i === 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : i === 1
                            ? 'bg-slate-100 text-slate-600'
                            : i === 2
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Avg {c.avgAttendance}/{c.avgCapacity} per class · {c.totalInstances} sessions
                        </div>
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              c.fillRate >= 0.8
                                ? 'text-green-600'
                                : c.fillRate >= 0.6
                                ? 'text-amber-600'
                                : 'text-red-500'
                            }`}
                          >
                            {(c.fillRate * 100).toFixed(0)}%
                          </span>
                        </div>
                        <BarChart
                          value={c.fillRate * 100}
                          max={100}
                          height="h-2"
                          color={
                            c.fillRate >= 0.8
                              ? 'bg-green-500'
                              : c.fillRate >= 0.6
                              ? 'bg-amber-500'
                              : 'bg-red-400'
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Retention tab ──────────────────────────────────────────────────── */}
        <TabsContent value="retention" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle>Member Retention</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="text-center space-y-1">
                      <Skeleton className="h-8 w-16 mx-auto" />
                      <Skeleton className="h-3 w-24 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : retention ? (
                <div className="space-y-6">
                  {/* Key metrics row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="space-y-1">
                      <div className="text-3xl font-bold text-green-600">
                        {retention.monthlyRetentionRate.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Monthly retention</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-3xl font-bold">{retention.activeMembers}</div>
                      <div className="text-xs text-muted-foreground">Active members</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-3xl font-bold text-green-600">+{retention.newThisMonth}</div>
                      <div className="text-xs text-muted-foreground">New this month</div>
                    </div>
                    <div className="space-y-1">
                      <div className={`text-3xl font-bold ${retention.cancelledThisMonth > 0 ? 'text-red-500' : ''}`}>
                        {retention.cancelledThisMonth > 0 ? `-${retention.cancelledThisMonth}` : '0'}
                      </div>
                      <div className="text-xs text-muted-foreground">Left this month</div>
                    </div>
                  </div>

                  {/* Engagement metric */}
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Avg classes per member per week</div>
                        <div className="text-xs text-muted-foreground mt-0.5">over the selected period</div>
                      </div>
                      <div className="text-2xl font-bold">{retention.avgClassesPerMemberPerWeek}</div>
                    </div>
                    <div className="mt-2">
                      <BarChart
                        value={retention.avgClassesPerMemberPerWeek}
                        max={7}
                        height="h-3"
                        color={
                          retention.avgClassesPerMemberPerWeek >= 3
                            ? 'bg-green-500'
                            : retention.avgClassesPerMemberPerWeek >= 1.5
                            ? 'bg-amber-500'
                            : 'bg-red-400'
                        }
                      />
                    </div>
                  </div>

                  {/* At-risk members */}
                  <div>
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      At-risk members
                      <span className="text-xs font-normal text-muted-foreground">
                        (0 classes in last 14 days)
                      </span>
                      {retention.atRisk.length > 0 && (
                        <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                          {retention.atRisk.length}
                        </span>
                      )}
                    </h4>
                    {retention.atRisk.length === 0 ? (
                      <div className="text-sm text-green-600 flex items-center gap-2 py-2">
                        <span>✓</span>
                        <span>All active members attended recently</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {retention.atRisk.map((m, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center py-2 px-3 rounded-lg border hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">
                                {m.name[0]}
                              </div>
                              <span className="text-sm font-medium">{m.name}</span>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${
                                m.daysSinceLast >= 30
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {m.daysSinceLast === 999
                                ? 'Never attended'
                                : `${m.daysSinceLast}d ago`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Could not load retention data.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
