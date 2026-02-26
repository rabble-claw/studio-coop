'use client'

import { useEffect, useState } from 'react'
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
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newPlan, setNewPlan] = useState({
    name: '', type: 'unlimited', price: '', interval: 'month',
    class_limit: '', validity_days: '',
  })

  useEffect(() => {
    // Demo data for now — will connect to API
    setPlans([
      { id: '1', name: 'Unlimited Monthly', type: 'unlimited', price_cents: 22000, currency: 'NZD', interval: 'month', class_limit: null, validity_days: null, active: true, subscriber_count: 24 },
      { id: '2', name: '10-Class Pack', type: 'class_pack', price_cents: 18000, currency: 'NZD', interval: 'once', class_limit: 10, validity_days: 90, active: true, subscriber_count: 18 },
      { id: '3', name: 'Drop-in', type: 'drop_in', price_cents: 2800, currency: 'NZD', interval: 'once', class_limit: 1, validity_days: null, active: true, subscriber_count: 0 },
      { id: '4', name: 'Intro: 3 Classes', type: 'intro', price_cents: 4500, currency: 'NZD', interval: 'once', class_limit: 3, validity_days: 14, active: true, subscriber_count: 6 },
    ])
    setLoading(false)
  }, [])

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(cents / 100)
  }

  function handleCreate() {
    const plan: Plan = {
      id: Date.now().toString(),
      name: newPlan.name,
      type: newPlan.type as Plan['type'],
      price_cents: Math.round(parseFloat(newPlan.price || '0') * 100),
      currency: 'NZD',
      interval: newPlan.interval as Plan['interval'],
      class_limit: newPlan.class_limit ? parseInt(newPlan.class_limit) : null,
      validity_days: newPlan.validity_days ? parseInt(newPlan.validity_days) : null,
      active: true,
      subscriber_count: 0,
    }
    setPlans([...plans, plan])
    setShowCreate(false)
    setNewPlan({ name: '', type: 'unlimited', price: '', interval: 'month', class_limit: '', validity_days: '' })
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading plans...</div>

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

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Create New Plan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Plan Name</label>
                <Input value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} placeholder="e.g. Unlimited Monthly" />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={newPlan.type}
                  onChange={e => setNewPlan({...newPlan, type: e.target.value})}>
                  {PLAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Price (NZD)</label>
                <Input type="number" step="0.01" value={newPlan.price} onChange={e => setNewPlan({...newPlan, price: e.target.value})} placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Billing</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={newPlan.interval}
                  onChange={e => setNewPlan({...newPlan, interval: e.target.value})}>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="once">One-time</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Class Limit</label>
                <Input type="number" value={newPlan.class_limit} onChange={e => setNewPlan({...newPlan, class_limit: e.target.value})} placeholder="∞" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!newPlan.name || !newPlan.price}>Create Plan</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {plans.map(plan => (
          <Card key={plan.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-medium">{plan.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatPrice(plan.price_cents, plan.currency)}
                    {plan.interval !== 'once' && `/${plan.interval}`}
                    {plan.class_limit && ` · ${plan.class_limit} classes`}
                    {plan.validity_days && ` · ${plan.validity_days} day expiry`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={plan.active ? 'default' : 'secondary'}>
                  {plan.active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {plan.subscriber_count} {plan.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
                </span>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
