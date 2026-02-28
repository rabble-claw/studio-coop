'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { getDemoMemberById, getDemoMemberBadges, demoBadges } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type CategoryFilter = 'all' | 'classes' | 'streaks' | 'community'

export default function DemoMemberBadgesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const member = getDemoMemberById(id)
  const earnedBadges = getDemoMemberBadges(id)
  const [filter, setFilter] = useState<CategoryFilter>('all')

  if (!member) {
    return (
      <div className="space-y-4">
        <Link href={`/demo/members/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to member
        </Link>
        <h1 className="text-2xl font-bold">Member not found</h1>
      </div>
    )
  }

  const earnedIds = new Set(earnedBadges.map((b) => b.badge.id))

  const allBadgesWithStatus = demoBadges.map((badge) => {
    const earned = earnedBadges.find((eb) => eb.badge.id === badge.id)
    return {
      ...badge,
      earned: !!earned,
      earnedAt: earned?.earnedAt ?? null,
    }
  })

  const filtered = filter === 'all'
    ? allBadgesWithStatus
    : allBadgesWithStatus.filter((b) => b.category === filter)

  const categories: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'classes', label: 'Classes' },
    { key: 'streaks', label: 'Streaks' },
    { key: 'community', label: 'Community' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/demo/members/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to {member.name}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{member.name}&apos;s Badges</h1>
        <p className="text-muted-foreground">
          {earnedBadges.length} of {demoBadges.length} earned
        </p>
      </div>

      <div className="flex gap-2">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === cat.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((badge) => (
          <Card
            key={badge.id}
            className={badge.earned ? '' : 'opacity-40'}
          >
            <CardContent className="py-6 text-center">
              <div className="text-4xl mb-2">{badge.icon}</div>
              <h3 className="font-semibold text-sm">{badge.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
              {badge.earned && badge.earnedAt && (
                <p className="text-xs text-primary mt-2">
                  Earned {new Date(badge.earnedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {!badge.earned && (
                <p className="text-xs text-muted-foreground mt-2">Locked</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
