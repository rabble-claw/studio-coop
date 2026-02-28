'use client'

import { useState } from 'react'
import { demoCoupons } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface Coupon {
  id: string
  studio_id: string
  code: string
  type: 'percent_off' | 'free_classes'
  value: number
  applies_to: 'new_member' | 'drop_in'
  max_redemptions: number | null
  current_redemptions: number
  valid_from: string
  valid_until: string
  active: boolean
}

function getCouponStatus(coupon: Coupon) {
  if (!coupon.active) return 'inactive'
  if (new Date(coupon.valid_until) < new Date()) return 'expired'
  return 'active'
}

function statusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
    case 'expired':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Expired</Badge>
    default:
      return <Badge variant="secondary">Inactive</Badge>
  }
}

function discountLabel(coupon: Coupon) {
  if (coupon.type === 'percent_off') return `${coupon.value}% off`
  if (coupon.type === 'free_classes') return `${coupon.value} free class${coupon.value !== 1 ? 'es' : ''}`
  return String(coupon.value)
}

function appliesToLabel(appliesTo: string) {
  switch (appliesTo) {
    case 'new_member':
      return 'New members'
    case 'drop_in':
      return 'Drop-in classes'
    default:
      return appliesTo
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function DemoCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([...demoCoupons])
  const [showForm, setShowForm] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)

  // Form state
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percent_off' | 'free_classes'>('percent_off')
  const [value, setValue] = useState('')
  const [appliesTo, setAppliesTo] = useState<'new_member' | 'drop_in'>('new_member')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')

  function resetForm() {
    setCode('')
    setType('percent_off')
    setValue('')
    setAppliesTo('new_member')
    setMaxRedemptions('')
    setValidFrom('')
    setValidUntil('')
    setShowForm(false)
  }

  function handleCreate() {
    if (!code.trim() || !value || !validFrom || !validUntil) return

    const newCoupon: Coupon = {
      id: `coupon-${Date.now()}`,
      studio_id: 'demo-empire-001',
      code: code.trim().toUpperCase(),
      type,
      value: Number(value),
      applies_to: appliesTo,
      max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
      current_redemptions: 0,
      valid_from: new Date(validFrom).toISOString(),
      valid_until: new Date(validUntil + 'T23:59:59').toISOString(),
      active: true,
    }

    setCoupons((prev) => [newCoupon, ...prev])
    resetForm()
  }

  function toggleActive(couponId: string) {
    setCoupons((prev) =>
      prev.map((c) =>
        c.id === couponId ? { ...c, active: !c.active } : c
      )
    )
    setConfirmDeactivate(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-muted-foreground">Manage discount codes</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Create Coupon</Button>
      </div>

      {/* Create Coupon Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => resetForm()}>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Create Coupon</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. SUMMER30"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'percent_off' | 'free_classes')}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="percent_off">Percent Off</option>
                  <option value="free_classes">Free Classes</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  {type === 'percent_off' ? 'Percentage' : 'Number of Classes'}
                </label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === 'percent_off' ? 'e.g. 20' : 'e.g. 2'}
                  min="1"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Applies to</label>
                <select
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value as 'new_member' | 'drop_in')}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="new_member">New Members</option>
                  <option value="drop_in">Drop-in</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Max redemptions (optional)</label>
                <Input
                  type="number"
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  placeholder="Unlimited"
                  min="1"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Valid from</label>
                  <Input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Valid until</label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!code.trim() || !value || !validFrom || !validUntil}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {coupons.map((coupon) => {
          const status = getCouponStatus(coupon)
          return (
            <Card key={coupon.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono font-bold text-lg">{coupon.code}</CardTitle>
                  {statusBadge(status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>Discount: {discountLabel(coupon)}</span>
                  <span>Applies to: {appliesToLabel(coupon.applies_to)}</span>
                  <span>
                    Redemptions: {coupon.current_redemptions} / {coupon.max_redemptions ?? 'unlimited'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Valid {formatDate(coupon.valid_from)} &ndash; {formatDate(coupon.valid_until)}
                </div>
                <div className="pt-2">
                  {confirmDeactivate === coupon.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {coupon.active ? 'Deactivate' : 'Activate'} this coupon?
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => toggleActive(coupon.id)}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDeactivate(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDeactivate(coupon.id)}
                    >
                      {coupon.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
