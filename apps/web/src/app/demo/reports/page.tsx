'use client'

import { demoReportsData } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function DemoReportsPage() {
  const { summary, weeklyAttendance, monthlyRevenue, popularClasses, retention } = demoReportsData

  const maxCheckins = Math.max(...weeklyAttendance.map((w) => w.checkins))
  const maxRetention = Math.max(...retention.monthly.map((m) => m.rate))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Studio analytics and insights</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">NZD</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgAttendance}</div>
            <p className="text-xs text-muted-foreground">per class</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retention Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.retentionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="classes">Popular Classes</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {weeklyAttendance.map((week) => (
                  <div key={week.week} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-16 shrink-0">{week.week}</span>
                    <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(week.checkins / maxCheckins) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{week.checkins}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-5 gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <span>Month</span>
                  <span className="text-right">Memberships</span>
                  <span className="text-right">Drop-ins</span>
                  <span className="text-right">Packs</span>
                  <span className="text-right">Total</span>
                </div>
                {monthlyRevenue.map((row, i) => {
                  const total = row.memberships + row.dropIns + row.packs
                  return (
                    <div
                      key={row.month}
                      className={`grid grid-cols-5 gap-2 text-sm py-2 ${i % 2 === 0 ? 'bg-muted/50' : ''} px-1 rounded`}
                    >
                      <span className="font-medium">{row.month}</span>
                      <span className="text-right">${row.memberships.toLocaleString()}</span>
                      <span className="text-right">${row.dropIns.toLocaleString()}</span>
                      <span className="text-right">${row.packs.toLocaleString()}</span>
                      <span className="text-right font-medium">${total.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Popular Classes Tab */}
        <TabsContent value="classes">
          <Card>
            <CardHeader>
              <CardTitle>Top Classes by Fill Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {popularClasses.map((cls) => (
                  <div key={cls.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{cls.name}</span>
                      <span className="text-muted-foreground">Avg: {cls.avgAttendance} students</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${cls.fillRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{cls.fillRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Member Retention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {retention.monthly.map((month) => (
                    <div key={month.month} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-10 shrink-0">{month.month}</span>
                      <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(month.rate / maxRetention) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{month.rate}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Avg classes per member</div>
                <div className="text-2xl font-bold">{retention.avgClassesPerMember}</div>
              </CardContent>
            </Card>

            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-amber-700">At-Risk Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {retention.atRiskMembers.map((member) => (
                    <div key={member.name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-amber-600">Last class: {member.lastClass}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">{member.totalClasses} classes total</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
