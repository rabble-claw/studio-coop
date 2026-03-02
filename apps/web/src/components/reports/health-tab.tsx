'use client'

import { useEffect, useState } from 'react'
import { useStudioId } from '@/hooks/use-studio-id'
import { financeApi } from '@/lib/api-client'
import type { HealthCheck } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function HealthTab() {
  const { studioId, loading: studioLoading } = useStudioId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthCheck | null>(null)

  useEffect(() => {
    if (studioLoading) return
    if (!studioId) { setLoading(false); return }

    const sid = studioId
    async function load() {
      try {
        const healthData = await financeApi.healthCheck(sid).catch(() => null)
        if (healthData) setHealth(healthData)
      } catch {
        setError('Failed to load health data.')
      }
      setLoading(false)
    }
    load()
  }, [studioId, studioLoading])

  if (loading) return <div className="py-12 text-center text-muted-foreground" aria-busy="true" role="status">Loading health data...</div>

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

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
    </div>
  )
}
