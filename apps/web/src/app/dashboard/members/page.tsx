'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { inviteApi, memberApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getRoleBadgeColor } from '@/lib/utils'

interface Member {
  id: string
  name: string
  email: string
  role: string
  status: string
  joined: string
  avatar_url: string | null
}

export default function MembersPage() {
  const router = useRouter()
  const t = useTranslations('members')
  const tc = useTranslations('common')
  const [studioId, setStudioId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ email: '', name: '', role: 'member' })
  const [inviting, setInviting] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')

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

      const { data: studioMembers } = await supabase
        .from('memberships')
        .select('role, status, joined_at, user:users(id, name, email, avatar_url)')
        .eq('studio_id', membership.studio_id)
        .in('status', ['active', 'suspended'])
        .order('joined_at')

      const mapped: Member[] = (studioMembers ?? []).map((m) => {
        const u = m.user as unknown as Record<string, unknown> | null
        return {
          id: (u?.id as string) ?? '',
          name: (u?.name as string) ?? 'Unknown',
          email: (u?.email as string) ?? '',
          role: m.role,
          status: m.status,
          joined: m.joined_at,
          avatar_url: (u?.avatar_url as string) ?? null,
        }
      })
      setMembers(mapped)
      setLoading(false)
    }
    load()
  }, [])

  async function handleInvite() {
    if (!studioId || !invite.email) return
    setInviting(true)
    setInviteMessage('')
    try {
      const result = await inviteApi.send(studioId, {
        email: invite.email,
        name: invite.name || undefined,
        role: invite.role,
      }) as { message: string }
      setInviteMessage(result.message ?? 'Invitation sent!')
      setInvite({ email: '', name: '', role: 'member' })
      setTimeout(() => {
        setShowInvite(false)
        setInviteMessage('')
      }, 3000)
    } catch (e) {
      setInviteMessage(`Error: ${e instanceof Error ? e.message : 'Failed to send invitation'}`)
    }
    setInviting(false)
  }

  async function handleSuspend(e: React.MouseEvent, memberId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!studioId) return
    if (!confirm('Suspend this member?')) return
    try {
      await memberApi.suspend(studioId, memberId)
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, status: 'suspended' } : m))
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    }
  }

  async function handleReactivate(e: React.MouseEvent, memberId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!studioId) return
    try {
      await memberApi.reactivate(studioId, memberId)
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, status: 'active' } : m))
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    }
  }

  async function handleRemove(e: React.MouseEvent, memberId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!studioId) return
    if (!confirm('Remove this member from the studio?')) return
    try {
      await memberApi.remove(studioId, memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch (err) {
      alert(`Failed: ${(err as Error).message}`)
    }
  }

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  )

  const roleOrder = { owner: 0, admin: 1, teacher: 2, member: 3 }
  const sorted = [...filtered].sort(
    (a, b) => (roleOrder[a.role as keyof typeof roleOrder] ?? 9) - (roleOrder[b.role as keyof typeof roleOrder] ?? 9)
  )

  if (loading) {
    return <div className="flex items-center justify-center py-20" aria-busy="true"><div className="text-muted-foreground" role="status">{t('loadingMembers')}</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('totalMembers', { count: members.length })}</p>
        </div>
        <Button onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? tc('cancel') : `+ ${t('inviteMember')}`}
        </Button>
      </div>

      {showInvite && (
        <Card>
          <CardHeader><CardTitle>{t('inviteNewMember')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="invite-email" className="text-sm font-medium">{t('emailLabel')}</label>
                <Input id="invite-email" type="email" value={invite.email}
                  onChange={e => setInvite({...invite, email: e.target.value})}
                  placeholder={t('emailPlaceholder')} />
              </div>
              <div>
                <label htmlFor="invite-name" className="text-sm font-medium">{t('nameLabel')}</label>
                <Input id="invite-name" value={invite.name}
                  onChange={e => setInvite({...invite, name: e.target.value})}
                  placeholder={t('namePlaceholder')} />
              </div>
              <div>
                <label htmlFor="invite-role" className="text-sm font-medium">{t('roleLabel')}</label>
                <select id="invite-role" className="w-full border rounded-md px-3 py-2 text-sm" value={invite.role}
                  onChange={e => setInvite({...invite, role: e.target.value})}>
                  <option value="member">{t('roleMember')}</option>
                  <option value="teacher">{t('roleTeacher')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                </select>
              </div>
            </div>
            {inviteMessage && (
              <div role={inviteMessage.startsWith('Error') ? 'alert' : 'status'} aria-live={inviteMessage.startsWith('Error') ? 'assertive' : 'polite'} className={`text-sm px-3 py-2 rounded-md ${inviteMessage.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {inviteMessage}
              </div>
            )}
            <Button onClick={handleInvite} disabled={inviting || !invite.email}>
              {inviting ? tc('sending') : t('sendInvitation')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div>
        <label htmlFor="member-search" className="sr-only">Search members</label>
        <input
          id="member-search"
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Search members by name or email"
        />
      </div>

      <div className="grid gap-2">
        {sorted.map((member) => (
          <Link key={member.id} href={`/dashboard/members/${member.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary" aria-hidden="true">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={`${member.name}'s avatar`} className="w-10 h-10 rounded-full object-cover" />
                      ) : member.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{member.name}</div>
                      <div className="text-sm text-muted-foreground truncate">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                    {member.status === 'suspended' && (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                        {t('suspended')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">
                      Joined {new Date(member.joined).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                    {member.role !== 'owner' && (
                      <div className="flex items-center gap-1">
                        {member.status === 'active' && (
                          <button
                            onClick={(e) => handleSuspend(e, member.id)}
                            className="text-xs px-2 py-1 rounded text-amber-600 hover:bg-amber-50 hidden sm:inline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label={`Suspend ${member.name}`}
                          >
                            {t('suspend')}
                          </button>
                        )}
                        {member.status === 'suspended' && (
                          <button
                            onClick={(e) => handleReactivate(e, member.id)}
                            className="text-xs px-2 py-1 rounded text-green-600 hover:bg-green-50 hidden sm:inline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label={`Reactivate ${member.name}`}
                          >
                            {t('reactivate')}
                          </button>
                        )}
                        <button
                          onClick={(e) => handleRemove(e, member.id)}
                          className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 hidden sm:inline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label={`Remove ${member.name}`}
                        >
                          {t('remove')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {search ? t('noMembersMatch') : t('noMembersYet')}
          </p>
        )}
      </div>
    </div>
  )
}
