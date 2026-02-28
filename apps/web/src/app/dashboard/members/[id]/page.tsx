'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { memberApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getRoleBadgeColor } from '@/lib/utils'

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

  // Grant comp classes form state
  const [showGrantForm, setShowGrantForm] = useState(false)
  const [grantClasses, setGrantClasses]   = useState('1')
  const [grantReason, setGrantReason]     = useState('')
  const [grantExpiry, setGrantExpiry]     = useState('')
  const [granting, setGranting]           = useState(false)
  const [grantError, setGrantError]       = useState<string | null>(null)
  const [grantSuccess, setGrantSuccess]   = useState<string | null>(null)

  // Member management state
  const [memberAction, setMemberAction] = useState<string | null>(null)
  const [memberActionError, setMemberActionError] = useState<string | null>(null)

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
      setIsStaff(staffRoles.includes(myRole?.role ?? ''))

      // Fetch comp grants for this member
      const { data: grants } = await supabase
        .from('comp_classes')
        .select('id, total_classes, remaining_classes, reason, expires_at, created_at, granted_by_user:users!comp_classes_granted_by_fkey(name)')
        .eq('user_id', memberId)
        .eq('studio_id', membership.studio_id)
        .order('created_at', { ascending: false })

      setCompGrants(grants ?? [])

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
    if (!confirm('Suspend this member? They will not be able to book classes until reactivated.')) return
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
    if (!confirm('Remove this member from the studio? This action sets their membership to cancelled.')) return
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
    if (!confirm('Revoke this comp grant? The member will lose any remaining classes.')) return

    try {
      const { api } = await import('@/lib/api-client')
      await api.delete(`/studios/${member.studio_id}/comps/${compId}`)
      setCompGrants((prev) =>
        prev.map((c) => c.id === compId ? { ...c, remaining_classes: 0 } : c),
      )
    } catch {
      // Revoke failed
    }
  }

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading member...</div>
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
              <p className="text-muted-foreground">{member.email}</p>
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
              {member.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">{member.notes}</p>
              )}
            </div>
          </div>
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
              <p className="text-sm text-red-600">{memberActionError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {member.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 border-amber-300 hover:bg-amber-50"
                  onClick={handleSuspend}
                  disabled={memberAction !== null}
                >
                  {memberAction === 'suspending' ? 'Suspending...' : 'Suspend Member'}
                </Button>
              )}
              {(member.status === 'suspended' || member.status === 'cancelled') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={handleReactivate}
                  disabled={memberAction !== null}
                >
                  {memberAction === 'reactivating' ? 'Reactivating...' : 'Reactivate Member'}
                </Button>
              )}
              {member.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={handleRemove}
                  disabled={memberAction !== null}
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
                  ${((subscription.plan?.price_cents ?? 0) / 100).toFixed(2)} / {subscription.plan?.interval ?? 'month'}
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

      {/* Attendance History */}
      {attendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance History ({attendance.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Type</th>
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
                    <label className="text-xs text-muted-foreground mb-1 block">Classes *</label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={grantClasses}
                      onChange={(e) => setGrantClasses(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Expires (optional)</label>
                    <Input
                      type="date"
                      value={grantExpiry}
                      onChange={(e) => setGrantExpiry(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Reason (optional)</label>
                  <Input
                    type="text"
                    placeholder="e.g. Missed classes due to illness"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    maxLength={500}
                  />
                </div>
                {grantError && <p className="text-xs text-red-600">{grantError}</p>}
                <Button type="submit" size="sm" disabled={granting}>
                  {granting ? 'Granting...' : `Grant ${grantClasses} Class${parseInt(grantClasses) !== 1 ? 'es' : ''}`}
                </Button>
              </form>
            )}

            {grantSuccess && (
              <p className="text-sm text-green-600 font-medium">{grantSuccess}</p>
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
                  onClick={() => handleRevoke(grant.id)}
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
    </div>
  )
}
