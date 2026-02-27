'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getRoleBadgeColor } from '@/lib/utils'

interface Member {
  id: string
  name: string
  email: string
  role: string
  joined: string
  avatar_url: string | null
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

      const { data: studioMembers } = await supabase
        .from('memberships')
        .select('role, created_at, user:users(id, name, email, avatar_url)')
        .eq('studio_id', membership.studio_id)
        .eq('status', 'active')
        .order('created_at')

      const mapped: Member[] = (studioMembers ?? []).map((m) => {
        const u = m.user as Record<string, unknown> | null
        return {
          id: (u?.id as string) ?? '',
          name: (u?.name as string) ?? 'Unknown',
          email: (u?.email as string) ?? '',
          role: m.role,
          joined: m.created_at,
          avatar_url: (u?.avatar_url as string) ?? null,
        }
      })
      setMembers(mapped)
      setLoading(false)
    }
    load()
  }, [])

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
    return <div className="flex items-center justify-center py-20"><div className="text-muted-foreground">Loading members...</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground">{members.length} total members</p>
        </div>
        <Button>+ Invite Member</Button>
      </div>

      <div>
        <input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid gap-2">
        {sorted.map((member) => (
          <Link key={member.id} href={`/dashboard/members/${member.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : member.name[0]}
                    </div>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(member.joined).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {search ? 'No members match your search.' : 'No members yet.'}
          </p>
        )}
      </div>
    </div>
  )
}
