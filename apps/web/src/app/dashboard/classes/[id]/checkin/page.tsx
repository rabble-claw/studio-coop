'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTime, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassInfo {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  max_capacity: number
  studio_id: string
  template: { name: string } | null
  teacher: { id: string; name: string } | null
}

interface RosterEntry {
  user: { id: string; name: string; avatar_url: string | null }
  booking: { id: string; status: string; spot: string | null } | null
  checkedIn: boolean
  walkIn: boolean
  notes: string | null
  dirty: boolean  // pending save
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckinPage() {
  const params = useParams()
  const classId = params.id as string
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [isStaff, setIsStaff] = useState(false)

  // Walk-in dialog state
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [walkInEmail, setWalkInEmail] = useState('')
  const [walkInSearching, setWalkInSearching] = useState(false)
  const [walkInError, setWalkInError] = useState('')

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadRoster = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cls } = await supabase
      .from('class_instances')
      .select(`
        id, date, start_time, end_time, status, max_capacity, studio_id,
        template:class_templates!class_instances_template_id_fkey(name),
        teacher:users!class_instances_teacher_id_fkey(id, name)
      `)
      .eq('id', classId)
      .single()

    if (!cls) { setLoading(false); return }
    setClassInfo({
      ...cls,
      template: cls.template as unknown as ClassInfo['template'],
      teacher: cls.teacher as unknown as ClassInfo['teacher'],
    })

    // Verify staff role
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('studio_id', cls.studio_id)
      .eq('user_id', user.id)
      .single()

    const staffRoles = ['teacher', 'admin', 'owner']
    if (!staffRoles.includes(membership?.role ?? '')) {
      setLoading(false)
      return
    }
    setIsStaff(true)

