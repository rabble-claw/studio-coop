'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlansTab } from '@/components/money/plans-tab'
import { CouponsTab } from '@/components/money/coupons-tab'
import { ExpensesTab } from '@/components/money/expenses-tab'
import { InstructorsTab } from '@/components/money/instructors-tab'

export default function MoneyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Money</h1>
        <p className="text-muted-foreground">Plans, coupons, expenses, and instructor compensation</p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="plans" className="min-h-[44px] touch-manipulation">Plans</TabsTrigger>
          <TabsTrigger value="coupons" className="min-h-[44px] touch-manipulation">Coupons</TabsTrigger>
          <TabsTrigger value="expenses" className="min-h-[44px] touch-manipulation">Expenses</TabsTrigger>
          <TabsTrigger value="instructors" className="min-h-[44px] touch-manipulation">Instructors</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <PlansTab />
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <CouponsTab />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab />
        </TabsContent>

        <TabsContent value="instructors" className="mt-4">
          <InstructorsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
