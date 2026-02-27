'use client'

import { useEffect, useRef, useState } from 'react'
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

const EMPTY_FORM = {
  name: '', type: 'unlimited', price: '', interval: 'month', class_limit: '', validity_days: '',
}

function planToForm(plan: Plan) {
  return {
    name: plan.name,
    type: plan.type,
    price: (plan.price_cents / 100).toFixed(2),
    interval: plan.interval,
    class_limit: plan.class_limit?.toString() ?? '',
    validity_days: plan.validity_days?.toString() ?? '',
  }
}

function buildPayload(form: typeof EMPTY_FORM) {
  return {
    name: form.name,
    type: form.type,
    price_cents: Math.round(parseFloat(form.price || '0') * 100),
    interval: form.interval,
    class_limit: form.class_limit ? parseInt(form.class_limit) : null,
    validity_days: form.validity_days ? parseInt(form.validity_days) : null,
  }
}

function unwrapPlan(res: unknown): Plan {
  const r = res as Record<string, unknown>
  return (r.plan ?? res) as Plan
}

function unwrapPlans(res: unknown): Plan[] {
  if (Array.isArray(res)) return res as Plan[]
  const r = res as Record<string, unknown>
  return (Array.isArray(r.plans) ? r.plans : []) as Plan[]
}

export default function PlansPage() {
  const supabase = useRef(createClient()).current
  const [plans, setPlans] = useState<Plan[]>([])
  const [studioId, setStudioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['admin', 'owner', 'teacher'])
        .order('joined_at', { ascending: true })
        .limit(1)
        .single()

      if (!membership) { setLoading(false); return }
      setStudioId(membership.studio_id)

      try {
        const res = await planApi.list(membership.studio_id)
        setPlans(unwrapPlans(res))
      } catch (err: unknown) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(cents / 100)
  }

  function openCreate() {
    setEditingPlan(null)
    setForm({ ...EMPTY_FORM })
    setFormError(null)
    setShowCreate(true)
  }

  function openEdit(plan: Plan) {
    setShowCreate(false)
    setEditingPlan(plan)
    setForm(planToForm(plan))
    setFormError(null)
  }

  function closeForm() {
    setShowCreate(false)
    setEditingPlan(null)
    setFormError(null)
  }

  async function handleSave() {
    if (!studioId) return
    setSaving(true)
    setFormError(null)

    try {
      const payload = buildPayload(form)

      if (editingPlan) {
        const res = await planApi.update(studioId, editingPlan.id, payload)
        const updated = unwrapPlan(res)
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...updated } : p))
        setEditingPlan(null)
      } else {
        const res = await planApi.create(studioId, payload)
        const created = unwrapPlan(res)
        setPlans(prev => [...prev, { ...created, subscriber_count: 0 }])
        setShowCreate(false)
      }
      setForm({ ...EMPTY_FORM })
    } catch (err: unknown) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(plan: Plan) {
    if (!studioId) return
    if (!confirm(`Delete "${plan.name}"? This cannot be undone.`)) return

    try {
      await planApi.delete(studioId, plan.id)
      setPlans(prev => prev.filter(p => p.id !== plan.id))
      if (editingPlan?.id === plan.id) closeForm()
    } catch (err: unknown) {
      alert((err as Error).message)
    }
  }

  async function handleToggleActive(plan: Plan) {
    if (!studioId) return
    try {
      const res = await planApi.update(studioId, plan.id, { active: !plan.active })
      const updated = unwrapPlan(res)
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, ...updated } : p))
    } catch (err: unknown) {
      alert((err as Error).message)
    }
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading plans...</div>
  if (error) return <div className="py-20 text-center text-red-600">Error: {error}</div>

  const showForm = showCreate || editingPlan !== null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Membership Plans</h1>
          <p className="text-muted-foreground">Manage pricing and membership options</p>
        </div>
        <Button onClick={showCreate ? closeForm : openCreate}>
          {showCreate ? 'Cancel' : '+ New Plan'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingPlan ? `Edit: ${editingPlan.name}` : 'Create New Plan'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Plan Name</label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Unlimited Monthly"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                >
                  {PLAN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Price (NZD)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Billing</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.interval}
                  onChange={e => setForm({ ...form, interval: e.target.value })}
                >
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="once">One-time</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Class Limit</label>
                <Input
                  type="number"
                  value={form.class_limit}
                  onChange={e => setForm({ ...form, class_limit: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Validity (days)</label>
                <Input
                  type="number"
                  value={form.validity_days}
                  onChange={e => setForm({ ...form, validity_days: e.target.value })}
                  placeholder="No expiry"
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.name || !form.price}>
                {saving ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
              </Button>
              <Button variant="ghost" onClick={closeForm}>Cancel</Button>
              {editingPlan && (
                <Button
                  variant="ghost"
                  className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(editingPlan)}
                >
                  Delete Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {plans.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No plans yet</p>
            <p className="text-sm">Create your first membership plan to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className={editingPlan?.id === plan.id ? 'ring-2 ring-primary' : ''}>
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
                    {plan.subscriber_count ?? 0}{' '}
                    {plan.subscriber_count === 1 ? 'subscriber' : 'subscribers'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(plan)}>
                    {plan.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
