'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { api, scheduleApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface ClassTemplate {
  id: string
  name: string
  default_capacity: number
}

interface Teacher {
  id: string
  name: string
}

export default function SchedulePage() {
  const router = useRouter()
  const [studioId, setStudioId] = useState<string | null>(null)
  const [classesByDate, setClassesByDate] = useState<Record<string, ClassInstance[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddClass, setShowAddClass] = useState(false)

  // Add class form
  const [templates, setTemplates] = useState<ClassTemplate[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [newClass, setNewClass] = useState({
    template_id: '', teacher_id: '', date: '', start_time: '', end_time: '', max_capacity: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) { setLoading(false); return }
      setStudioId(membership.studio_id)

      try {
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

        // Load templates and teachers for the add class form
        const { data: tpls } = await supabase
          .from('class_templates')
          .select('id, name, default_capacity')
          .eq('studio_id', membership.studio_id)
          .order('name')

        setTemplates((tpls ?? []) as ClassTemplate[])

        // Teachers are members with role 'teacher', 'admin', or 'owner'
        const { data: staffMembers } = await supabase
          .from('memberships')
          .select('user:users(id, name)')
          .eq('studio_id', membership.studio_id)
          .in('role', ['teacher', 'admin', 'owner'])
          .eq('status', 'active')

        const teacherList: Teacher[] = (staffMembers ?? []).map(m => {
          const u = m.user as unknown as { id: string; name: string } | null
          return { id: u?.id ?? '', name: u?.name ?? 'Unknown' }
        }).filter(t => t.id)
        setTeachers(teacherList)
      } catch {
        setError('Failed to load schedule. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleTemplateChange(templateId: string) {
    const tpl = templates.find(t => t.id === templateId)
    setNewClass({
      ...newClass,
      template_id: templateId,
      max_capacity: tpl?.default_capacity?.toString() ?? newClass.max_capacity,
    })
  }

  async function handleAddClass() {
    if (!studioId) return
    setCreating(true)
    try {
      await api.post(`/studios/${studioId}/classes`, {
        template_id: newClass.template_id || undefined,
        teacher_id: newClass.teacher_id || undefined,
        date: newClass.date,
        start_time: newClass.start_time,
        end_time: newClass.end_time,
        max_capacity: newClass.max_capacity ? parseInt(newClass.max_capacity) : 12,
      })

      // Reload schedule
      const supabase = createClient()
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: classes } = await supabase
        .from('class_instances')
        .select('id, date, start_time, end_time, max_capacity, booked_count, status, template:class_templates(name), teacher:users!class_instances_teacher_id_fkey(name)')
        .eq('studio_id', studioId)
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

      setShowAddClass(false)
      setNewClass({ template_id: '', teacher_id: '', date: '', start_time: '', end_time: '', max_capacity: '' })
    } catch (e) {
      alert(`Failed to create class: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
    setCreating(false)
  }

  async function handleRestoreClass(e: React.MouseEvent, classId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!studioId) return
    if (!confirm('Restore this cancelled class? Previously booked members will be notified.')) return
    try {
      await scheduleApi.restoreClass(studioId, classId)
      // Update local state
      setClassesByDate((prev) => {
        const updated = { ...prev }
        for (const date of Object.keys(updated)) {
          updated[date] = updated[date]!.map((cls) =>
            cls.id === classId ? { ...cls, status: 'scheduled' } : cls,
          )
        }
        return updated
      })
    } catch (err) {
      alert(`Failed to restore class: ${(err as Error).message}`)
    }
  }

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
        <Button onClick={() => setShowAddClass(!showAddClass)}>
          {showAddClass ? 'Cancel' : '+ Add Class'}
        </Button>
      </div>

      {error && (
        <div className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {showAddClass && (
        <Card>
          <CardHeader><CardTitle>Add One-Off Class</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Class Template</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={newClass.template_id}
                  onChange={e => handleTemplateChange(e.target.value)}>
                  <option value="">Select a template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Teacher</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={newClass.teacher_id}
                  onChange={e => setNewClass({...newClass, teacher_id: e.target.value})}>
                  <option value="">Select teacher...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={newClass.date} onChange={e => setNewClass({...newClass, date: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Input type="time" value={newClass.start_time} onChange={e => setNewClass({...newClass, start_time: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <Input type="time" value={newClass.end_time} onChange={e => setNewClass({...newClass, end_time: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Capacity</label>
                <Input type="number" value={newClass.max_capacity} onChange={e => setNewClass({...newClass, max_capacity: e.target.value})} placeholder="12" />
              </div>
            </div>
            <Button onClick={handleAddClass} disabled={creating || !newClass.date || !newClass.start_time}>
              {creating ? 'Creating...' : 'Create Class'}
            </Button>
          </CardContent>
        </Card>
      )}

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
                    <Link key={cls.id} href={`/dashboard/classes/${cls.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="py-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <div className="text-sm font-mono text-muted-foreground sm:w-28">
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
                              {cls.status === 'cancelled' ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap bg-red-100 text-red-700">
                                    Cancelled
                                  </span>
                                  <button
                                    onClick={(e) => handleRestoreClass(e, cls.id)}
                                    className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 whitespace-nowrap"
                                  >
                                    Restore
                                  </button>
                                </div>
                              ) : (
                                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                  spotsLeft <= 2
                                    ? 'bg-red-100 text-red-700'
                                    : spotsLeft <= 4
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {spotsLeft === 0 ? 'Full' : `${spotsLeft} left`}
                                </span>
                              )}
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
      )}
    </div>
  )
}
