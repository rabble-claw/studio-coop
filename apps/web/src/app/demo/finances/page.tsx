'use client'

import Link from 'next/link'
import {
  getDemoFinancialOverview,
  getDemoPnl,
  getDemoCashFlow,
  getDemoHealthCheck,
  getDemoInstructorComp,
  getDemoExpenses,
} from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function formatNZD(cents: number) {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split('-')
  const d = new Date(parseInt(year), parseInt(month) - 1)
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export default function DemoFinancesPage() {
  const overview = getDemoFinancialOverview()
  const { months: pnl } = getDemoPnl()
  const { months: cashFlow } = getDemoCashFlow()
  const health = getDemoHealthCheck()
  const instructors = getDemoInstructorComp()
  const expenses = getDemoExpenses()

  const maxPnlRevenue = Math.max(...pnl.map((r) => r.revenue_cents))
  const instructorTotal = instructors.reduce((sum, ic) => sum + ic.total_cents, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finances</h1>
        <p className="text-muted-foreground">Track expenses, revenue, and financial health</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNZD(overview.monthly_revenue_cents)}</div>
            <p className="text-xs text-muted-foreground mt-1">from revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatNZD(overview.monthly_expenses_cents)}</div>
            <p className="text-xs text-muted-foreground mt-1">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{formatNZD(overview.net_income_cents)}</div>
            <p className="text-xs text-muted-foreground mt-1">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{(overview.profit_margin * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">projected</p>
          </CardContent>
        </Card>
      </div>

      {/* Expense Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Expenses Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: exp.category.color }}
                  />
                  <div>
                    <div className="text-sm font-medium">{exp.description}</div>
                    <div className="text-xs text-muted-foreground">{exp.category.name}{exp.recurring ? ' (recurring)' : ''}</div>
                  </div>
                </div>
                <span className="text-sm font-medium">{formatNZD(exp.amount_cents)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-medium text-sm">
              <span>Total</span>
              <span>{formatNZD(expenses.reduce((s, e) => s + e.amount_cents, 0))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="instructors">Instructors</TabsTrigger>
        </TabsList>

        {/* P&L Tab */}
        <TabsContent value="pnl">
          <Card>
            <CardHeader><CardTitle>Profit &amp; Loss</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pnl.map((row) => (
                  <div key={row.month} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{formatMonth(row.month)}</span>
                      <span className={`font-bold ${row.net_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNZD(row.net_cents)}
                      </span>
                    </div>
                    <div className="flex h-5 rounded-full overflow-hidden bg-muted" aria-hidden="true">
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${(row.revenue_cents / maxPnlRevenue) * 100}%` }}
                        title={`Revenue: ${formatNZD(row.revenue_cents)}`}
                      />
                    </div>
                    <div className="flex h-5 rounded-full overflow-hidden bg-muted" aria-hidden="true">
                      <div
                        className="bg-red-400 h-full"
                        style={{ width: `${(row.expenses_cents / maxPnlRevenue) * 100}%` }}
                        title={`Expenses: ${formatNZD(row.expenses_cents)}`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Revenue {formatNZD(row.revenue_cents)}</span>
                      <span>Expenses {formatNZD(row.expenses_cents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cashflow">
          <Card>
            <CardHeader><CardTitle>Cash Flow Projection</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <span>Month</span>
                  <span className="text-right">Inflows</span>
                  <span className="text-right">Outflows</span>
                  <span className="text-right">Net</span>
                  <span className="text-right">Balance</span>
                </div>
                {cashFlow.map((row, i) => (
                  <div
                    key={row.month}
                    className={`grid grid-cols-5 gap-2 text-sm py-2 ${i % 2 === 0 ? 'bg-muted/50' : ''} px-1 rounded`}
                  >
                    <span className="font-medium">{formatMonth(row.month)}</span>
                    <span className="text-right text-green-600">{formatNZD(row.inflows_cents)}</span>
                    <span className="text-right text-red-600">{formatNZD(row.outflows_cents)}</span>
                    <span className={`text-right font-medium ${row.net_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatNZD(row.net_cents)}
                    </span>
                    <span className="text-right font-medium">{formatNZD(row.running_balance_cents)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health">
          <Card>
            <CardHeader><CardTitle>Financial Health Score</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full border-4 border-primary flex items-center justify-center">
                    <div>
                      <div className="text-2xl font-bold text-center">{health.score}</div>
                      <div className="text-xs text-muted-foreground text-center">{health.grade}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Overall Score: {health.score}/100</div>
                    <div className="text-sm text-muted-foreground">Grade: {health.grade}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {health.metrics.map((metric) => (
                    <div key={metric.name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <div className="font-medium text-sm">{metric.name}</div>
                        <div className="text-xs text-muted-foreground">{metric.detail}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{metric.value}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          metric.status === 'good' ? 'bg-green-500' :
                          metric.status === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructors Tab */}
        <TabsContent value="instructors">
          <Card>
            <CardHeader><CardTitle>Instructor Compensation</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                  <span>Instructor</span>
                  <span className="text-right">Rate/Class</span>
                  <span className="text-right">Classes</span>
                  <span className="text-right">Total</span>
                </div>
                {instructors.map((ic) => (
                  <div key={ic.id} className="grid grid-cols-4 gap-2 text-sm py-2">
                    <span className="font-medium">{ic.name}</span>
                    <span className="text-right">{formatNZD(ic.rate_cents)}</span>
                    <span className="text-right">{ic.classes_this_month}</span>
                    <span className="text-right">{formatNZD(ic.total_cents)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t font-medium text-sm">
                  <span>Total Instructor Cost</span>
                  <span>{formatNZD(instructorTotal)}</span>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {((instructorTotal / overview.monthly_revenue_cents) * 100).toFixed(1)}% of monthly revenue
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
