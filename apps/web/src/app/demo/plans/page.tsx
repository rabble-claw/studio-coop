'use client'

import { demoMembershipPlans } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(cents / 100)
}

export default function DemoPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membership Plans</h1>
        <p className="text-muted-foreground">Empire Aerial Arts pricing</p>
      </div>

      <div className="grid gap-4">
        {demoMembershipPlans.map((plan) => (
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
              <Badge variant="default">Active</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
