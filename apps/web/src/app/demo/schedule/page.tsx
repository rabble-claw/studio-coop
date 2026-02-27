'use client'

import Link from 'next/link'
import { demoClasses, type DemoClass } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatTime, formatDate } from '@/lib/utils'

export default function DemoSchedulePage() {
  const classesByDate = demoClasses.reduce<Record<string, DemoClass[]>>((acc, cls) => {
    if (!acc[cls.date]) acc[cls.date] = []
    acc[cls.date]!.push(cls)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">Empire Aerial Arts class schedule</p>
        </div>
        <Button disabled>+ Add Class</Button>
      </div>

      <div className="space-y-6">
        {Object.entries(classesByDate).map(([date, classes]) => (
          <div key={date}>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {formatDate(date)}
            </h2>
            <div className="grid gap-2">
              {classes.map((cls) => {
                const spotsLeft = cls.max_capacity - cls.booked_count
                const fillPercent = (cls.booked_count / cls.max_capacity) * 100
                return (
                  <Link key={cls.id} href={`/demo/classes/${cls.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-mono text-muted-foreground w-28">
                                {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                              </div>
                              <div>
                                <div className="font-medium">{cls.template.name}</div>
                                <div className="text-sm text-muted-foreground">with {cls.teacher.name}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm">
                                <span className="font-medium">{cls.booked_count}</span>
                                <span className="text-muted-foreground">/{cls.max_capacity}</span>
                              </div>
                              <div className="w-20 h-1.5 bg-secondary rounded-full mt-1">
                                <div
                                  className={`h-full rounded-full ${fillPercent > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(fillPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              spotsLeft <= 2
                                ? 'bg-red-100 text-red-700'
                                : spotsLeft <= 4
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {spotsLeft === 0 ? 'Full' : `${spotsLeft} left`}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
