'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTime, formatDate, getDayName } from '@/lib/utils'

interface ClassTemplate {
  id: string
  name: string
  description: string | null
  day_of_week: number
  start_time: string
  duration_min: number
  max_capacity: number
  location: string | null
  recurrence: string
  active: boolean
  teacher: { name: string } | null
}

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  notes: string | null
  feed_enabled: boolean
  teacher: { name: string } | null
  template: { name: string } | null
  booking_count: number
}

export default function SchedulePage() {
  const [templates, setTemplates] = useState<ClassTemplate[]>([])
  const [instances, setInstances] = useState<ClassInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    dayOfWeek: '1',
    startTime: '18:00',
    durationMin: '60',
    maxCapacity: '12',
    location: '',
    recurrence: 'weekly',
  })
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('memberships')
      .select('studio_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!membership) return

    const studioId = membership.studio_id

    const [{ data: tpls }, { data: insts }] = await Promise.all([
      supabase
        .from('class_templates')
        .select('*, teacher:users!class_templates_teacher_id_fkey(name)')
        .eq('studio_id', studioId)
        .order('day_of_week')
        .order('start_time'),
      supabase
        .from('class_instances')
        .select('*, teacher:users!class_instances_teacher_id_fkey(name), template:class_templates!class_instances_template_id_fkey(name)')
        .eq('studio_id', studioId)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date')
        .order('start_time')
        .limit(20),
    ])

    // Get booking counts for instances
    const instancesWithCounts = await Promise.all(
      (insts ?? []).map(async (inst) => {
        const { count } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('class_instance_id', inst.id)
          .in('status', ['booked', 'confirmed'])
        return { ...inst, booking_count: count ?? 0 }
      })
    )

    setTemplates(tpls ?? [])
    setInstances(instancesWithCounts)
    setLoading(false)
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('memberships')
      .select('studio_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!membership) return

    await supabase.from('class_templates').insert({
      studio_id: membership.studio_id,
      name: newTemplate.name,
      description: newTemplate.description || null,
      teacher_id: user.id,
      day_of_week: parseInt(newTemplate.dayOfWeek),
      start_time: newTemplate.startTime,
      duration_min: parseInt(newTemplate.durationMin),
      max_capacity: parseInt(newTemplate.maxCapacity),
      location: newTemplate.location || null,
      recurrence: newTemplate.recurrence,
    })

    setShowNewTemplate(false)
    setNewTemplate({ name: '', description: '', dayOfWeek: '1', startTime: '18:00', durationMin: '60', maxCapacity: '12', location: '', recurrence: 'weekly' })
    loadData()
  }

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading schedule...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground mt-1">Manage your class templates and upcoming instances</p>
        </div>
        <Button onClick={() => setShowNewTemplate(true)}>New class</Button>
      </div>

      {/* New Template Form */}
      {showNewTemplate && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create class template</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTemplate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Class name</label>
                <Input value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} required placeholder="e.g. Intro to Pole" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Input value={newTemplate.description} onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })} placeholder="Optional description" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Day</label>
                <select value={newTemplate.dayOfWeek} onChange={(e) => setNewTemplate({ ...newTemplate, dayOfWeek: e.target.value })} className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  {[0,1,2,3,4,5,6].map((d) => <option key={d} value={d}>{getDayName(d)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Start time</label>
                <Input type="time" value={newTemplate.startTime} onChange={(e) => setNewTemplate({ ...newTemplate, startTime: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Duration (min)</label>
                <Input type="number" value={newTemplate.durationMin} onChange={(e) => setNewTemplate({ ...newTemplate, durationMin: e.target.value })} required min={15} max={240} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Max capacity</label>
                <Input type="number" value={newTemplate.maxCapacity} onChange={(e) => setNewTemplate({ ...newTemplate, maxCapacity: e.target.value })} required min={1} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Location</label>
                <Input value={newTemplate.location} onChange={(e) => setNewTemplate({ ...newTemplate, location: e.target.value })} placeholder="e.g. Studio A" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Recurrence</label>
                <select value={newTemplate.recurrence} onChange={(e) => setNewTemplate({ ...newTemplate, recurrence: e.target.value })} className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="once">One-time</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit">Create template</Button>
                <Button type="button" variant="outline" onClick={() => setShowNewTemplate(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming Classes</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <div className="space-y-3 mt-4">
            {instances.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No upcoming classes scheduled.</p>
            ) : (
              instances.map((inst) => (
                <Link key={inst.id} href={`/dashboard/classes/${inst.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-xs text-muted-foreground uppercase">{formatDate(inst.date).split(',')[0]}</div>
                          <div className="text-lg font-bold">{new Date(inst.date + 'T00:00:00').getDate()}</div>
                        </div>
                        <div>
                          <div className="font-medium">{inst.template?.name ?? 'Untitled class'}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatTime(inst.start_time)} — {formatTime(inst.end_time)}
                            {inst.teacher && ` with ${inst.teacher.name}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-muted-foreground">
                          {inst.booking_count}/{inst.max_capacity} booked
                        </div>
                        <Badge variant={inst.status === 'scheduled' ? 'secondary' : inst.status === 'completed' ? 'outline' : 'destructive'}>
                          {inst.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-3 mt-4">
            {templates.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No class templates yet. Create one above.</p>
            ) : (
              templates.map((tpl) => (
                <Card key={tpl.id} className={!tpl.active ? 'opacity-60' : ''}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getDayName(tpl.day_of_week)}s at {formatTime(tpl.start_time)} — {tpl.duration_min} min
                        {tpl.teacher && ` with ${tpl.teacher.name}`}
                        {tpl.location && ` in ${tpl.location}`}
                      </div>
                      {tpl.description && (
                        <div className="text-sm text-muted-foreground mt-1">{tpl.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground">
                        {tpl.max_capacity} spots
                      </div>
                      <Badge variant="secondary">{tpl.recurrence}</Badge>
                      {!tpl.active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
