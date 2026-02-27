'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatTime, formatDate } from '@/lib/utils'

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  max_capacity: number
  booked_count: number
  status: string
  template: { name: string } | null
  teacher: { name: string } | null
}

export default function SchedulePage() {
  const [classesByDate, setClassesByDate] = useState<Record<string, ClassInstance[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) { setLoading(false); return }

      const todayStr = new Date().toISOString().split('T')[0]
      const { data: classes } = await supabase
        .from('class_instances')
        .select('id, date, start_time, end_time, max_capacity, booked_count, status, template:class_templates(name), teacher:users!class_instances_teacher_id_fkey(name)')
        .eq('studio_id', membership.studio_id)
        .gte('date', todayStr)
        .order('date')
        .order('start_time')
        .limit(100)

      const grouped = (classes ?? []).reduce<Record<string, ClassInstance[]>>((acc, cls) => {
        const c = cls as unknown as ClassInstance
        if (!acc[c.date]) acc[c.date] = []
        acc[c.date]!.push(c)
        return acc
      }, {})
      setClassesByDate(grouped)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-muted-foreground">Loading schedule...</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">Manage your studio&apos;s class schedule</p>
        </div>
        <Button>+ Add Class</Button>
      </div>

      {Object.keys(classesByDate).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No upcoming classes. Create your first class to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(classesByDate).map(([date, classes]) => (
            <div key={date}>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {formatDate(date)}
              </h2>
              <div className="grid gap-2">
                {classes.map((cls) => {
                  const spotsLeft = cls.max_capacity - (cls.booked_count ?? 0)
                  const fillPercent = ((cls.booked_count ?? 0) / cls.max_capacity) * 100
                  return (
                    <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-mono text-muted-foreground w-28">
                                {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                              </div>
                              <div>
                                <div className="font-medium">{cls.template?.name ?? 'Class'}</div>
                                <div className="text-sm text-muted-foreground">with {cls.teacher?.name ?? 'TBA'}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm">
                                <span className="font-medium">{cls.booked_count ?? 0}</span>
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
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
