'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { api, scheduleApi, subRequestApi } from '@/lib/api-client'
import { useStudioId } from '@/hooks/use-studio-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTime, formatDate } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface ClassInstance {
  id: string
  date: string
  start_time: string
  end_time: string
  max_capacity: number
  booked_count: number
  status: string
  teacher_id?: string
  template: { name: string } | null
  teacher: { id?: string; name: string } | null
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

interface SubRequest {
  id: string
  status: string
  reason: string | null
  created_at: string
  accepted_at: string | null
  requesting_teacher: { id: string; name: string; avatar_url: string | null } | null
  substitute_teacher: { id: string; name: string; avatar_url: string | null } | null
  class_info: { id: string; name: string; date: string; start_time: string; end_time: string } | null
}

export default function SchedulePage() {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const { studioId, loading: studioLoading } = useStudioId()
  const [classesByDate, setClassesByDate] = useState<Record<string, ClassInstance[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddClass, setShowAddClass] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)

  // Add class form
  const [templates, setTemplates] = useState<ClassTemplate[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [newClass, setNewClass] = useState({
    template_id: '', teacher_id: '', date: '', start_time: '', end_time: '', max_capacity: '',
  })
  const [creating, setCreating] = useState(false)
  const [subRequests, setSubRequests] = useState<SubRequest[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)
  const [subRequestClassId, setSubRequestClassId] = useState<string | null>(null)
  const [subReason, setSubReason] = useState('')
  const [submittingSub, setSubmittingSub] = useState(false)

  useEffect(() => {
    if (studioLoading) return
    if (!studioId) { setLoading(false); return }

    const sid = studioId

    async function load() {
      const supabase = createClient()

      try {
        // Get current user and check if they're a teacher
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          const { data: membership } = await supabase
            .from('memberships')
            .select('role')
            .eq('studio_id', sid)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single()
          if (membership && ['teacher', 'admin', 'owner'].includes(membership.role)) {
            setIsTeacher(true)
          }
        }

        // Load sub requests
        try {
          const subs = await subRequestApi.list(sid, 'all') as SubRequest[]
          setSubRequests(subs)
        } catch {
          // Sub requests may not be available yet
        }

        const todayStr = new Date().toISOString().split('T')[0]
        const { data: classes } = await supabase
          .from('class_instances')
          .select('id, date, start_time, end_time, max_capacity, booked_count, status, teacher_id, template:class_templates(name), teacher:users!class_instances_teacher_id_fkey(id, name)')
          .eq('studio_id', sid)
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
          .eq('studio_id', sid)
          .order('name')

        setTemplates((tpls ?? []) as ClassTemplate[])

        // Teachers are members with role 'teacher', 'admin', or 'owner'
        const { data: staffMembers } = await supabase
          .from('memberships')
          .select('user:users(id, name)')
          .eq('studio_id', sid)
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
  }, [studioId, studioLoading])

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
        .select('id, date, start_time, end_time, max_capacity, booked_count, status, teacher_id, template:class_templates(name), teacher:users!class_instances_teacher_id_fkey(id, name)')
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
      setActionError(`Failed to create class: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
    setCreating(false)
  }

  async function handleRestoreClass(classId: string) {
    if (!studioId) return
    try {
      await scheduleApi.restoreClass(studioId, classId)
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
      setActionError(`Failed to restore class: ${(err as Error).message}`)
    }
  }

  async function handleRequestSub() {
    if (!studioId || !subRequestClassId) return
    setSubmittingSub(true)
    try {
      await subRequestApi.create(studioId, {
        class_instance_id: subRequestClassId,
        reason: subReason || undefined,
      })
      const subs = await subRequestApi.list(studioId, 'all') as SubRequest[]
      setSubRequests(subs)
      setSubRequestClassId(null)
      setSubReason('')
    } catch (e) {
      setActionError(`Failed to request sub: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
    setSubmittingSub(false)
  }

  async function handleAcceptSub(requestId: string) {
    if (!studioId) return
    try {
      await subRequestApi.accept(studioId, requestId)
      const subs = await subRequestApi.list(studioId, 'all') as SubRequest[]
      setSubRequests(subs)
    } catch (e) {
      setActionError(`Failed to accept sub: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  async function handleCancelSub(requestId: string) {
    if (!studioId) return
    try {
      await subRequestApi.cancel(studioId, requestId)
      const subs = await subRequestApi.list(studioId, 'all') as SubRequest[]
      setSubRequests(subs)
    } catch (e) {
      setActionError(`Failed to cancel sub: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  // Build a set of class IDs that have open sub requests
  const classesWithSubRequests = new Set(
    subRequests.filter(s => s.status === 'open').map(s => s.class_info?.id).filter(Boolean)
  )

  const openSubRequests = subRequests.filter(s => s.status === 'open')

  if (loading) {
    return <div className="flex items-center justify-center py-20" aria-busy="true"><div className="text-muted-foreground" role="status">{t('loadingSchedule')}</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setShowAddClass(!showAddClass)}>
          {showAddClass ? tc('cancel') : `+ ${t('addClassButton')}`}
        </Button>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {showAddClass && (
        <Card>
          <CardHeader><CardTitle>{t('addOneOffClass')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="class-template" className="text-sm font-medium">{t('classTemplate')}</label>
                <select id="class-template" className="w-full border rounded-md px-3 py-2 text-sm" value={newClass.template_id}
                  onChange={e => handleTemplateChange(e.target.value)}>
                  <option value="">{t('selectTemplate')}</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="class-teacher" className="text-sm font-medium">{t('teacher')}</label>
                <select id="class-teacher" className="w-full border rounded-md px-3 py-2 text-sm" value={newClass.teacher_id}
                  onChange={e => setNewClass({...newClass, teacher_id: e.target.value})}>
                  <option value="">{t('selectTeacher')}</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label htmlFor="class-date" className="text-sm font-medium">{t('date')}</label>
                <Input id="class-date" type="date" value={newClass.date} onChange={e => setNewClass({...newClass, date: e.target.value})} />
              </div>
              <div>
                <label htmlFor="class-start" className="text-sm font-medium">{t('startTime')}</label>
                <Input id="class-start" type="time" value={newClass.start_time} onChange={e => setNewClass({...newClass, start_time: e.target.value})} />
              </div>
              <div>
                <label htmlFor="class-end" className="text-sm font-medium">{t('endTime')}</label>
                <Input id="class-end" type="time" value={newClass.end_time} onChange={e => setNewClass({...newClass, end_time: e.target.value})} />
              </div>
              <div>
                <label htmlFor="class-capacity" className="text-sm font-medium">{t('capacity')}</label>
                <Input id="class-capacity" type="number" value={newClass.max_capacity} onChange={e => setNewClass({...newClass, max_capacity: e.target.value})} placeholder="12" />
              </div>
            </div>
            <Button onClick={handleAddClass} disabled={creating || !newClass.date || !newClass.start_time}>
              {creating ? tc('creating') : t('createClass')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sub Requests Section */}
      {openSubRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sub Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openSubRequests.map((sub) => (
              <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="font-medium text-sm">{sub.class_info?.name ?? 'Unknown class'}</div>
                  <div className="text-xs text-muted-foreground">
                    {sub.class_info ? `${formatDate(sub.class_info.date)} ${formatTime(sub.class_info.start_time)} - ${formatTime(sub.class_info.end_time)}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Requested by {sub.requesting_teacher?.name ?? 'Unknown'}
                    {sub.reason && ` - ${sub.reason}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {isTeacher && currentUserId !== sub.requesting_teacher?.id && (
                    <Button size="sm" onClick={() => handleAcceptSub(sub.id)}>
                      Accept Sub
                    </Button>
                  )}
                  {(currentUserId === sub.requesting_teacher?.id) && (
                    <Button size="sm" variant="outline" onClick={() => handleCancelSub(sub.id)}>
                      Cancel Request
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Request Sub Dialog */}
      {subRequestClassId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Request Substitute</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="sub-reason" className="text-sm font-medium">Reason (optional)</label>
              <Input
                id="sub-reason"
                value={subReason}
                onChange={(e) => setSubReason(e.target.value)}
                placeholder="e.g., Doctor appointment"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRequestSub} disabled={submittingSub}>
                {submittingSub ? 'Requesting...' : 'Request Sub'}
              </Button>
              <Button variant="outline" onClick={() => { setSubRequestClassId(null); setSubReason('') }}>
                {tc('cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(classesByDate).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('noUpcomingClasses')}
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
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{cls.template?.name ?? t('classFallback')}</span>
                                    {classesWithSubRequests.has(cls.id) && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Needs Sub</span>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">{t('withTeacher', { name: cls.teacher?.name ?? t('teacherTba') })}</div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-sm">
                                  <span className="font-medium">{cls.booked_count ?? 0}</span>
                                  <span className="text-muted-foreground">/{cls.max_capacity}</span>
                                </div>
                                <div className="w-20 h-1.5 bg-secondary rounded-full mt-1" role="progressbar" aria-valuenow={cls.booked_count ?? 0} aria-valuemin={0} aria-valuemax={cls.max_capacity} aria-label={`${cls.booked_count ?? 0} of ${cls.max_capacity} spots booked`}>
                                  <div
                                    className={`h-full rounded-full ${fillPercent > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                    style={{ width: `${Math.min(fillPercent, 100)}%` }}
                                  />
                                </div>
                              </div>
                              {cls.status === 'cancelled' ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-1 rounded-full whitespace-nowrap bg-red-700 text-white font-semibold">
                                    {t('cancelled')}
                                  </span>
                                  <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRestoreTarget(cls.id) }}
                                    className="text-xs px-2 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-600 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    aria-label={`${t('restore')} ${cls.template?.name ?? t('classFallback')}`}
                                  >
                                    {t('restore')}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap font-semibold ${
                                    spotsLeft <= 2
                                      ? 'bg-red-700 text-white'
                                      : spotsLeft <= 4
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-emerald-700 text-white'
                                  }`}>
                                    {spotsLeft === 0 ? t('full') : t('spotsLeft', { count: spotsLeft })}
                                  </span>
                                  {isTeacher && currentUserId === (cls.teacher_id ?? cls.teacher?.id) && !classesWithSubRequests.has(cls.id) && (
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSubRequestClassId(cls.id) }}
                                      className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 whitespace-nowrap"
                                    >
                                      Request Sub
                                    </button>
                                  )}
                                </div>
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

      {actionError && (
        <div role="alert" className="fixed bottom-4 right-4 z-50 text-sm px-4 py-3 rounded-md bg-red-50 text-red-700 shadow-lg">
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-2 font-bold">x</button>
        </div>
      )}

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => { if (!open) setRestoreTarget(null) }}
        title="Restore class"
        description="Restore this cancelled class? Previously booked members will be notified."
        confirmLabel="Restore"
        onConfirm={() => { if (restoreTarget) return handleRestoreClass(restoreTarget) }}
      />
    </div>
  )
}
