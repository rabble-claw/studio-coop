'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { scheduleApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTime, getDayName } from '@/lib/utils'

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  max_capacity: number
  notes: string | null
  feed_enabled: boolean
  template: { id: string; name: string; description: string | null; recurrence: string } | null
  teacher: { id: string; name: string; avatar_url: string | null } | null
  booking_count: number
}

interface ClassTemplate {
  id: string
  name: string
  description: string | null
  day_of_week: number
  start_time: string
  duration_min: number
  max_capacity: number | null
  recurrence: string
  active: boolean
  teacher_id: string | null
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  // Shift to Monday (dow=1). Sunday (dow=0) goes back 6 days.
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]!
}

const BLANK_FORM = {
  name: '',
  description: '',
  day_of_week: '1',
  start_time: '09:00',
  duration_min: '60',
  max_capacity: '',
  recurrence: 'weekly',
  active: true,
}

export default function SchedulePage() {
  const [studioId, setStudioId] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [instances, setInstances] = useState<ClassInstance[]>([])
  const [templates, setTemplates] = useState<ClassTemplate[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [loadingStudio, setLoadingStudio] = useState(true)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  // Template form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Resolve studio ID via Supabase auth on mount
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingStudio(false); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', ['owner', 'admin', 'teacher'])
        .limit(1)
        .single()

      if (!membership) { setLoadingStudio(false); return }
      setStudioId(membership.studio_id)
      setLoadingStudio(false)
    }
    init()
  }, [])

  // Fetch templates whenever studio is known
  useEffect(() => {
    if (!studioId) return
    scheduleApi.getTemplates(studioId)
      .then((data) => setTemplates(data as ClassTemplate[]))
      .catch(() => {})
  }, [studioId])

  // Fetch schedule whenever studio or week changes
  useEffect(() => {
    if (!studioId) return

    const from = toDateStr(weekStart)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const to = toDateStr(weekEnd)

    setLoadingSchedule(true)
    setScheduleError(null)

    scheduleApi.getInstances(studioId, `from=${from}&to=${to}`)
      .then((data) => {
        setInstances(data as ClassInstance[])
        setLoadingSchedule(false)
      })
      .catch((err: unknown) => {
        setScheduleError((err as Error).message)
        setLoadingSchedule(false)
      })
  }, [studioId, weekStart])

  // Build the 7-day array for the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const instancesByDate = instances.reduce<Record<string, ClassInstance[]>>((acc, inst) => {
    if (!acc[inst.date]) acc[inst.date] = []
    acc[inst.date]!.push(inst)
    return acc
  }, {})

  const todayStr = toDateStr(new Date())

  async function handleCancel(instanceId: string) {
    if (!studioId) return
    const reason = window.prompt('Reason for cancellation (optional):')
    if (reason === null) return // user dismissed

    setCancelling(instanceId)
    try {
      await scheduleApi.cancelInstance(studioId, instanceId, reason || undefined)
      setInstances((prev) =>
        prev.map((inst) => inst.id === instanceId ? { ...inst, status: 'cancelled' } : inst)
      )
    } catch (err: unknown) {
      window.alert(`Failed to cancel: ${(err as Error).message}`)
    } finally {
      setCancelling(null)
    }
  }

  function openCreate() {
    setEditingId(null)
    setForm(BLANK_FORM)
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(tmpl: ClassTemplate) {
    setEditingId(tmpl.id)
    setForm({
      name: tmpl.name,
      description: tmpl.description ?? '',
      day_of_week: String(tmpl.day_of_week),
      start_time: tmpl.start_time.slice(0, 5),
      duration_min: String(tmpl.duration_min),
      max_capacity: tmpl.max_capacity != null ? String(tmpl.max_capacity) : '',
      recurrence: tmpl.recurrence,
      active: tmpl.active,
    })
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!studioId) return
    setSaving(true)
    setFormError(null)

    const payload = {
      name: form.name,
      description: form.description || undefined,
      day_of_week: parseInt(form.day_of_week),
      start_time: form.start_time,
      duration_min: parseInt(form.duration_min),
      max_capacity: form.max_capacity ? parseInt(form.max_capacity) : undefined,
      recurrence: form.recurrence,
      active: form.active,
    }

    try {
      if (editingId) {
        const updated = await scheduleApi.updateTemplate(studioId, editingId, payload)
        setTemplates((prev) => prev.map((t) => t.id === editingId ? updated as ClassTemplate : t))
      } else {
        const created = await scheduleApi.createTemplate(studioId, payload)
        setTemplates((prev) => [...prev, created as ClassTemplate])
      }
      closeForm()
    } catch (err: unknown) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(templateId: string, name: string) {
    if (!studioId) return
    if (!window.confirm(`Delete template "${name}"? Existing class instances won't be affected.`)) return

    try {
      await scheduleApi.deleteTemplate(studioId, templateId)
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
    } catch (err: unknown) {
      window.alert(`Failed to delete: ${(err as Error).message}`)
    }
  }

  if (loadingStudio) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!studioId) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        You need to be part of a studio to view the schedule.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">Manage your studio&apos;s class schedule</p>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Weekly Schedule</TabsTrigger>
          <TabsTrigger value="templates">Class Templates</TabsTrigger>
        </TabsList>

        {/* ── Weekly Schedule ── */}
        <TabsContent value="schedule" className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date(weekStart)
                  d.setDate(d.getDate() - 7)
                  setWeekStart(d)
                }}
              >
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekStart(getWeekStart(new Date()))}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date(weekStart)
                  d.setDate(d.getDate() + 7)
                  setWeekStart(d)
                }}
              >
                Next →
              </Button>
            </div>
            <span className="text-sm text-muted-foreground">
              {weekDays[0]!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {weekDays[6]!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {scheduleError && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{scheduleError}</div>
          )}

          {loadingSchedule ? (
            <div className="py-12 text-center text-muted-foreground">Loading schedule...</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-1.5 min-w-[560px]">
                {weekDays.map((day) => {
                  const ds = toDateStr(day)
                  const dayInstances = instancesByDate[ds] ?? []
                  const isToday = ds === todayStr
                  return (
                    <div key={ds} className="flex flex-col gap-1">
                      {/* Day header */}
                      <div
                        className={`rounded-lg py-1.5 text-center text-xs font-semibold ${
                          isToday
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <div>{DAY_ABBR[day.getDay()]}</div>
                        <div className="font-normal">{day.getDate()}</div>
                      </div>

                      {/* Class instances */}
                      {dayInstances.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground text-center py-3">—</div>
                      ) : (
                        dayInstances.map((inst) => {
                          const isCancelled = inst.status === 'cancelled'
                          const fillPct = inst.max_capacity > 0
                            ? Math.round((inst.booking_count / inst.max_capacity) * 100)
                            : 0
                          return (
                            <div
                              key={inst.id}
                              className={`rounded-md border p-1.5 text-[11px] ${
                                isCancelled
                                  ? 'bg-gray-50 border-gray-200 text-gray-400'
                                  : 'bg-card border-border'
                              }`}
                            >
                              <div className={`font-medium truncate ${isCancelled ? 'line-through' : ''}`}>
                                {inst.template?.name ?? 'Class'}
                              </div>
                              <div className="text-muted-foreground">{formatTime(inst.start_time)}</div>
                              {inst.teacher && (
                                <div className="text-muted-foreground truncate">{inst.teacher.name}</div>
                              )}
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${fillPct > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                    style={{ width: `${Math.min(fillPct, 100)}%` }}
                                  />
                                </div>
                                <span className="shrink-0">
                                  {inst.booking_count}/{inst.max_capacity}
                                </span>
                              </div>
                              {isCancelled ? (
                                <span className="text-[10px] text-red-400">Cancelled</span>
                              ) : (
                                <button
                                  className="mt-1 text-[10px] text-red-500 hover:text-red-700 disabled:opacity-40"
                                  disabled={cancelling === inst.id}
                                  onClick={() => handleCancel(inst.id)}
                                >
                                  {cancelling === inst.id ? 'Cancelling…' : 'Cancel'}
                                </button>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Class Templates ── */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreate}>+ New Template</Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? 'Edit Template' : 'New Class Template'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Class Name *</label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Vinyasa Yoga"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Day of Week *</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.day_of_week}
                        onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                        required
                      >
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                          (d, i) => <option key={i} value={i}>{d}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Start Time *</label>
                      <Input
                        type="time"
                        value={form.start_time}
                        onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Duration (min) *</label>
                      <Input
                        type="number"
                        min={15}
                        value={form.duration_min}
                        onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Max Capacity</label>
                      <Input
                        type="number"
                        min={1}
                        value={form.max_capacity}
                        onChange={(e) => setForm({ ...form, max_capacity: e.target.value })}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Recurrence</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.recurrence}
                        onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="once">One-time</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="tpl-active"
                        checked={form.active}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="tpl-active" className="text-sm">
                        Active (auto-generates instances)
                      </label>
                    </div>
                  </div>

                  {formError && <p className="text-sm text-red-600">{formError}</p>}

                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving…' : editingId ? 'Update Template' : 'Create Template'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={closeForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {templates.length === 0 && !showForm ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No templates yet. Create a template to schedule recurring classes.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map((tmpl) => (
                <Card key={tmpl.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tmpl.name}</span>
                          {!tmpl.active && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {getDayName(tmpl.day_of_week)}s &middot; {formatTime(tmpl.start_time)} &middot; {tmpl.duration_min} min
                          {tmpl.max_capacity != null && ` · ${tmpl.max_capacity} capacity`}
                          {' · '}<span className="capitalize">{tmpl.recurrence}</span>
                        </div>
                        {tmpl.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => openEdit(tmpl)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(tmpl.id, tmpl.name)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
