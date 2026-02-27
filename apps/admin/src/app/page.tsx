'use client'

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

interface PlatformStats {
  totalStudios: number
  activeMembers: number
  totalBookings: number
  monthlyRevenue: number
  coopMembers: number
}

const DEMO_STATS: PlatformStats = {
  totalStudios: 12,
  activeMembers: 584,
  totalBookings: 3247,
  monthlyRevenue: 118800,
  coopMembers: 8,
}

const DEMO_STUDIOS: Studio[] = [
  { id: '1', name: 'Empire Aerial Arts', slug: 'empire-aerial', discipline: 'aerial', tier: 'growth', members: 47, revenue_cents: 461300, status: 'active', created_at: '2026-01-15' },
  { id: '2', name: 'Wellington Yoga Collective', slug: 'welly-yoga', discipline: 'yoga', tier: 'starter', members: 82, revenue_cents: 812600, status: 'active', created_at: '2026-01-22' },
  { id: '3', name: 'CrossFit Cuba St', slug: 'cf-cuba', discipline: 'crossfit', tier: 'growth', members: 124, revenue_cents: 1487200, status: 'active', created_at: '2026-02-01' },
  { id: '4', name: 'Dance Central', slug: 'dance-central', discipline: 'dance', tier: 'starter', members: 35, revenue_cents: 277200, status: 'active', created_at: '2026-02-10' },
  { id: '5', name: 'Barre & Beyond', slug: 'barre-beyond', discipline: 'barre', tier: 'growth', members: 58, revenue_cents: 574200, status: 'active', created_at: '2026-02-15' },
  { id: '6', name: 'Flow Pilates Studio', slug: 'flow-pilates', discipline: 'pilates', tier: 'starter', members: 0, revenue_cents: 0, status: 'pending', created_at: '2026-02-25' },
]

const ALERTS = [
  { id: 1, type: 'warning' as const, message: 'Flow Pilates Studio pending onboarding - no Stripe connected', time: '2 hours ago' },
  { id: 2, type: 'info' as const, message: 'CrossFit Cuba St approaching Growth tier member limit (124/150)', time: '5 hours ago' },
  { id: 3, type: 'success' as const, message: 'Monthly co-op dividend distribution completed ($2,376)', time: '1 day ago' },
]

const STAT_CARDS = [
  { label: 'Studios', value: DEMO_STATS.totalStudios.toString() },
  { label: 'Active Members', value: DEMO_STATS.activeMembers.toLocaleString() },
  { label: 'Bookings (30d)', value: DEMO_STATS.totalBookings.toLocaleString() },
  { label: 'MRR', value: `$${(DEMO_STATS.monthlyRevenue / 100).toLocaleString()}` },
  { label: 'Co-op Members', value: DEMO_STATS.coopMembers.toString() },
]

export default function OverviewPage() {
  return (
    <AdminShell>
      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {STAT_CARDS.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <p className="text-sm text-[var(--muted-foreground)]">{s.label}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Studios table */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">Recent Studios</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Studio</th>
              <th className="pb-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Discipline</th>
              <th className="pb-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Members</th>
              <th className="pb-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Status</th>
              <th className="pb-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Joined</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_STUDIOS.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{s.slug}.studio.coop</p>
                </td>
                <td className="py-3 capitalize">{s.discipline}</td>
                <td className="py-3">{s.members}</td>
                <td className="py-3">
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
                <td className="py-3 text-[var(--muted-foreground)]">{s.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* System Alerts */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">System Alerts</h3>
        <div className="flex flex-col gap-3">
          {ALERTS.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                alert.type === 'warning'
                  ? 'border-yellow-900/50 bg-yellow-950/30'
                  : alert.type === 'success'
                    ? 'border-emerald-900/50 bg-emerald-950/30'
                    : 'border-blue-900/50 bg-blue-950/30'
              }`}
            >
              <span className="mt-0.5 text-sm">
                {alert.type === 'warning' ? '\u{26A0}\u{FE0F}' : alert.type === 'success' ? '\u{2705}' : '\u{2139}\u{FE0F}'}
              </span>
              <div className="flex-1">
                <p className="text-sm">{alert.message}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{alert.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
