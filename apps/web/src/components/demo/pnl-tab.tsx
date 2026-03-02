'use client'

import { getDemoPnl, getDemoCashFlow } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatNZD(cents: number) {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100)
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split('-')
  const d = new Date(parseInt(year), parseInt(month) - 1)
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export function DemoPnlTab() {
  const { months: pnl } = getDemoPnl()
  const { months: cashFlow } = getDemoCashFlow()
  const maxPnlRevenue = Math.max(...pnl.map((r) => r.revenue_cents))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Profit &amp; Loss</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pnl.map((row) => (
              <div key={row.month} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{formatMonth(row.month)}</span>
                  <span className={`font-bold ${row.net_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNZD(row.net_cents)}</span>
                </div>
                <div className="flex h-5 rounded-full overflow-hidden bg-muted" aria-hidden="true">
                  <div className="bg-green-500 h-full" style={{ width: `${(row.revenue_cents / maxPnlRevenue) * 100}%` }} title={`Revenue: ${formatNZD(row.revenue_cents)}`} />
                </div>
                <div className="flex h-5 rounded-full overflow-hidden bg-muted" aria-hidden="true">
                  <div className="bg-red-400 h-full" style={{ width: `${(row.expenses_cents / maxPnlRevenue) * 100}%` }} title={`Expenses: ${formatNZD(row.expenses_cents)}`} />
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
              <div key={row.month} className={`grid grid-cols-5 gap-2 text-sm py-2 ${i % 2 === 0 ? 'bg-muted/50' : ''} px-1 rounded`}>
                <span className="font-medium">{formatMonth(row.month)}</span>
                <span className="text-right text-green-600">{formatNZD(row.inflows_cents)}</span>
                <span className="text-right text-red-600">{formatNZD(row.outflows_cents)}</span>
                <span className={`text-right font-medium ${row.net_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNZD(row.net_cents)}</span>
                <span className="text-right font-medium">{formatNZD(row.running_balance_cents)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
