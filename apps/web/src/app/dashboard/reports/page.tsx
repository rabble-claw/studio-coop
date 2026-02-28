'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { reportApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AttendanceWeek {
  week: string
  classes: number
  checkins: number
  rate: number
}

interface RevenueMonth {
  month: string
  revenue: number
  memberships: number
  dropins: number
  packs: number
}

interface PopularClass {
  name: string
  avgAttendance: number
  capacity: number
  fillRate: number
}

interface AtRiskMember {
  name: string
  email: string
  lastClass: string | null
}

export default function ReportsPage() {
  const router = useRouter()
  const [studioId, setStudioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Overview
  const [overview, setOverview] = useState({ activeMembers: 0, totalRevenue: 0, avgAttendanceRate: 0, retentionRate: 0 })

  // Tab data
  const [attendance, setAttendance] = useState<AttendanceWeek[]>([])
  const [revenue, setRevenue] = useState<RevenueMonth[]>([])
  const [popular, setPopular] = useState<PopularClass[]>([])
  const [atRisk, setAtRisk] = useState<AtRiskMember[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) { setLoading(false); return }
      setStudioId(membership.studio_id)

      try {
        const [overviewData, attendanceData, revenueData, popularData, atRiskData] = await Promise.all([
          reportApi.overview(membership.studio_id),
          reportApi.attendance(membership.studio_id),
          reportApi.revenue(membership.studio_id),
          reportApi.popular(membership.studio_id),
          reportApi.atRisk(membership.studio_id),
        ])

        setOverview(overviewData)
        setAttendance(attendanceData.attendance)
        setRevenue(revenueData.revenue)
        setPopular(popularData.classes)
        setAtRisk(atRiskData.members)
      } catch {
        setError('Failed to load reports. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [])

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100)
  }

  function formatWeek(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  function formatMonth(monthStr: string) {
    const [year, month] = monthStr.split('-')
    const d = new Date(parseInt(year), parseInt(month) - 1)
    return d.toLocaleDateString(undefined, { month: 'short' })
  }

  function daysAgo(dateStr: string | null) {
    if (!dateStr) return 'Never attended'
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    return `Last class: ${days} days ago`
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading reports...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Track your studio&apos;s performance</p>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(overview.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.activeMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">current active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Attendance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(overview.avgAttendanceRate * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Retention Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(overview.retentionRate * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">members retained</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="attendance" className="min-h-[44px] touch-manipulation">Attendance</TabsTrigger>
          <TabsTrigger value="revenue" className="min-h-[44px] touch-manipulation">Revenue</TabsTrigger>
          <TabsTrigger value="popular" className="min-h-[44px] touch-manipulation">Popular</TabsTrigger>
          <TabsTrigger value="retention" className="min-h-[44px] touch-manipulation">Retention</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Weekly Attendance</CardTitle></CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No attendance data yet.</p>
              ) : (
                <div className="space-y-3">
                  {attendance.map(w => (
                    <div key={w.week} className="flex items-center gap-2 sm:gap-4">
                      <div className="w-14 sm:w-16 text-xs sm:text-sm text-muted-foreground shrink-0">{formatWeek(w.week)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="h-6 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(w.rate * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${formatWeek(w.week)}: ${w.checkins} check-ins, ${(w.rate * 100).toFixed(0)}% attendance`}>
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${w.rate * 100}%` }} />
                        </div>
                      </div>
                      <div className="w-20 sm:w-32 text-xs sm:text-sm text-right shrink-0">
                        <span className="font-medium">{w.checkins}</span>
                        <span className="text-muted-foreground hidden sm:inline"> check-ins</span>
                        <span className="text-muted-foreground"> ({(w.rate * 100).toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Monthly Revenue Breakdown</CardTitle></CardHeader>
            <CardContent>
              {revenue.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No revenue data yet.</p>
              ) : (
                <div className="space-y-4">
                  {revenue.map(m => (
                    <div key={m.month} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{formatMonth(m.month)}</span>
                        <span className="font-bold">{formatCurrency(m.revenue)}</span>
                      </div>
                      <div className="flex h-4 rounded-full overflow-hidden bg-muted" aria-hidden="true">
                        {m.revenue > 0 && (
                          <>
                            <div className="bg-primary h-full" style={{ width: `${(m.memberships / m.revenue) * 100}%` }} title="Memberships" />
                            <div className="bg-primary/60 h-full" style={{ width: `${(m.dropins / m.revenue) * 100}%` }} title="Drop-ins" />
                            <div className="bg-primary/30 h-full" style={{ width: `${(m.packs / m.revenue) * 100}%` }} title="Class packs" />
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Memberships {formatCurrency(m.memberships)}</span>
                        <span>Drop-ins {formatCurrency(m.dropins)}</span>
                        <span>Packs {formatCurrency(m.packs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="popular" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Most Popular Classes</CardTitle></CardHeader>
            <CardContent>
              {popular.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No class data yet.</p>
              ) : (
                <div className="space-y-3">
                  {popular.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Avg {c.avgAttendance}/{c.capacity} · {(c.fillRate * 100).toFixed(0)}% fill rate
                        </div>
                      </div>
                      <div className="w-24" aria-hidden="true">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${c.fillRate * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Member Retention</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{(overview.retentionRate * 100).toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">Monthly retention</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{overview.activeMembers}</div>
                    <div className="text-xs text-muted-foreground">Active members</div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">At-risk members (no activity in 14+ days)</h4>
                  {atRisk.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No at-risk members right now!</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {atRisk.map((m, i) => (
                        <div key={i} className="flex justify-between py-1 border-b last:border-0">
                          <span>{m.name}</span>
                          <span className="text-muted-foreground">{daysAgo(m.lastClass)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
