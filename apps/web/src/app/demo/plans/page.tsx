'use client'

import { useState } from 'react'
import { demoMembershipPlans, demoStudio } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface Plan {
  id: string
  studio_id: string
  name: string
  description: string | null
  type: 'unlimited' | 'class_pack' | 'drop_in'
  price_cents: number
  currency: string
  interval: 'month' | 'once'
  class_limit: number | null
  validity_days: number | null
  active: boolean
  sort_order: number
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(cents / 100)
}

export default function DemoPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([...demoMembershipPlans])
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<'unlimited' | 'class_pack' | 'drop_in'>('unlimited')
  const [price, setPrice] = useState('')
  const [interval, setInterval] = useState<'month' | 'once'>('month')
  const [classLimit, setClassLimit] = useState('')
  const [validityDays, setValidityDays] = useState('')
  const [description, setDescription] = useState('')

  function resetForm() {
    setName('')
    setType('unlimited')
    setPrice('')
    setInterval('month')
    setClassLimit('')
    setValidityDays('')
    setDescription('')
    setShowForm(false)
    setEditingPlan(null)
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan)
    setName(plan.name)
    setType(plan.type)
    setPrice(String(plan.price_cents / 100))
    setInterval(plan.interval)
    setClassLimit(plan.class_limit ? String(plan.class_limit) : '')
    setValidityDays(plan.validity_days ? String(plan.validity_days) : '')
    setDescription(plan.description ?? '')
    setShowForm(true)
  }

  function handleCreate() {
    if (!name.trim() || !price) return

    if (editingPlan) {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === editingPlan.id
            ? {
                ...p,
                name: name.trim(),
                description: description.trim() || null,
                type,
                price_cents: Math.round(Number(price) * 100),
                interval,
                class_limit: classLimit ? Number(classLimit) : null,
                validity_days: validityDays ? Number(validityDays) : null,
              }
            : p
        )
      )
      resetForm()
      return
    }

    const newPlan: Plan = {
      id: `plan-${Date.now()}`,
      studio_id: 'demo-empire-001',
      name: name.trim(),
      description: description.trim() || null,
      type,
      price_cents: Math.round(Number(price) * 100),
      currency: 'NZD',
      interval,
      class_limit: classLimit ? Number(classLimit) : null,
      validity_days: validityDays ? Number(validityDays) : null,
      active: true,
      sort_order: plans.length + 1,
    }

    setPlans((prev) => [...prev, newPlan])
    resetForm()
  }

  function handleDelete(planId: string) {
    setPlans((prev) => prev.filter((p) => p.id !== planId))
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Membership Plans</h1>
          <p className="text-muted-foreground">{demoStudio.name} pricing</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Create Plan</Button>
      </div>

      {/* Create Plan Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => resetForm()}>
          <div className="bg-card rounded-lg shadow-lg border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{editingPlan ? 'Edit Plan' : 'Create Plan'}</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 10-Class Pack"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'unlimited' | 'class_pack' | 'drop_in')}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="unlimited">Unlimited</option>
                  <option value="class_pack">Class Pack</option>
                  <option value="drop_in">Drop-in</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Price (NZD)</label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 180.00"
                    min="0"
                    step="0.01"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Interval</label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as 'month' | 'once')}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="month">Month</option>
                    <option value="once">Once</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Class limit (optional)</label>
                  <Input
                    type="number"
                    value={classLimit}
                    onChange={(e) => setClassLimit(e.target.value)}
                    placeholder="Unlimited"
                    min="1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Validity days (optional)</label>
                  <Input
                    type="number"
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    placeholder="No expiry"
                    min="1"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this plan..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || !price}
              >
                {editingPlan ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="font-medium">{plan.name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatPrice(plan.price_cents, plan.currency)}
                  {plan.interval !== 'once' && `/${plan.interval}`}
                  {plan.class_limit && ` · ${plan.class_limit} classes`}
                  {plan.validity_days && ` · ${plan.validity_days} day expiry`}
                </div>
                {plan.description && (
                  <div className="text-sm text-muted-foreground mt-1">{plan.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">Active</Badge>
                <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>Edit</Button>
                {confirmDelete === plan.id ? (
                  <div className="flex items-center gap-1">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(plan.id)}>Confirm</Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(plan.id)}>Delete</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
