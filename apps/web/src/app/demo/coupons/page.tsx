'use client'

import { demoCoupons } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function getCouponStatus(coupon: (typeof demoCoupons)[number]) {
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

function discountLabel(coupon: (typeof demoCoupons)[number]) {
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-muted-foreground">Manage discount codes</p>
        </div>
        <Button disabled>+ Create Coupon</Button>
      </div>

      <div className="grid gap-4">
        {demoCoupons.map((coupon) => {
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
                  <Button variant="outline" size="sm" disabled>
                    Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
