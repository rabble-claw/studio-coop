'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getRoleBadgeColor } from '@/lib/utils'

interface Member {
  id: string
  role: string
  status: string
  notes: string | null
  tags: string[]
  joined_at: string
  user: {
    id: string
    name: string
    email: string
    avatar_url: string | null
  }
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
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

      const { data } = await supabase
        .from('memberships')
        .select('*, user:users!memberships_user_id_fkey(id, name, email, avatar_url)')
        .eq('studio_id', membership.studio_id)
        .eq('status', 'active')
        .order('role')
        .order('joined_at')

      setMembers(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const filtered = members.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.user.name.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q) ||
      m.role.includes(q) ||
      m.tags?.some((t) => t.toLowerCase().includes(q))
    )
  })

  const roleOrder = ['owner', 'admin', 'teacher', 'member']

  if (loading) {
    return <div className="text-muted-foreground py-20 text-center">Loading members...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-muted-foreground mt-1">{members.length} active members</p>
        </div>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Search by name, email, role, or tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No members found.</p>
        ) : (
          filtered
            .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role))
            .map((m) => (
              <Card key={m.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={m.user.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {m.user.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{m.user.name}</div>
                      <div className="text-sm text-muted-foreground">{m.user.email}</div>
                      {m.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5 italic">{m.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.tags?.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    <Badge className={getRoleBadgeColor(m.role)}>
                      {m.role}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>
    </div>
  )
}
