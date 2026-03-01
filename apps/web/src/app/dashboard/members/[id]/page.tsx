'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { memberApi, achievementApi, skillApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getRoleBadgeColor } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface PrivacySettings {
  profile_visibility: string
  show_attendance: boolean
  show_email: boolean
  show_phone: boolean
  show_achievements: boolean
  feed_posts_visible: boolean
}

const PRIVACY_DEFAULTS: PrivacySettings = {
  profile_visibility: 'members',
  show_attendance: true,
  show_email: false,
  show_phone: false,
  show_achievements: true,
  feed_posts_visible: true,
}

interface MemberDetail {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: string
  status: string
  joined_at: string
  notes: string | null
  studio_id: string
}

interface CompGrant {
  id: string
  total_classes: number
  remaining_classes: number
  reason: string | null
  expires_at: string | null
  created_at: string
  granted_by_user: { name: string } | null
}

interface AttendanceEntry {
  id: string
  checked_in: boolean
  walk_in: boolean
  checked_in_at: string | null
  class_instance: {
    id: string
    date: string
    start_time: string
    template: { name: string } | null
  }
}

interface SubscriptionInfo {
  id: string
  status: string
  plan: { name: string; price_cents: number; interval: string } | null
  current_period_end: string | null
  created_at: string
}

interface Achievement {
  id: string
  title: string
  description: string | null
  category: string
  icon: string
  earned_at: string
}

interface MemberSkill {
  id: string
  name: string
  category: string
  description: string | null
  level: string | null
  notes: string | null
  verified_by: string | null
  verified_at: string | null
  verifier_name: string | null
}

const SKILL_LEVEL_COLORS: Record<string, string> = {
  learning: 'bg-gray-100 text-gray-700',
  practicing: 'bg-blue-100 text-blue-800',
  confident: 'bg-amber-100 text-amber-800',
  mastered: 'bg-green-100 text-green-800',
}

