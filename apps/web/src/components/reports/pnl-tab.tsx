'use client'

import { useEffect, useState } from 'react'
import { useStudioId } from '@/hooks/use-studio-id'
import { financeApi } from '@/lib/api-client'
import type { PnlRow, CashFlowRow, FinancialOverview } from '@/lib/api-client'
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

export function PnlTab() {
  const { studioId, loading: studioLoading } = useStudioId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [overview, setOverview] = useState<FinancialOverview>({
    monthly_revenue_cents: 0,
    monthly_expenses_cents: 0,
    net_income_cents: 0,
    profit_margin: 0,
  })
  const [pnl, setPnl] = useState<PnlRow[]>([])
  const [cashFlow, setCashFlow] = useState<CashFlowRow[]>([])

  useEffect(() => {
    if (studioLoading) return
    if (!studioId) { setLoading(false); return }

    const sid = studioId

    async function load() {
      try {
        const [overviewData, pnlData, cashFlowData] = await Promise.all([
          financeApi.overview(sid).catch(() => null),
          financeApi.pnl(sid).catch(() => null),
          financeApi.cashFlow(sid).catch(() => null),
        ])

        if (overviewData) setOverview(overviewData)
        if (pnlData) setPnl(pnlData.months)
        if (cashFlowData) setCashFlow(cashFlowData.months)
      } catch {
        setError('Failed to load financial data.')
      }
      setLoading(false)
    }
    load()
  }, [studioId, studioLoading])

  if (loading) return <div className="py-12 text-center text-muted-foreground" aria-busy="true" role="status">Loading P&amp;L data...</div>

  const maxPnlRevenue = pnl.length > 0 ? Math.max(...pnl.map((r) => r.revenue_cents)) : 1

  return (
    <div className="space-y-6">
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{formatNZD(overview.monthly_expenses_cents)}</div>
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
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl" className="min-h-[44px] touch-manipulation">P&amp;L</TabsTrigger>
          <TabsTrigger value="cashflow" className="min-h-[44px] touch-manipulation">Cash Flow</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  )
}
