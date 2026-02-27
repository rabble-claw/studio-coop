'use client'

import Link from 'next/link'
import AdminShell from '@/components/admin-shell'

interface Studio {
  id: string
  name: string
  slug: string
  discipline: string
  tier: string
  members: number
  revenue_cents: number
  status: 'active' | 'pending' | 'suspended'
  created_at: string
}

const DEMO_STUDIOS: Studio[] = [
  { id: '1', name: 'Empire Aerial Arts', slug: 'empire-aerial', discipline: 'aerial', tier: 'growth', members: 47, revenue_cents: 461300, status: 'active', created_at: '2026-01-15' },
  { id: '2', name: 'Wellington Yoga Collective', slug: 'welly-yoga', discipline: 'yoga', tier: 'starter', members: 82, revenue_cents: 812600, status: 'active', created_at: '2026-01-22' },
  { id: '3', name: 'CrossFit Cuba St', slug: 'cf-cuba', discipline: 'crossfit', tier: 'growth', members: 124, revenue_cents: 1487200, status: 'active', created_at: '2026-02-01' },
  { id: '4', name: 'Dance Central', slug: 'dance-central', discipline: 'dance', tier: 'starter', members: 35, revenue_cents: 277200, status: 'active', created_at: '2026-02-10' },
  { id: '5', name: 'Barre & Beyond', slug: 'barre-beyond', discipline: 'barre', tier: 'growth', members: 58, revenue_cents: 574200, status: 'active', created_at: '2026-02-15' },
  { id: '6', name: 'Flow Pilates Studio', slug: 'flow-pilates', discipline: 'pilates', tier: 'starter', members: 0, revenue_cents: 0, status: 'pending', created_at: '2026-02-25' },
]

export default function StudiosPage() {
  return (
    <AdminShell>
      {/* Header with search */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Studios</h2>
          <p className="text-sm text-[var(--muted-foreground)]">{DEMO_STUDIOS.length} studios on the platform</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search studios..."
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <select className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
            <option value="">All Tiers</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="scale">Scale</option>
          </select>
          <select className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Studios table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-foreground)]">Studio</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-foreground)]">Tier</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-foreground)]">Members</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-foreground)]">Revenue</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-foreground)]">Status</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-foreground)]">Joined</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--muted-foreground)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_STUDIOS.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{s.slug}.studio.coop</p>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      s.tier === 'growth'
                        ? 'bg-violet-950 text-violet-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {s.tier}
                  </span>
                </td>
                <td className="px-6 py-4">{s.members}</td>
                <td className="px-6 py-4">${(s.revenue_cents / 100).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      s.status === 'active'
                        ? 'bg-emerald-950 text-emerald-400'
                        : s.status === 'pending'
                          ? 'bg-yellow-950 text-yellow-400'
                          : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[var(--muted-foreground)]">{s.created_at}</td>
                <td className="px-6 py-4">
                  <Link
                    href={`/studios/${s.id}`}
                    className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-zinc-700 transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