    // Parallel fetch: bookings + attendance + membership notes
    const [{ data: bookings }, { data: attendanceRecords }, { data: memberships }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, status, spot, user:users!bookings_user_id_fkey(id, name, avatar_url)')
        .eq('class_instance_id', classId)
        .in('status', ['booked', 'confirmed', 'waitlisted'])
        .order('booked_at'),
      supabase
        .from('attendance')
        .select('user_id, checked_in, walk_in')
        .eq('class_instance_id', classId),
      supabase
        .from('memberships')
        .select('user_id, notes')
        .eq('studio_id', cls.studio_id),
    ])

    const attMap = new Map(
      (attendanceRecords ?? []).map((a) => [a.user_id, a]),
    )
    const notesMap = new Map(
      (memberships ?? []).map((m) => [m.user_id, m.notes]),
    )

    const bookedEntries: RosterEntry[] = (bookings ?? []).map((b) => {
      const u = b.user as any
      const att = attMap.get(u.id)
      return {
        user: { id: u.id, name: u.name, avatar_url: u.avatar_url ?? null },
        booking: { id: b.id, status: b.status, spot: b.spot ?? null },
        checkedIn: att?.checked_in ?? false,
        walkIn: att?.walk_in ?? false,
        notes: notesMap.get(u.id) ?? null,
        dirty: false,
      }
    })

    // Append walk-ins who have no booking
    const bookedIds = new Set(bookedEntries.map((e) => e.user.id))
    const walkInAtt = (attendanceRecords ?? []).filter(
      (a) => a.walk_in && !bookedIds.has(a.user_id),
    )
    if (walkInAtt.length > 0) {
      const { data: walkInUsers } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', walkInAtt.map((a) => a.user_id))

      const userMap = new Map((walkInUsers ?? []).map((u) => [u.id, u]))
      for (const a of walkInAtt) {
        const u = userMap.get(a.user_id)
        if (u) {
          bookedEntries.push({
            user: { id: u.id, name: u.name, avatar_url: u.avatar_url ?? null },
            booking: null,
            checkedIn: true,
            walkIn: true,
            notes: null,
            dirty: false,
          })
        }
      }
    }

    setRoster(bookedEntries)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  useEffect(() => { loadRoster() }, [loadRoster])

  // ─── Toggle check-in (optimistic, mark dirty) ────────────────────────────

  function toggleCheckedIn(userId: string) {
    setRoster((prev) =>
      prev.map((entry) =>
        entry.user.id === userId
          ? { ...entry, checkedIn: !entry.checkedIn, dirty: true }
          : entry,
      ),
    )
  }

  // ─── Save all pending changes (batch) ───────────────────────────────────

  async function saveAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    const now = new Date().toISOString()

    const dirtyEntries = roster.filter((e) => e.dirty)
    for (const entry of dirtyEntries) {
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('class_instance_id', classId)
        .eq('user_id', entry.user.id)
        .single()

      const payload = {
        checked_in: entry.checkedIn,
        walk_in: entry.walkIn,
        checked_in_at: entry.checkedIn ? now : null,
        checked_in_by: entry.checkedIn ? user.id : null,
      }

      if (existing) {
        await supabase.from('attendance').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('attendance').insert({
          class_instance_id: classId,
          user_id: entry.user.id,
          ...payload,
        })
      }
    }

    // Transition to in_progress if first check-in
    if (classInfo?.status === 'scheduled' && dirtyEntries.some((e) => e.checkedIn)) {
      await supabase
        .from('class_instances')
        .update({ status: 'in_progress' })
        .eq('id', classId)
      setClassInfo((prev) => prev ? { ...prev, status: 'in_progress' } : prev)
    }

    setRoster((prev) => prev.map((e) => ({ ...e, dirty: false })))
    setSaving(false)
  }

  // ─── Walk-in by email ────────────────────────────────────────────────────

  async function handleWalkIn() {
    if (!walkInEmail.trim()) return
    setWalkInSearching(true)
    setWalkInError('')

    const { data: found } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('email', walkInEmail.trim().toLowerCase())
      .single()

    if (!found) {
      setWalkInError('No user found with that email. Ask them to sign up first.')
      setWalkInSearching(false)
      return
    }

    // Already in roster?
    if (roster.some((e) => e.user.id === found.id)) {
      // Just mark as checked in + walk-in
      setRoster((prev) =>
        prev.map((e) =>
          e.user.id === found.id
            ? { ...e, checkedIn: true, walkIn: true, dirty: true }
            : e,
        ),
      )
    } else {
      setRoster((prev) => [
        ...prev,
        {
          user: { id: found.id, name: found.name, avatar_url: found.avatar_url ?? null },
          booking: null,
          checkedIn: true,
          walkIn: true,
          notes: null,
          dirty: true,
        },
      ])
    }

    setShowWalkIn(false)
    setWalkInEmail('')
    setWalkInSearching(false)
  }

  // ─── Complete class ──────────────────────────────────────────────────────

  async function handleComplete() {
    if (!confirm('Mark this class as complete? Absent members will be marked as no-shows.')) return
    setCompleting(true)
    await saveAll()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Mark booked-but-not-checked-in as no_show
    const checkedInIds = new Set(roster.filter((e) => e.checkedIn).map((e) => e.user.id))
    const { data: activeBookings } = await supabase
      .from('bookings')
      .select('id, user_id')
      .eq('class_instance_id', classId)
      .in('status', ['booked', 'confirmed'])

    const noShows = (activeBookings ?? []).filter((b) => !checkedInIds.has(b.user_id))
    if (noShows.length > 0) {
      await supabase
        .from('bookings')
        .update({ status: 'no_show' })
        .in('id', noShows.map((b) => b.id))
    }

    // Complete the class and enable feed
    await supabase
      .from('class_instances')
      .update({ status: 'completed', feed_enabled: true })
      .eq('id', classId)

    setCompleting(false)
    router.push(`/dashboard/classes/${classId}`)
  }

  // ─── Derived state ───────────────────────────────────────────────────────

  const checkedInCount = roster.filter((e) => e.checkedIn).length
  const dirtyCount = roster.filter((e) => e.dirty).length

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading check-in...</div>
  }

  if (!classInfo) {
    return <div className="text-muted-foreground py-20 text-center">Class not found.</div>
  }

  if (!isStaff) {
    return <div className="text-muted-foreground py-20 text-center">Staff access required.</div>
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            href={`/dashboard/classes/${classId}`}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            &larr; Back to class
          </Link>
          <h1 className="text-2xl font-bold">
            Check-in — {classInfo.template?.name ?? 'Class'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {formatDate(classInfo.date)} &middot; {formatTime(classInfo.start_time)}
            {classInfo.teacher && ` with ${classInfo.teacher.name}`}
          </p>
        </div>

        {/* Counter badge */}
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">
            {checkedInCount}
            <span className="text-muted-foreground text-xl font-normal">
              /{classInfo.max_capacity}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">checked in</div>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex gap-2 mb-6">
        <Badge variant={classInfo.status === 'in_progress' ? 'default' : 'secondary'}>
          {classInfo.status.replace('_', ' ')}
        </Badge>
        {dirtyCount > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        {roster.map((entry) => (
          <MemberCard
            key={entry.user.id}
            entry={entry}
            onToggle={() => toggleCheckedIn(entry.user.id)}
          />
        ))}

        {roster.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No bookings yet. Use the walk-in button to add someone.
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={() => setShowWalkIn(true)}
        >
          + Add Walk-in
        </Button>

        <div className="flex gap-3">
          {dirtyCount > 0 && (
            <Button
              variant="outline"
              onClick={saveAll}
              disabled={saving}
            >
              {saving ? 'Saving...' : `Save (${dirtyCount})`}
            </Button>
          )}

          <Button
            variant="destructive"
            onClick={handleComplete}
            disabled={completing || classInfo.status === 'completed'}
          >
            {completing ? 'Completing...' : 'Complete Class'}
          </Button>
        </div>
      </div>

      {/* Walk-in dialog */}
      {showWalkIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Walk-in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Member email
                </label>
                <Input
                  type="email"
                  placeholder="member@example.com"
                  value={walkInEmail}
                  onChange={(e) => setWalkInEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleWalkIn()}
                  autoFocus
                />
                {walkInError && (
                  <p className="text-sm text-destructive mt-1">{walkInError}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => { setShowWalkIn(false); setWalkInEmail(''); setWalkInError('') }}
                >
                  Cancel
                </Button>
                <Button onClick={handleWalkIn} disabled={walkInSearching}>
                  {walkInSearching ? 'Searching...' : 'Add'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Member card component ────────────────────────────────────────────────────

function MemberCard({
  entry,
  onToggle,
}: {
  entry: RosterEntry
  onToggle: () => void
}) {
  const initials = entry.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <button
      onClick={onToggle}
      title={entry.notes ?? undefined}
      className={[
        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left w-full min-h-[44px]',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 touch-manipulation',
        entry.checkedIn
          ? 'border-green-500 bg-green-50 dark:bg-green-950'
          : 'border-border hover:border-primary/50 hover:bg-muted/40',
        entry.dirty ? 'ring-1 ring-amber-300' : '',
      ].join(' ')}
    >
      <div className="relative">
        <Avatar className="h-14 w-14">
          <AvatarImage src={entry.user.avatar_url ?? undefined} />
          <AvatarFallback className="text-sm font-semibold">{initials}</AvatarFallback>
        </Avatar>
        {entry.walkIn && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold rounded-full px-1 leading-4">
            WI
          </span>
        )}
        {entry.checkedIn && (
          <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
            ✓
          </span>
        )}
      </div>

      <div className="w-full text-center">
        <div className="text-sm font-medium leading-tight line-clamp-2">
          {entry.user.name}
        </div>
        {entry.booking?.spot && (
          <div className="text-xs text-muted-foreground mt-0.5">Spot {entry.booking.spot}</div>
        )}
        {entry.notes && (
          <div className="text-xs text-amber-600 mt-0.5 truncate" title={entry.notes}>
            ⚑ note
          </div>
        )}
        {entry.checkedIn && (
          <div className="text-xs text-green-600 font-medium mt-1">Present</div>
        )}
      </div>
    </button>
  )
}
