'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { financeApi } from '@/lib/api-client'
import type { FinancialOverview, PnlRow, CashFlowRow, HealthCheck } from '@/lib/api-client'
import { useStudioId } from '@/hooks/use-studio-id'
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

interface InstructorCostRow {
  user_id: string
  name: string
  classes: number
  total_cents: number
}

export default function FinancesPage() {
  const router = useRouter()
  const { studioId, loading: studioLoading } = useStudioId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasExpenses, setHasExpenses] = useState(false)

  const [overview, setOverview] = useState<FinancialOverview>({
    monthly_revenue_cents: 0,
    monthly_expenses_cents: 0,
    net_income_cents: 0,
    profit_margin: 0,
  })
  const [pnl, setPnl] = useState<PnlRow[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowRow[]>([])
  const [health, setHealth] = useState<HealthCheck | null>(null)
  const [instructorCosts, setInstructorCosts] = useState<InstructorCostRow[]>([])
  const [instructorTotal, setInstructorTotal] = useState(0)

  useEffect(() => {
    if (studioLoading) return
    if (!studioId) { setLoading(false); return }

    const sid = studioId

    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      try {
        const [overviewData, pnlData, cashFlowData, healthData, instructorData, expensesData] = await Promise.all([
          financeApi.overview(sid).catch(() => null),
          financeApi.pnl(sid).catch(() => null),
          financeApi.cashFlow(sid).catch(() => null),
          financeApi.healthCheck(sid).catch(() => null),
          financeApi.instructorCost(sid).catch(() => null),
          financeApi.listExpenses(sid, 'limit=1').catch(() => null),
        ])

        if (overviewData) setOverview(overviewData)
        if (pnlData) setPnl(pnlData.months)
        if (cashFlowData) setCashFlow(cashFlowData.months)
        if (healthData) setHealth(healthData)
        if (instructorData) {
          setInstructorCosts(instructorData.by_instructor)
          setInstructorTotal(instructorData.total_cents)
        }
        if (expensesData && expensesData.expenses.length > 0) setHasExpenses(true)
      } catch {
        setError('Failed to load financial data. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [studioId, studioLoading, router])

  if (loading) {
    return (
      <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">
        Loading financial data...
      </div>
    )
  }

  const maxPnlRevenue = pnl.length > 0 ? Math.max(...pnl.map((r) => r.revenue_cents)) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finances</h1>
        <p className="text-muted-foreground">Track expenses, revenue, and financial health</p>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

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
            <div className={`text-3xl font-bold ${overview.net_income_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNZD(overview.net_income_cents)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${overview.profit_margin >= 0.2 ? 'text-green-600' : overview.profit_margin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {(overview.profit_margin * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">projected</p>
          </CardContent>
        </Card>
      </div>

      {/* Setup CTA */}
      {!hasExpenses && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-6 text-center space-y-3">
            <div className="text-4xl">💰</div>
            <h3 className="font-semibold text-lg">No expenses tracked yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Set up your finances to track expenses, instructor costs, and see your studio&apos;s financial health.
            </p>
            <Link
              href="/dashboard/finances/setup"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Set Up Finances
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pnl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="pnl" className="min-h-[44px] touch-manipulation">P&amp;L</TabsTrigger>
          <TabsTrigger value="cashflow" className="min-h-[44px] touch-manipulation">Cash Flow</TabsTrigger>
          <TabsTrigger value="health" className="min-h-[44px] touch-manipulation">Health</TabsTrigger>
          <TabsTrigger value="instructors" className="min-h-[44px] touch-manipulation">Instructors</TabsTrigger>
        </TabsList>

        {/* P&L Tab */}
        <TabsContent value="pnl" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Profit &amp; Loss</CardTitle></CardHeader>
            <CardContent>
              {pnl.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No P&amp;L data yet. Add expenses to see your profit and loss.</p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cashflow" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Cash Flow Projection</CardTitle></CardHeader>
            <CardContent>
              {cashFlow.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No cash flow data yet.</p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Financial Health Score</CardTitle></CardHeader>
            <CardContent>
              {!health ? (
                <p className="text-center text-muted-foreground py-8">Not enough data for a health check.</p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructors Tab */}
        <TabsContent value="instructors" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Instructor Compensation</CardTitle></CardHeader>
            <CardContent>
              {instructorCosts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No instructor compensation data.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                    <span>Instructor</span>
                    <span className="text-right">Classes</span>
                    <span className="text-right">Total</span>
                    <span className="text-right">% of Revenue</span>
                  </div>
                  {instructorCosts.map((ic) => (
                    <div key={ic.user_id} className="grid grid-cols-4 gap-2 text-sm py-2">
                      <span className="font-medium">{ic.name}</span>
                      <span className="text-right">{ic.classes}</span>
                      <span className="text-right">{formatNZD(ic.total_cents)}</span>
                      <span className="text-right text-muted-foreground">
                        {overview.monthly_revenue_cents > 0
                          ? ((ic.total_cents / overview.monthly_revenue_cents) * 100).toFixed(1)
                          : '0'}%
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 border-t font-medium text-sm">
                    <span>Total Instructor Cost</span>
                    <span>{formatNZD(instructorTotal)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
