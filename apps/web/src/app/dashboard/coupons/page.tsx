'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { couponApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface Coupon {
  id: string
  code: string
  type: 'percent_off' | 'amount_off' | 'free_classes'
  value: number
  applies_to: string
  max_redemptions: number | null
  current_redemptions: number
  valid_from: string | null
  valid_until: string | null
  active: boolean
  created_at: string
}

function discountLabel(coupon: Coupon): string {
  if (coupon.type === 'percent_off') return `${coupon.value}% off`
  if (coupon.type === 'amount_off') return `$${(coupon.value / 100).toFixed(2)} off`
  return `${coupon.value} free class${coupon.value !== 1 ? 'es' : ''}`
}

function statusBadge(coupon: Coupon) {
  const now = new Date()
  if (!coupon.active) return <Badge variant="secondary">Inactive</Badge>
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return <Badge variant="outline">Expired</Badge>
  }
  if (coupon.max_redemptions !== null && coupon.current_redemptions >= coupon.max_redemptions) {
    return <Badge variant="outline">Maxed out</Badge>
  }
  return <Badge>Active</Badge>
}

export default function CouponsPage() {
  const router = useRouter()
  const supabase = useRef(createClient()).current

  const [couponList, setCouponList]   = useState<Coupon[]>([])
  const [studioId, setStudioId]       = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Create form state
  const [newCode, setNewCode]               = useState('')
  const [newType, setNewType]               = useState<'percent_off' | 'amount_off' | 'free_classes'>('percent_off')
  const [newValue, setNewValue]             = useState('10')
  const [newAppliesTo, setNewAppliesTo]     = useState('any')
  const [newMaxRedeem, setNewMaxRedeem]     = useState('')
  const [newValidFrom, setNewValidFrom]     = useState('')
  const [newValidUntil, setNewValidUntil]   = useState('')
  const [creating, setCreating]             = useState(false)
  const [createError, setCreateError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get the user's studio (first admin/owner membership)
      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['admin', 'owner'])
        .order('joined_at', { ascending: true })
        .limit(1)
        .single()

      if (!membership) { setLoading(false); return }

      setStudioId(membership.studio_id)

      try {
        const { data } = await supabase
          .from('coupons')
          .select('*')
          .eq('studio_id', membership.studio_id)
          .order('created_at', { ascending: false })

        setCouponList(data ?? [])
      } catch {
        setError('Failed to load coupons. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!studioId) return
    setCreating(true)
    setCreateError(null)

    try {
      const payload: Record<string, unknown> = {
        code:      newCode.toUpperCase().trim(),
        type:      newType,
        value:     parseInt(newValue, 10),
        appliesTo: newAppliesTo,
        active:    true,
      }
      if (newMaxRedeem) payload.maxRedemptions = parseInt(newMaxRedeem, 10)
      if (newValidFrom) payload.validFrom = new Date(newValidFrom).toISOString()
      if (newValidUntil) payload.validUntil = new Date(newValidUntil).toISOString()

      const data = await couponApi.create(studioId, payload) as { coupon: Coupon }
      setCouponList((prev) => [data.coupon, ...prev])
      setShowCreateForm(false)
      setNewCode('')
      setNewType('percent_off')
      setNewValue('10')
      setNewAppliesTo('any')
      setNewMaxRedeem('')
      setNewValidFrom('')
      setNewValidUntil('')
    } catch (err: unknown) {
      setCreateError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeactivate(couponId: string) {
    if (!studioId) return
    if (!confirm('Deactivate this coupon? Members will no longer be able to use it.')) return

    try {
      await couponApi.delete(studioId, couponId)
      setCouponList((prev) =>
        prev.map((c) => c.id === couponId ? { ...c, active: false } : c),
      )
    } catch {
      // Deactivation failed silently
    }
  }

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading coupons...</div>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-muted-foreground">{couponList.length} coupon{couponList.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { setShowCreateForm((v) => !v); setCreateError(null) }}>
          {showCreateForm ? 'Cancel' : '+ New Coupon'}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Coupon</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Code * (uppercase, no spaces)</label>
                  <Input
                    type="text"
                    placeholder="SUMMER20"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    required
                    minLength={2}
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as typeof newType)}
                  >
                    <option value="percent_off">Percent off (%)</option>
                    <option value="amount_off">Amount off (cents)</option>
                    <option value="free_classes">Free classes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Value *{' '}
                    {newType === 'percent_off' ? '(1–100)' : newType === 'amount_off' ? '(cents, e.g. 1000 = $10)' : '(number of classes)'}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={newType === 'percent_off' ? 100 : undefined}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Applies to</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newAppliesTo}
                    onChange={(e) => setNewAppliesTo(e.target.value)}
                  >
                    <option value="any">Any purchase</option>
                    <option value="plan">Membership plan</option>
                    <option value="drop_in">Drop-in only</option>
                    <option value="new_member">New members only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max redemptions</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={newMaxRedeem}
                    onChange={(e) => setNewMaxRedeem(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Valid from</label>
                  <Input
                    type="date"
                    value={newValidFrom}
                    onChange={(e) => setNewValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Valid until</label>
                  <Input
                    type="date"
                    value={newValidUntil}
                    onChange={(e) => setNewValidUntil(e.target.value)}
                  />
                </div>
              </div>

              {createError && <p className="text-sm text-red-600">{createError}</p>}

              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Coupon'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Coupon list */}
      {couponList.length === 0 && !showCreateForm ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No coupons yet</p>
            <p className="text-sm">Create a coupon to offer discounts to your members.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {couponList.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Code */}
                    <div className="font-mono font-bold text-lg tracking-wider min-w-[100px]">
                      {coupon.code}
                    </div>

                    {/* Discount info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{discountLabel(coupon)}</div>
                      <div className="text-xs text-muted-foreground space-x-2">
                        <span className="capitalize">{coupon.applies_to.replace('_', ' ')}</span>
                        <span>·</span>
                        <span>
                          {coupon.current_redemptions}
                          {coupon.max_redemptions !== null ? `/${coupon.max_redemptions}` : ''} uses
                        </span>
                        {coupon.valid_from && (
                          <>
                            <span>·</span>
                            <span>From {new Date(coupon.valid_from).toLocaleDateString()}</span>
                          </>
                        )}
                        {coupon.valid_until && (
                          <>
                            <span>·</span>
                            <span>Until {new Date(coupon.valid_until).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(coupon)}
                    {coupon.active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeactivate(coupon.id)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
