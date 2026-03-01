'use client'

import { useState, useRef, useCallback } from 'react'
import { financeApi } from '@/lib/api-client'
import { useStudioId } from '@/hooks/use-studio-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

interface ScenarioParams {
  priceChangePercent: number
  newClassesPerWeek: number
  newMembers: number
  lostMembers: number
  rentChangeCents: number
}

interface ScenarioSide {
  members: number
  revenue: number
  expenses: number
  instructorCosts: number
  netIncome: number
}

interface ScenarioResult {
  current: ScenarioSide
  projected: ScenarioSide
  changes: {
    membersDelta: number
    revenueDelta: number
    expensesDelta: number
    instructorCostsDelta: number
    netIncomeDelta: number
  }
}

const DEFAULT_PARAMS: ScenarioParams = {
  priceChangePercent: 0,
  newClassesPerWeek: 0,
  newMembers: 0,
  lostMembers: 0,
  rentChangeCents: 0,
}

export default function ScenarioPage() {
  const { studioId, loading: studioLoading } = useStudioId()
  const [params, setParams] = useState<ScenarioParams>(DEFAULT_PARAMS)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runScenario = useCallback(async (p: ScenarioParams) => {
    if (!studioId) return
    setLoading(true)
    setError(null)
    try {
      // Build API payload - map rent change into newExpenses if non-zero
      const payload: Record<string, unknown> = {
        priceChangePercent: p.priceChangePercent,
        newClassesPerWeek: p.newClassesPerWeek,
        newMembers: p.newMembers,
        lostMembers: p.lostMembers,
      }
      if (p.rentChangeCents !== 0) {
        payload.newExpenses = [{ amountCents: p.rentChangeCents, name: 'Rent adjustment', recurrence: 'monthly' }]
      }
      const res = await financeApi.scenario(studioId, payload) as unknown as ScenarioResult
      setResult(res)
    } catch {
      setError('Failed to run scenario. Please try again.')
    }
    setLoading(false)
  }, [studioId])

  function updateParam<K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) {
    const next = { ...params, [key]: value }
    setParams(next)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => runScenario(next), 500)
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  function changeIndicator(delta: number) {
    if (delta > 0) return { label: `+${formatCurrency(delta)}`, color: 'text-green-600' }
    if (delta < 0) return { label: formatCurrency(delta), color: 'text-red-600' }
    return { label: '--', color: 'text-muted-foreground' }
  }

  if (studioLoading) {
    return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenario Planner</h1>
          <p className="text-muted-foreground">Model &quot;what if&quot; changes to see projected financial impact</p>
        </div>
        <Link href="/dashboard/finances" className="text-sm text-muted-foreground hover:text-foreground">
          Back to finances
        </Link>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel: Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Scenario Parameters</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Price change */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <label htmlFor="price-change">Price change</label>
                  <span className="font-medium">{params.priceChangePercent > 0 ? '+' : ''}{params.priceChangePercent}%</span>
                </div>
                <input
                  id="price-change"
                  type="range"
                  min={-30}
                  max={50}
                  value={params.priceChangePercent}
                  onChange={(e) => updateParam('priceChangePercent', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>-30%</span><span>0%</span><span>+50%</span>
                </div>
              </div>

              {/* Additional classes per week */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <label htmlFor="additional-classes">Additional classes/week</label>
                  <span className="font-medium">{params.newClassesPerWeek > 0 ? '+' : ''}{params.newClassesPerWeek}</span>
                </div>
                <input
                  id="additional-classes"
                  type="range"
                  min={-10}
                  max={10}
                  value={params.newClassesPerWeek}
                  onChange={(e) => updateParam('newClassesPerWeek', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>-10</span><span>0</span><span>+10</span>
                </div>
              </div>

              {/* New members */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <label htmlFor="new-members">New members</label>
                  <span className="font-medium">{params.newMembers}</span>
                </div>
                <input
                  id="new-members"
                  type="range"
                  min={0}
                  max={20}
                  value={params.newMembers}
                  onChange={(e) => updateParam('newMembers', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span><span>10</span><span>20</span>
                </div>
              </div>

              {/* Expected churn (lost members) */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <label htmlFor="churn">Expected lost members</label>
                  <span className="font-medium">{params.lostMembers}</span>
                </div>
                <input
                  id="churn"
                  type="range"
                  min={0}
                  max={20}
                  value={params.lostMembers}
                  onChange={(e) => updateParam('lostMembers', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span><span>10</span><span>20</span>
                </div>
              </div>

              {/* Rent change */}
              <div>
                <label htmlFor="rent-change" className="text-sm block mb-1">Rent change (NZD/month)</label>
                <Input
                  id="rent-change"
                  type="number"
                  step={1}
                  value={params.rentChangeCents / 100}
                  onChange={(e) => updateParam('rentChangeCents', Math.round(Number(e.target.value) * 100))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">Positive = increase, negative = decrease</p>
              </div>

              <Button
                className="w-full"
                onClick={() => runScenario(params)}
                disabled={loading || !studioId}
              >
                {loading ? 'Calculating...' : 'Run Scenario'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right panel: Results */}
        <div className="space-y-4">
          {!result && !loading && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Adjust parameters and run a scenario</p>
                <p className="text-sm">Changes will auto-calculate after adjusting sliders</p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground" aria-busy="true" role="status">
                Calculating projections...
              </CardContent>
            </Card>
          )}

          {result && !loading && (
            <>
              {/* Members */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Members</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.current.members}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Projected Members</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.projected.members}</div>
                    <p className={`text-xs ${result.changes.membersDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {result.changes.membersDelta >= 0 ? '+' : ''}{result.changes.membersDelta}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Revenue</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(result.current.revenue)}</div>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Projected Revenue</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${changeIndicator(result.changes.revenueDelta).color}`}>
                      {formatCurrency(result.projected.revenue)}
                    </div>
                    <p className={`text-xs ${changeIndicator(result.changes.revenueDelta).color}`}>
                      {changeIndicator(result.changes.revenueDelta).label}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Expenses */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Expenses</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(result.current.expenses + result.current.instructorCosts)}</div>
                    <p className="text-xs text-muted-foreground">/month (incl. instructors)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Projected Expenses</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${changeIndicator(-(result.changes.expensesDelta + result.changes.instructorCostsDelta)).color}`}>
                      {formatCurrency(result.projected.expenses + result.projected.instructorCosts)}
                    </div>
                    <p className={`text-xs ${changeIndicator(-(result.changes.expensesDelta + result.changes.instructorCostsDelta)).color}`}>
                      {changeIndicator(result.changes.expensesDelta + result.changes.instructorCostsDelta).label}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Net Income */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Net Income</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${result.current.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(result.current.netIncome)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Projected Net Income</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${result.projected.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(result.projected.netIncome)}
                    </div>
                    <p className={`text-xs ${changeIndicator(result.changes.netIncomeDelta).color}`}>
                      {changeIndicator(result.changes.netIncomeDelta).label}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
