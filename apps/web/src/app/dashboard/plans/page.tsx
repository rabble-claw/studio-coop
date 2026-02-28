'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { planApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Plan {
  id: string
  name: string
  type: 'unlimited' | 'limited' | 'class_pack' | 'drop_in' | 'intro'
  price_cents: number
  currency: string
  interval: 'month' | 'year' | 'once'
  class_limit: number | null
  validity_days: number | null
  active: boolean
  subscriber_count?: number
}

const PLAN_TYPES = [
  { value: 'unlimited', label: 'Unlimited Monthly' },
  { value: 'limited', label: 'Limited Monthly' },
  { value: 'class_pack', label: 'Class Pack' },
  { value: 'drop_in', label: 'Drop-in' },
  { value: 'intro', label: 'Intro Offer' },
]

export default function PlansPage() {
  const router = useRouter()
  const [studioId, setStudioId] = useState<string | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [studioCurrency, setStudioCurrency] = useState('USD')
  const [newPlan, setNewPlan] = useState({
    name: '', type: 'unlimited', price: '', interval: 'month',
    class_limit: '', validity_days: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) { setLoading(false); return }
      setStudioId(membership.studio_id)

      // Fetch studio currency from settings or existing plans
      const { data: studioData } = await supabase
        .from('studios')
        .select('settings')
        .eq('id', membership.studio_id)
        .single()
      const currency = (studioData?.settings as Record<string, unknown>)?.currency as string | undefined
      if (currency) setStudioCurrency(currency)

      try {
        const result = await planApi.list(membership.studio_id) as { plans: Plan[] }
        setPlans(result.plans ?? [])
      } catch {
        setError('Failed to load plans. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [])

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
  }

  async function handleCreate() {
    if (!studioId) return
    try {
      const result = await planApi.create(studioId, {
        name: newPlan.name,
        type: newPlan.type,
        price_cents: Math.round(parseFloat(newPlan.price || '0') * 100),
        currency: studioCurrency,
        interval: newPlan.interval,
        class_limit: newPlan.class_limit ? parseInt(newPlan.class_limit) : null,
        validity_days: newPlan.validity_days ? parseInt(newPlan.validity_days) : null,
      }) as { plan: Plan }
      setPlans([...plans, result.plan])
      setShowCreate(false)
      setNewPlan({ name: '', type: 'unlimited', price: '', interval: 'month', class_limit: '', validity_days: '' })
    } catch (e) {
      alert(`Failed to create plan: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  async function handleEdit(planId: string) {
    if (!studioId) return
    const plan = plans.find(p => p.id === planId)
    if (!plan) return

    if (editingPlan === planId) {
      // Save
      try {
        const result = await planApi.update(studioId, planId, plan) as { plan: Plan }
        setPlans(plans.map(p => p.id === planId ? result.plan : p))
        setEditingPlan(null)
      } catch (e) {
        alert(`Failed to update: ${e instanceof Error ? e.message : 'Unknown error'}`)
      }
    } else {
      setEditingPlan(planId)
    }
  }

  async function handleDeactivate(planId: string) {
    if (!studioId) return
    if (!confirm('Are you sure you want to deactivate this plan?')) return
    try {
      await planApi.delete(studioId, planId)
      setPlans(plans.map(p => p.id === planId ? { ...p, active: false } : p))
    } catch (e) {
      alert(`Failed to deactivate: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  function updatePlanField(planId: string, field: keyof Plan, value: unknown) {
    setPlans(plans.map(p => p.id === planId ? { ...p, [field]: value } : p))
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading plans...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Membership Plans</h1>
          <p className="text-muted-foreground">Manage pricing and membership options</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Plan'}
        </Button>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Create New Plan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="plan-name" className="text-sm font-medium">Plan Name</label>
                <Input id="plan-name" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} placeholder="e.g. Unlimited Monthly" />
              </div>
              <div>
                <label htmlFor="plan-type" className="text-sm font-medium">Type</label>
                <select id="plan-type" className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]" value={newPlan.type}
                  onChange={e => setNewPlan({...newPlan, type: e.target.value})}>
                  {PLAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="plan-price" className="text-sm font-medium">Price ({studioCurrency})</label>
                <Input id="plan-price" type="number" step="0.01" value={newPlan.price} onChange={e => setNewPlan({...newPlan, price: e.target.value})} placeholder="0.00" />
              </div>
              <div>
                <label htmlFor="plan-interval" className="text-sm font-medium">Billing</label>
                <select id="plan-interval" className="w-full border rounded-md px-3 py-2 text-sm" value={newPlan.interval}
                  onChange={e => setNewPlan({...newPlan, interval: e.target.value})}>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="once">One-time</option>
                </select>
              </div>
              <div>
                <label htmlFor="plan-class-limit" className="text-sm font-medium">Class Limit</label>
                <Input id="plan-class-limit" type="number" value={newPlan.class_limit} onChange={e => setNewPlan({...newPlan, class_limit: e.target.value})} placeholder="Unlimited" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!newPlan.name || !newPlan.price}>Create Plan</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {plans.map(plan => (
          <Card key={plan.id}>
            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="min-w-0">
                  {editingPlan === plan.id ? (
                    <Input value={plan.name} onChange={e => updatePlanField(plan.id, 'name', e.target.value)} className="font-medium" />
                  ) : (
                    <div className="font-medium truncate">{plan.name}</div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {formatPrice(plan.price_cents, plan.currency)}
                    {plan.interval !== 'once' && `/${plan.interval}`}
                    {plan.class_limit && ` · ${plan.class_limit} classes`}
                    {plan.validity_days && ` · ${plan.validity_days} day expiry`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap shrink-0">
                <Badge variant={plan.active ? 'default' : 'secondary'}>
                  {plan.active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {plan.subscriber_count ?? 0} {(plan.subscriber_count ?? 0) === 1 ? 'subscriber' : 'subscribers'}
                </span>
                <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => handleEdit(plan.id)} aria-label={editingPlan === plan.id ? `Save ${plan.name}` : `Edit ${plan.name}`}>
                  {editingPlan === plan.id ? 'Save' : 'Edit'}
                </Button>
                {plan.active && (
                  <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => handleDeactivate(plan.id)} aria-label={`Deactivate ${plan.name}`}>
                    Deactivate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No plans yet. Create your first plan to start accepting members.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
