'use client'

import { getDemoHealthCheck } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DemoHealthTab() {
  const health = getDemoHealthCheck()

  return (
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
  )
}
