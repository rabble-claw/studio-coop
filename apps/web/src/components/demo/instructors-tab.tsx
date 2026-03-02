'use client'

import { getDemoFinancialOverview, getDemoInstructorComp } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatNZD(cents: number) {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100)
}

export function DemoInstructorsTab() {
  const overview = getDemoFinancialOverview()
  const instructors = getDemoInstructorComp()
  const instructorTotal = instructors.reduce((sum, ic) => sum + ic.total_cents, 0)

  return (
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
  )
}
