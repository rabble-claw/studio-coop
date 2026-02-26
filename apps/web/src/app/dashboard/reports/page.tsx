'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Demo data — will be replaced with API calls
const ATTENDANCE_DATA = [
  { week: 'Feb 3', classes: 28, checkins: 186, rate: 0.89 },
  { week: 'Feb 10', classes: 28, checkins: 201, rate: 0.91 },
  { week: 'Feb 17', classes: 28, checkins: 178, rate: 0.85 },
  { week: 'Feb 24', classes: 26, checkins: 192, rate: 0.88 },
]

const POPULAR_CLASSES = [
  { name: 'Pole Level 2', avgAttendance: 11.2, capacity: 12, fillRate: 0.93 },
  { name: 'Aerial Silks Beginner', avgAttendance: 10.8, capacity: 12, fillRate: 0.90 },
  { name: 'Movement & Cirque', avgAttendance: 9.5, capacity: 12, fillRate: 0.79 },
  { name: 'Flexibility', avgAttendance: 8.2, capacity: 15, fillRate: 0.55 },
  { name: 'Pole Level 1', avgAttendance: 7.8, capacity: 12, fillRate: 0.65 },
]

const REVENUE_DATA = [
  { month: 'Nov', revenue: 12400, memberships: 9200, dropins: 2100, packs: 1100 },
  { month: 'Dec', revenue: 10800, memberships: 9200, dropins: 800, packs: 800 },
  { month: 'Jan', revenue: 14200, memberships: 10400, dropins: 2400, packs: 1400 },
  { month: 'Feb', revenue: 13800, memberships: 10400, dropins: 2000, packs: 1400 },
]

export default function ReportsPage() {
  const [period] = useState('month')

  const totalRevenue = REVENUE_DATA[REVENUE_DATA.length - 1].revenue
  const totalMembers = 47
  const avgAttendance = ATTENDANCE_DATA.reduce((s, w) => s + w.rate, 0) / ATTENDANCE_DATA.length
  const retentionRate = 0.92

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground">Track your studio&apos;s performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(totalRevenue / 100).toLocaleString()}</div>
            <p className="text-xs text-green-600 mt-1">↑ 12% vs last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalMembers}</div>
            <p className="text-xs text-green-600 mt-1">↑ 3 new this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg Attendance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(avgAttendance * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">of booked members attend</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Retention Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(retentionRate * 100).toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">members renewed this month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="popular">Popular Classes</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Weekly Attendance</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ATTENDANCE_DATA.map(w => (
                  <div key={w.week} className="flex items-center gap-4">
                    <div className="w-16 text-sm text-muted-foreground">{w.week}</div>
                    <div className="flex-1">
                      <div className="h-6 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${w.rate * 100}%` }} />
                      </div>
                    </div>
                    <div className="w-32 text-sm text-right">
                      <span className="font-medium">{w.checkins}</span>
                      <span className="text-muted-foreground"> check-ins ({(w.rate * 100).toFixed(0)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Monthly Revenue Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {REVENUE_DATA.map(m => (
                  <div key={m.month} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{m.month}</span>
                      <span className="font-bold">${(m.revenue / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                      <div className="bg-primary h-full" style={{ width: `${(m.memberships / m.revenue) * 100}%` }} title="Memberships" />
                      <div className="bg-primary/60 h-full" style={{ width: `${(m.dropins / m.revenue) * 100}%` }} title="Drop-ins" />
                      <div className="bg-primary/30 h-full" style={{ width: `${(m.packs / m.revenue) * 100}%` }} title="Class packs" />
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>● Memberships ${(m.memberships / 100).toLocaleString()}</span>
                      <span>● Drop-ins ${(m.dropins / 100).toLocaleString()}</span>
                      <span>● Packs ${(m.packs / 100).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="popular" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Most Popular Classes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {POPULAR_CLASSES.map((c, i) => (
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
                    <div className="w-24">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${c.fillRate * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Member Retention</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">92%</div>
                    <div className="text-xs text-muted-foreground">Monthly retention</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">4.2</div>
                    <div className="text-xs text-muted-foreground">Avg classes/member/week</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">8.3</div>
                    <div className="text-xs text-muted-foreground">Avg months as member</div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">At-risk members (0-1 classes in last 2 weeks)</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <span>Sarah K.</span><span className="text-muted-foreground">Last class: 12 days ago</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span>Mike R.</span><span className="text-muted-foreground">Last class: 16 days ago</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Jade W.</span><span className="text-muted-foreground">Last class: 18 days ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