export default function MemberDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const memberId = params.id as string

  const supabase = useRef(createClient()).current

  const [member, setMember]       = useState<MemberDetail | null>(null)
  const [compGrants, setCompGrants] = useState<CompGrant[]>([])
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [isStaff, setIsStaff]     = useState(false)
  const [isSelf, setIsSelf]       = useState(false)
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(PRIVACY_DEFAULTS)

  // Grant comp classes form state
  const [showGrantForm, setShowGrantForm] = useState(false)
  const [grantClasses, setGrantClasses]   = useState('1')
  const [grantReason, setGrantReason]     = useState('')
  const [grantExpiry, setGrantExpiry]     = useState('')
  const [granting, setGranting]           = useState(false)
  const [grantError, setGrantError]       = useState<string | null>(null)
  const [grantSuccess, setGrantSuccess]   = useState<string | null>(null)

  // Notes editing state
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue]     = useState('')
  const [savingNotes, setSavingNotes]   = useState(false)
  const [notesError, setNotesError]     = useState<string | null>(null)

  // Member management state
  const [memberAction, setMemberAction] = useState<string | null>(null)
  const [memberActionError, setMemberActionError] = useState<string | null>(null)
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)

  // Skills state
  const [memberSkills, setMemberSkills] = useState<MemberSkill[]>([])
  const [skillsGrouped, setSkillsGrouped] = useState<Record<string, MemberSkill[]>>({})
  const [updatingSkill, setUpdatingSkill] = useState<string | null>(null)

  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [showAchievementForm, setShowAchievementForm] = useState(false)
  const [achTitle, setAchTitle] = useState('')
  const [achDescription, setAchDescription] = useState('')
  const [achCategory, setAchCategory] = useState('general')
  const [achIcon, setAchIcon] = useState('\u{1F3C6}')
  const [achShareToFeed, setAchShareToFeed] = useState(true)
  const [achSaving, setAchSaving] = useState(false)
  const [achError, setAchError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Get the current user's studio
      const { data: myMem } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!myMem) { setLoading(false); return }

      // Fetch member's membership record (filtered by studio_id)
      const { data: membership } = await supabase
        .from('memberships')
        .select('role, status, joined_at, notes, studio_id, user:users!memberships_user_id_fkey(id, name, email, avatar_url)')
        .eq('user_id', memberId)
        .eq('studio_id', myMem.studio_id)
        .single()

      if (!membership) { setLoading(false); return }

      const u = Array.isArray(membership.user) ? membership.user[0] : membership.user
      setMember({
        id:        memberId,
        name:      u?.name ?? 'Unknown',
        email:     u?.email ?? '',
        avatar_url: u?.avatar_url ?? null,
        role:      membership.role,
        status:    membership.status,
        joined_at: membership.joined_at,
        notes:     membership.notes,
        studio_id: membership.studio_id,
      })

      // Check if the viewing user is staff
      const { data: myRole } = await supabase
        .from('memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('studio_id', membership.studio_id)
        .single()

      const staffRoles = ['teacher', 'admin', 'owner']
      const viewerIsStaff = staffRoles.includes(myRole?.role ?? '')
      setIsStaff(viewerIsStaff)
      setIsSelf(user.id === memberId)

      // Fetch privacy settings for the target member
      if (!viewerIsStaff && user.id !== memberId) {
        const { data: targetUser } = await supabase
          .from('users')
          .select('privacy_settings')
          .eq('id', memberId)
          .single()
        if (targetUser?.privacy_settings) {
          setPrivacySettings({ ...PRIVACY_DEFAULTS, ...(targetUser.privacy_settings as Partial<PrivacySettings>) })
        }
      }

      // Fetch comp grants for this member
      const { data: grants } = await supabase
        .from('comp_classes')
        .select('id, total_classes, remaining_classes, reason, expires_at, created_at, granted_by_user:users!comp_classes_granted_by_fkey(name)')
        .eq('user_id', memberId)
        .eq('studio_id', membership.studio_id)
        .order('created_at', { ascending: false })

      setCompGrants((grants ?? []).map((g) => ({
        ...g,
        granted_by_user: g.granted_by_user as unknown as CompGrant['granted_by_user'],
      })))

      // Fetch attendance history
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select(`
          id, checked_in, walk_in, checked_in_at,
          class_instance:class_instances!attendance_class_instance_id_fkey(
            id, date, start_time,
            template:class_templates!class_instances_template_id_fkey(name)
          )
        `)
        .eq('user_id', memberId)
        .eq('checked_in', true)
        .order('checked_in_at', { ascending: false })
        .limit(50)

      setAttendance((attendanceData ?? []) as unknown as AttendanceEntry[])

      // Fetch subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select(`
          id, status, current_period_end, created_at,
          plan:membership_plans!subscriptions_plan_id_fkey(name, price_cents, interval)
        `)
        .eq('user_id', memberId)
        .eq('studio_id', membership.studio_id)
        .in('status', ['active', 'past_due', 'paused'])
        .limit(1)
        .maybeSingle()

      setSubscription(sub as unknown as SubscriptionInfo | null)

      // Fetch achievements
      try {
        const achResult = await achievementApi.memberAchievements(membership.studio_id, memberId)
        setAchievements(achResult.achievements ?? [])
      } catch {
        // achievements table may not exist yet
      }

      // Fetch member skills
      try {
        const skillResult = await skillApi.memberSkills(membership.studio_id, memberId)
        setMemberSkills(skillResult.skills as MemberSkill[] ?? [])
        // Group skills by category from the flat list
        const grouped: Record<string, MemberSkill[]> = {}
        for (const s of (skillResult.skills ?? []) as MemberSkill[]) {
          if (!grouped[s.category]) grouped[s.category] = []
          grouped[s.category].push(s)
        }
        setSkillsGrouped(grouped)
      } catch {
        // skills table may not exist yet
      }

      setLoading(false)
    }
    load()
  }, [memberId, supabase, router])

  async function handleGrantComp(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    setGranting(true)
    setGrantError(null)
    setGrantSuccess(null)

    try {
      const payload: Record<string, unknown> = {
        classes: parseInt(grantClasses, 10),
      }
      if (grantReason.trim()) payload.reason = grantReason.trim()
      if (grantExpiry) payload.expiresAt = new Date(grantExpiry).toISOString()

      const data = await memberApi.grantComp(member.studio_id, memberId, payload) as { comp: CompGrant & { granted_by_user: null } }
      setCompGrants((prev) => [{ ...data.comp, granted_by_user: null }, ...prev])
      setGrantSuccess(`Granted ${grantClasses} comp class${parseInt(grantClasses) !== 1 ? 'es' : ''} successfully.`)
      setGrantClasses('1')
      setGrantReason('')
      setGrantExpiry('')
      setShowGrantForm(false)
    } catch (err: unknown) {
      setGrantError((err as Error).message)
    } finally {
      setGranting(false)
    }
  }

  async function handleSuspend() {
    if (!member) return
    setMemberAction('suspending')
    setMemberActionError(null)
    try {
      await memberApi.suspend(member.studio_id, memberId)
      setMember((prev) => prev ? { ...prev, status: 'suspended' } : prev)
    } catch (err) {
      setMemberActionError((err as Error).message)
    } finally {
      setMemberAction(null)
    }
  }

  async function handleReactivate() {
    if (!member) return
    setMemberAction('reactivating')
    setMemberActionError(null)
    try {
      await memberApi.reactivate(member.studio_id, memberId)
      setMember((prev) => prev ? { ...prev, status: 'active' } : prev)
    } catch (err) {
      setMemberActionError((err as Error).message)
    } finally {
      setMemberAction(null)
    }
  }

  async function handleRemove() {
    if (!member) return
    setMemberAction('removing')
    setMemberActionError(null)
    try {
      await memberApi.remove(member.studio_id, memberId)
      setMember((prev) => prev ? { ...prev, status: 'cancelled' } : prev)
    } catch (err) {
      setMemberActionError((err as Error).message)
    } finally {
      setMemberAction(null)
    }
  }

  async function handleRevoke(compId: string) {
    if (!member) return
    try {
      await memberApi.revokeComp(member.studio_id, compId)
      setCompGrants((prev) =>
        prev.map((c) => c.id === compId ? { ...c, remaining_classes: 0 } : c),
      )
    } catch (err) {
      setGrantError(`Failed to revoke comp: ${(err as Error).message}`)
    }
  }

  async function handleSaveNotes() {
    if (!member) return
    setSavingNotes(true)
    setNotesError(null)
    try {
      await memberApi.addNote(member.studio_id, memberId, notesValue.trim())
      setMember((prev) => prev ? { ...prev, notes: notesValue.trim() || null } : prev)
      setEditingNotes(false)
    } catch (err) {
      setNotesError((err as Error).message)
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleCreateAchievement(e: React.FormEvent) {
    e.preventDefault()
    if (!member || !achTitle.trim()) return
    setAchSaving(true)
    setAchError(null)
    try {
      const result = await achievementApi.create(member.studio_id, {
        title: achTitle.trim(),
        description: achDescription.trim() || undefined,
        category: achCategory,
        icon: achIcon,
        share_to_feed: achShareToFeed,
        user_id: memberId,
      })
      setAchievements((prev) => [{
        id: result.achievement.id,
        title: result.achievement.title,
        description: result.achievement.description,
        category: result.achievement.category,
        icon: result.achievement.icon,
        earned_at: result.achievement.earned_at,
      }, ...prev])
      setAchTitle('')
      setAchDescription('')
      setAchCategory('general')
      setAchIcon('\u{1F3C6}')
      setAchShareToFeed(true)
      setShowAchievementForm(false)
    } catch (err) {
      setAchError((err as Error).message)
    } finally {
      setAchSaving(false)
    }
  }

  async function handleDeleteAchievement(achievementId: string) {
    if (!member) return
    try {
      await achievementApi.remove(member.studio_id, achievementId)
      setAchievements((prev) => prev.filter((a) => a.id !== achievementId))
    } catch (err) {
      setAchError((err as Error).message)
    }
  }

  async function handleUpdateSkillLevel(skillId: string, level: string) {
    if (!member) return
    setUpdatingSkill(skillId)
    try {
      await skillApi.updateLevel(member.studio_id, memberId, skillId, { level })
      setMemberSkills((prev) =>
        prev.map((s) => s.id === skillId ? { ...s, level } : s)
      )
      setSkillsGrouped((prev) => {
        const updated = { ...prev }
        for (const cat of Object.keys(updated)) {
          updated[cat] = updated[cat].map((s) =>
            s.id === skillId ? { ...s, level } : s
          )
        }
        return updated
      })
    } catch {
      // silently fail
    } finally {
      setUpdatingSkill(null)
    }
  }

  async function handleVerifySkill(skillId: string, currentLevel: string) {
    if (!member) return
    setUpdatingSkill(skillId)
    try {
      const result = await skillApi.updateLevel(member.studio_id, memberId, skillId, { level: currentLevel, verify: true })
      const updated = result.skill
      setMemberSkills((prev) =>
        prev.map((s) => s.id === skillId ? { ...s, verified_by: updated.verified_by, verified_at: updated.verified_at } : s)
      )
      setSkillsGrouped((prev) => {
        const updatedGrouped = { ...prev }
        for (const cat of Object.keys(updatedGrouped)) {
          updatedGrouped[cat] = updatedGrouped[cat].map((s) =>
            s.id === skillId ? { ...s, verified_by: updated.verified_by, verified_at: updated.verified_at } : s
          )
        }
        return updatedGrouped
      })
    } catch {
      // silently fail
    } finally {
      setUpdatingSkill(null)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center" aria-busy="true" role="status">Loading member...</div>
  }

  if (!member) {
    return (
      <div className="text-muted-foreground py-20 text-center">
        Member not found.{' '}
        <Link href="/dashboard/members" className="underline">Back to members</Link>
      </div>
    )
  }

  const now = new Date()
  const activeGrants = compGrants.filter(
    (c) => c.remaining_classes > 0 && (!c.expires_at || new Date(c.expires_at) > now),
  )
  const inactiveGrants = compGrants.filter(
    (c) => c.remaining_classes === 0 || (c.expires_at && new Date(c.expires_at) <= now),
  )

  // Attendance stats
  const totalClasses = attendance.length
  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  const classesThisMonth = attendance.filter(
    (a) => a.class_instance?.date && new Date(a.class_instance.date + 'T00:00:00') >= thisMonth,
  ).length

  // Calculate weekly streak: how many consecutive weeks (counting back from now) had at least one class
  const weekStreak = (() => {
    if (attendance.length === 0) return 0
    const weeks = new Set<string>()
    for (const a of attendance) {
      if (a.class_instance?.date) {
        const d = new Date(a.class_instance.date + 'T00:00:00')
        const weekStart = new Date(d)
        weekStart.setDate(d.getDate() - d.getDay())
        weeks.add(weekStart.toISOString().split('T')[0])
      }
    }
    // Count consecutive weeks from most recent
    const currentWeekStart = new Date()
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay())
    currentWeekStart.setHours(0, 0, 0, 0)
    let streak = 0
    const check = new Date(currentWeekStart)
    while (weeks.has(check.toISOString().split('T')[0])) {
      streak++
      check.setDate(check.getDate() - 7)
    }
    return streak
  })()

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/dashboard/members" className="text-sm text-muted-foreground hover:text-foreground inline-block">
        &larr; Back to members
      </Link>

      {/* Member header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={member.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg">
                {member.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              {(isStaff || isSelf || privacySettings.show_email) && member.email && (
                <p className="text-muted-foreground">{member.email}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${getRoleBadgeColor(member.role)}`}>
                  {member.role}
                </span>
                <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                  {member.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Joined {new Date(member.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              {!editingNotes && member.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">{member.notes}</p>
              )}
            </div>
          </div>

          {/* Notes editing for staff */}
          {isStaff && (
            <div className="mt-4 border-t pt-4">
              {editingNotes ? (
                <div className="space-y-2">
                  <label htmlFor="member-notes" className="text-sm font-medium">Staff Notes</label>
                  <textarea
                    id="member-notes"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    rows={3}
                    placeholder="Injuries, experience level, preferences..."
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    maxLength={1000}
                  />
                  {notesError && <p role="alert" className="text-xs text-red-600">{notesError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                      {savingNotes ? 'Saving...' : 'Save Notes'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)} disabled={savingNotes}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => { setNotesValue(member.notes ?? ''); setEditingNotes(true); setNotesError(null) }}
                >
                  {member.notes ? 'Edit Notes' : '+ Add Notes'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Actions */}
      {isStaff && member.role !== 'owner' && (
        <Card>
          <CardHeader>
            <CardTitle>Member Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberActionError && (
              <p role="alert" className="text-sm text-red-600">{memberActionError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {member.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-300 hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setShowSuspendDialog(true)}
                  disabled={memberAction !== null}
                  aria-label={`Suspend ${member.name}`}
                >
                  {memberAction === 'suspending' ? 'Suspending...' : 'Suspend Member'}
                </Button>
              )}
              {(member.status === 'suspended' || member.status === 'cancelled') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-800 border-emerald-400 hover:bg-emerald-100 font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={handleReactivate}
                  disabled={memberAction !== null}
                  aria-label={`Reactivate ${member.name}`}
                >
                  {memberAction === 'reactivating' ? 'Reactivating...' : 'Reactivate Member'}
                </Button>
              )}
              {member.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => setShowRemoveDialog(true)}
                  disabled={memberAction !== null}
                  aria-label={`Remove ${member.name}`}
                >
                  {memberAction === 'removing' ? 'Removing...' : 'Remove Member'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{subscription.plan?.name ?? 'Plan'}</div>
                <div className="text-sm text-muted-foreground">
                  NZ${((subscription.plan?.price_cents ?? 0) / 100).toFixed(2)} / {subscription.plan?.interval ?? 'month'}
                </div>
              </div>
              <div className="text-right">
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                  {subscription.status}
                </Badge>
                {subscription.current_period_end && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Renews {new Date(subscription.current_period_end).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Stats */}
      {!isStaff && !isSelf && !privacySettings.show_attendance ? (
        <Card>
          <CardHeader><CardTitle>Attendance</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This member has hidden their attendance history.</p>
          </CardContent>
        </Card>
      ) : totalClasses > 0 ? (
        <Card>
          <CardHeader><CardTitle>Attendance Stats</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{totalClasses}</div>
                <div className="text-xs text-muted-foreground">Total Classes</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{classesThisMonth}</div>
                <div className="text-xs text-muted-foreground">This Month</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{weekStreak}</div>
                <div className="text-xs text-muted-foreground">Week Streak</div>
              </div>
            </div>
            {weekStreak >= 4 && (
              <p className="text-sm text-center mt-3 text-green-700 font-medium">
                {weekStreak} week streak! Keep it up!
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Attendance History */}
      {(isStaff || isSelf || privacySettings.show_attendance) && attendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance History ({attendance.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="pb-2 font-medium">Date</th>
                    <th scope="col" className="pb-2 font-medium">Class</th>
                    <th scope="col" className="pb-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">
                        {a.class_instance?.date
                          ? new Date(a.class_instance.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Unknown'}
                      </td>
                      <td className="py-2">
                        {a.class_instance?.template?.name ?? 'Class'}
                      </td>
                      <td className="py-2">
                        {a.walk_in ? (
                          <Badge variant="outline" className="text-xs">Walk-in</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Booked</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills Progress */}
      {memberSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skills Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(skillsGrouped).map(([category, skills]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{category}</h3>
                <div className="space-y-2">
                  {skills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{skill.name}</span>
                        {skill.verified_at && (
                          <span className="text-xs text-green-600 flex-shrink-0" title={`Verified by ${skill.verifier_name}`}>
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(isStaff || isSelf) ? (
                          <select
                            className="text-xs border rounded px-2 py-1 bg-background"
                            value={skill.level ?? ''}
                            onChange={(e) => handleUpdateSkillLevel(skill.id, e.target.value || 'learning')}
                            disabled={updatingSkill === skill.id}
                            aria-label={`Skill level for ${skill.name}`}
                          >
                            <option value="">Not started</option>
                            <option value="learning">Learning</option>
                            <option value="practicing">Practicing</option>
                            <option value="confident">Confident</option>
                            <option value="mastered">Mastered</option>
                          </select>
                        ) : (
                          skill.level && (
                            <Badge className={`text-xs ${SKILL_LEVEL_COLORS[skill.level] ?? 'bg-gray-100 text-gray-700'}`}>
                              {skill.level}
                            </Badge>
                          )
                        )}
                        {isStaff && skill.level && !skill.verified_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => handleVerifySkill(skill.id, skill.level!)}
                            disabled={updatingSkill === skill.id}
                          >
                            Verify
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      {(isStaff || isSelf || (privacySettings.show_achievements && achievements.length > 0)) && (
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Achievements</CardTitle>
              {(isStaff || isSelf) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowAchievementForm((v) => !v); setAchError(null) }}
                >
                  {showAchievementForm ? 'Cancel' : 'Add Achievement'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAchievementForm && (
              <form onSubmit={handleCreateAchievement} className="border border-amber-200 rounded-lg p-4 space-y-3 bg-amber-50/50">
                <div>
                  <label htmlFor="ach-title" className="text-xs text-muted-foreground mb-1 block">Title *</label>
                  <Input
                    id="ach-title"
                    type="text"
                    placeholder="e.g. First Invert"
                    value={achTitle}
                    onChange={(e) => setAchTitle(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>
                <div>
                  <label htmlFor="ach-desc" className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                  <Input
                    id="ach-desc"
                    type="text"
                    placeholder="e.g. Nailed it in Thursday's class!"
                    value={achDescription}
                    onChange={(e) => setAchDescription(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ach-category" className="text-xs text-muted-foreground mb-1 block">Category</label>
                    <select
                      id="ach-category"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={achCategory}
                      onChange={(e) => setAchCategory(e.target.value)}
                    >
                      <option value="skill">Skill</option>
                      <option value="milestone">Milestone</option>
                      <option value="personal">Personal</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Icon</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['\u{1F3C6}', '\u{1F525}', '\u{1F4AA}', '\u{1F938}', '\u{2B50}', '\u{26A1}', '\u{1F389}', '\u{1F31F}'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAchIcon(emoji)}
                          className={`w-8 h-8 rounded-md text-lg flex items-center justify-center cursor-pointer ${achIcon === emoji ? 'ring-2 ring-amber-500 bg-amber-100' : 'bg-secondary hover:bg-secondary/80'}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={achShareToFeed}
                    onChange={(e) => setAchShareToFeed(e.target.checked)}
                    className="rounded"
                  />
                  Share to community feed
                </label>
                {achError && <p role="alert" className="text-xs text-red-600">{achError}</p>}
                <Button type="submit" size="sm" disabled={achSaving || !achTitle.trim()}>
                  {achSaving ? 'Saving...' : 'Add Achievement'}
                </Button>
              </form>
            )}

            {achievements.length === 0 && !showAchievementForm && (
              <p className="text-sm text-muted-foreground">No achievements yet.</p>
            )}

            {achievements.map((ach) => (
              <div key={ach.id} className="flex items-center justify-between p-3 border border-amber-200 rounded-lg bg-amber-50/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ach.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{ach.title}</div>
                    {ach.description && (
                      <div className="text-xs text-muted-foreground">{ach.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs mr-1">{ach.category}</Badge>
                      {new Date(ach.earned_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {(isStaff || isSelf) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteAchievement(ach.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Comp Classes */}
      {isStaff && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Comp Classes</CardTitle>
              <Button
                size="sm"
                onClick={() => { setShowGrantForm((v) => !v); setGrantError(null); setGrantSuccess(null) }}
              >
                {showGrantForm ? 'Cancel' : 'Grant Comp Classes'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Grant form */}
            {showGrantForm && (
              <form onSubmit={handleGrantComp} className="border rounded-lg p-4 space-y-3 bg-secondary/30">
                <h3 className="font-medium text-sm">Grant Comp Classes</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="grant-classes" className="text-xs text-muted-foreground mb-1 block">Classes *</label>
                    <Input
                      id="grant-classes"
                      type="number"
                      min={1}
                      max={50}
                      value={grantClasses}
                      onChange={(e) => setGrantClasses(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="grant-expiry" className="text-xs text-muted-foreground mb-1 block">Expires (optional)</label>
                    <Input
                      id="grant-expiry"
                      type="date"
                      value={grantExpiry}
                      onChange={(e) => setGrantExpiry(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="grant-reason" className="text-xs text-muted-foreground mb-1 block">Reason (optional)</label>
                  <Input
                    id="grant-reason"
                    type="text"
                    placeholder="e.g. Missed classes due to illness"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    maxLength={500}
                  />
                </div>
                {grantError && <p role="alert" className="text-xs text-red-600">{grantError}</p>}
                <Button type="submit" size="sm" disabled={granting}>
                  {granting ? 'Granting...' : `Grant ${grantClasses} Class${parseInt(grantClasses) !== 1 ? 'es' : ''}`}
                </Button>
              </form>
            )}

            {grantSuccess && (
              <p role="status" aria-live="polite" className="text-sm text-green-600 font-medium">{grantSuccess}</p>
            )}

            {/* Active grants */}
            {activeGrants.length === 0 && !showGrantForm && (
              <p className="text-sm text-muted-foreground">No active comp classes.</p>
            )}
            {activeGrants.map((grant) => (
              <div key={grant.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium text-sm">
                    {grant.remaining_classes}/{grant.total_classes} classes remaining
                  </div>
                  {grant.reason && (
                    <div className="text-xs text-muted-foreground">{grant.reason}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Granted {new Date(grant.created_at).toLocaleDateString()}
                    {grant.expires_at && ` · Expires ${new Date(grant.expires_at).toLocaleDateString()}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setRevokeTarget(grant.id)}
                  aria-label={`Revoke comp grant of ${grant.total_classes} classes`}
                >
                  Revoke
                </Button>
              </div>
            ))}

            {/* Inactive grants (collapsed) */}
            {inactiveGrants.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {inactiveGrants.length} expired/used grant{inactiveGrants.length !== 1 ? 's' : ''}
                </summary>
                <div className="mt-2 space-y-2">
                  {inactiveGrants.map((grant) => (
                    <div key={grant.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                      <div>
                        <div className="font-medium text-sm line-through">
                          {grant.total_classes} classes
                        </div>
                        {grant.reason && (
                          <div className="text-xs text-muted-foreground">{grant.reason}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Granted {new Date(grant.created_at).toLocaleDateString()}
                          {grant.expires_at && ` · Expired ${new Date(grant.expires_at).toLocaleDateString()}`}
                        </div>
                      </div>
                      <Badge variant="outline">Used/Expired</Badge>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={showSuspendDialog}
        onOpenChange={setShowSuspendDialog}
        title="Suspend member"
        description="Suspend this member? They will not be able to book classes until reactivated."
        confirmLabel="Suspend"
        variant="danger"
        onConfirm={handleSuspend}
      />

      <ConfirmDialog
        open={showRemoveDialog}
        onOpenChange={setShowRemoveDialog}
        title="Remove member"
        description="Remove this member from the studio? This action sets their membership to cancelled."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleRemove}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null) }}
        title="Revoke comp grant"
        description="Revoke this comp grant? The member will lose any remaining classes."
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={() => { if (revokeTarget) return handleRevoke(revokeTarget) }}
      />
    </div>
  )
}
