'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getRoleBadgeColor } from '@/lib/utils'

// ── Badges ────────────────────────────────────────────────────────────────────

interface EarnedBadge {
  emoji: string
  label: string
}

function computeMemberBadges(totalClasses: number, streakWeeks: number): EarnedBadge[] {
  const badges: EarnedBadge[] = []
  if (totalClasses >= 1) badges.push({ emoji: '⭐', label: 'First Class' })
  if (streakWeeks >= 1) badges.push({ emoji: '🔥', label: '7-Day Streak' })
  if (streakWeeks >= 4) badges.push({ emoji: '💪', label: '4-Week Streak' })
  if (totalClasses >= 10) badges.push({ emoji: '🎯', label: '10 Classes' })
  if (totalClasses >= 25) badges.push({ emoji: '🏅', label: '25 Classes' })
  if (totalClasses >= 50) badges.push({ emoji: '🥈', label: '50 Classes' })
  if (totalClasses >= 100) badges.push({ emoji: '💯', label: '100 Classes' })
  return badges
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

export default function MemberDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const memberId = params.id as string

  const supabase = useRef(createClient()).current

  const [member, setMember]       = useState<MemberDetail | null>(null)
  const [compGrants, setCompGrants] = useState<CompGrant[]>([])
  const [loading, setLoading]     = useState(true)
  const [isStaff, setIsStaff]     = useState(false)
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([])
  const [totalClasses, setTotalClasses] = useState(0)

  // Grant comp classes form state
  const [showGrantForm, setShowGrantForm] = useState(false)
  const [grantClasses, setGrantClasses]   = useState('1')
  const [grantReason, setGrantReason]     = useState('')
  const [grantExpiry, setGrantExpiry]     = useState('')
  const [granting, setGranting]           = useState(false)
  const [grantError, setGrantError]       = useState<string | null>(null)
  const [grantSuccess, setGrantSuccess]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Fetch member's membership record
      const { data: membership } = await supabase
        .from('memberships')
        .select('role, status, joined_at, notes, studio_id, user:users!memberships_user_id_fkey(id, name, email, avatar_url)')
        .eq('user_id', memberId)
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
      const { data: myMembership } = await supabase
        .from('memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('studio_id', membership.studio_id)
        .single()

      const staffRoles = ['teacher', 'admin', 'owner']
      setIsStaff(staffRoles.includes(myMembership?.role ?? ''))

      // Fetch comp grants for this member
      const { data: grants } = await supabase
        .from('comp_classes')
        .select('id, total_classes, remaining_classes, reason, expires_at, created_at, granted_by_user:users!comp_classes_granted_by_fkey(name)')
        .eq('user_id', memberId)
        .eq('studio_id', membership.studio_id)
        .order('created_at', { ascending: false })

      setCompGrants(grants ?? [])

      // ── Badge data: fetch total classes + streak ────────────────────────────
      // Get all class instance IDs for this studio
      const { data: studioClassIds } = await supabase
        .from('class_instances')
        .select('id')
        .eq('studio_id', membership.studio_id)

      const instanceIds = (studioClassIds ?? []).map((c) => c.id)
      if (instanceIds.length > 0) {
        const { count: classCount } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', memberId)
          .eq('checked_in', true)
          .in('class_instance_id', instanceIds)

        // Compute week streak from attendance dates
        const { data: attDates } = await supabase
          .from('attendance')
          .select('class_instance_id')
          .eq('user_id', memberId)
          .eq('checked_in', true)
          .in('class_instance_id', instanceIds)

        const attInstanceIds = (attDates ?? []).map((a) => a.class_instance_id)
        let streakWeeks = 0
        if (attInstanceIds.length > 0) {
          const { data: classDates } = await supabase
            .from('class_instances')
            .select('date')
            .in('id', attInstanceIds)

          const weekSet = new Set((classDates ?? []).map((c) => {
            const d = new Date(c.date + 'T00:00:00Z')
            const dow = d.getUTCDay()
            d.setUTCDate(d.getUTCDate() - dow)
            const yr = d.getUTCFullYear()
            const startOfYear = new Date(`${yr}-01-01T00:00:00Z`)
            const diff = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000)
            return `${yr}-W${String(Math.floor(diff / 7) + 1).padStart(2, '0')}`
          }))
          const today = new Date()
          for (let i = 0; i < 52; i++) {
            const d = new Date(today)
            d.setDate(d.getDate() - i * 7)
            const dow = d.getUTCDay()
            d.setUTCDate(d.getUTCDate() - dow)
            const yr = d.getUTCFullYear()
            const startOfYear = new Date(`${yr}-01-01T00:00:00Z`)
            const diff = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000)
            const key = `${yr}-W${String(Math.floor(diff / 7) + 1).padStart(2, '0')}`
            if (weekSet.has(key)) streakWeeks++
            else if (i > 0) break
          }
        }

        const tc = classCount ?? 0
        setTotalClasses(tc)
        setEarnedBadges(computeMemberBadges(tc, streakWeeks))
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
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const payload: Record<string, unknown> = {
        classes: parseInt(grantClasses, 10),
      }
      if (grantReason.trim()) payload.reason = grantReason.trim()
      if (grantExpiry) payload.expiresAt = new Date(grantExpiry).toISOString()

      const res = await fetch(
        `/api/studios/${member.studio_id}/members/${memberId}/comp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as { comp: CompGrant & { granted_by_user: null } }
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

  async function handleRevoke(compId: string) {
    if (!member) return
    if (!confirm('Revoke this comp grant? The member will lose any remaining classes.')) return

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    const res = await fetch(
      `/api/studios/${member.studio_id}/comps/${compId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    )

    if (res.ok) {
      setCompGrants((prev) =>
        prev.map((c) => c.id === compId ? { ...c, remaining_classes: 0 } : c),
      )
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

      {/* Stats & Badges */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Badges &amp; Stats</CardTitle>
            <Link
              href={`/dashboard/members/${memberId}/stats`}
              className="text-sm text-primary hover:underline"
            >
              View full stats →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">{totalClasses} classes attended</span>
            {earnedBadges.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {earnedBadges.map((b) => (
                  <span
                    key={b.label}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800"
                    title={b.label}
                  >
                    {b.emoji} {b.label}
                  </span>
                ))}
              </div>
            )}
            {earnedBadges.length === 0 && totalClasses === 0 && (
              <span className="text-sm text-muted-foreground italic">No classes yet</span>
            )}
          </div>
        </CardContent>
      </Card>

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
