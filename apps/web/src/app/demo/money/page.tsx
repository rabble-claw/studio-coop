'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DemoPlansTab } from '@/components/demo/plans-tab'
import { DemoCouponsTab } from '@/components/demo/coupons-tab'
import { DemoExpensesTab } from '@/components/demo/expenses-tab'
import { DemoInstructorsTab } from '@/components/demo/instructors-tab'

export default function DemoMoneyPage() {
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
          <DemoPlansTab />
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <DemoCouponsTab />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <DemoExpensesTab />
        </TabsContent>

        <TabsContent value="instructors" className="mt-4">
          <DemoInstructorsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
