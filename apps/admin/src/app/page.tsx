'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin-shell'
import { supabase } from '@/lib/supabase'

interface Studio {
  id: string
  name: string
  slug: string
  discipline: string
  tier: string
  member_count: number
  status: string
  created_at: string
}

interface PlatformStats {
  totalStudios: number
  activeMembers: number
  totalBookings: number
  monthlyRevenue: number
  coopMembers: number
}

interface Alert {
  id: number
  type: 'warning' | 'info' | 'success'
  message: string
  time: string
}

export default function OverviewPage() {
  const [stats, setStats] = useState<PlatformStats>({
    totalStudios: 0,
    activeMembers: 0,
    totalBookings: 0,
    monthlyRevenue: 0,
    coopMembers: 0,
  })
  const [studios, setStudios] = useState<Studio[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // Run all queries in parallel
        const [
          studiosCountRes,
          activeMembersRes,
          bookingsRes,
          paymentsRes,
          coopRes,
          recentStudiosRes,
        ] = await Promise.all([
          // Total studios
          supabase.from('studios').select('*', { count: 'exact', head: true }),
          // Active members
          supabase.from('memberships').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          // Bookings in last 30 days
          supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .gte('booked_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
          // MRR: sum of payments this month
          supabase
            .from('payments')
            .select('amount_cents')
            .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
          // Co-op members (studios with tier 'studio' or 'pro')
          supabase
            .from('studios')
            .select('*', { count: 'exact', head: true })
            .in('tier', ['studio', 'pro']),
          // Recent studios with member counts
          supabase
            .from('studios')
            .select('id, name, slug, discipline, tier, created_at')
            .order('created_at', { ascending: false })
            .limit(6),
        ])

        // Calculate MRR
        const mrr = paymentsRes.data?.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0) ?? 0

        setStats({
          totalStudios: studiosCountRes.count ?? 0,
          activeMembers: activeMembersRes.count ?? 0,
          totalBookings: bookingsRes.count ?? 0,
          monthlyRevenue: mrr,
          coopMembers: coopRes.count ?? 0,
        })

        // Fetch member counts for recent studios
        if (recentStudiosRes.data && recentStudiosRes.data.length > 0) {
          const studioIds = recentStudiosRes.data.map((s) => s.id)
          const { data: memberCounts } = await supabase
            .from('memberships')
            .select('studio_id')
            .in('studio_id', studioIds)
            .eq('status', 'active')

          const countMap: Record<string, number> = {}
          memberCounts?.forEach((m) => {
            countMap[m.studio_id] = (countMap[m.studio_id] ?? 0) + 1
          })

          setStudios(
            recentStudiosRes.data.map((s) => ({
              id: s.id,
              name: s.name,
              slug: s.slug,
              discipline: s.discipline,
              tier: s.tier,
              member_count: countMap[s.id] ?? 0,
              status: 'active', // studios table doesn't have a status column; derive from context
              created_at: s.created_at,
            }))
          )
        }

        // Generate alerts from real data
        const generatedAlerts: Alert[] = []
        let alertId = 1

        // Check for studios without Stripe
        const { data: pendingStripe } = await supabase
          .from('studios')
          .select('name')
          .is('stripe_account_id', null)
          .limit(3)

        pendingStripe?.forEach((s) => {
          generatedAlerts.push({
            id: alertId++,
            type: 'warning',
            message: `${s.name} pending onboarding - no Stripe connected`,
            time: 'Recently',
          })
        })

        // Add a general info alert with member count
        if ((activeMembersRes.count ?? 0) > 0) {
          generatedAlerts.push({
            id: alertId++,
            type: 'info',
            message: `${activeMembersRes.count} active members across ${studiosCountRes.count ?? 0} studios`,
            time: 'Current',
          })
        }

        // Add a success alert if there are payments this month
        if (mrr > 0) {
          generatedAlerts.push({
            id: alertId++,
            type: 'success',
            message: `$${(mrr / 100).toLocaleString()} in revenue this month`,
            time: 'This month',
          })
        }

        if (generatedAlerts.length === 0) {
          generatedAlerts.push({
            id: 1,
            type: 'info',
            message: 'No alerts at this time',
            time: 'Now',
          })
        }

        setAlerts(generatedAlerts)
      } catch (err) {
        console.error('Failed to load overview data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const statCards = [
    { label: 'Studios', value: stats.totalStudios.toString() },
    { label: 'Active Members', value: stats.activeMembers.toLocaleString() },
    { label: 'Bookings (30d)', value: stats.totalBookings.toLocaleString() },
    { label: 'MRR', value: `$${(stats.monthlyRevenue / 100).toLocaleString()}` },
    { label: 'Co-op Members', value: stats.coopMembers.toString() },
  ]

  if (loading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--primary)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Loading dashboard...</p>
          </div>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map((s) => (
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
              <th className="pb-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Tier</th>
              <th className="pb-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Joined</th>
            </tr>
          </thead>
          <tbody>
            {studios.map((s) => (
              <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{s.slug}.studio.coop</p>
                </td>
                <td className="py-3 capitalize">{s.discipline}</td>
                <td className="py-3">{s.member_count}</td>
                <td className="py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      s.tier === 'pro'
                        ? 'bg-violet-950 text-violet-400'
                        : s.tier === 'studio'
                          ? 'bg-blue-950 text-blue-400'
                          : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {s.tier}
                  </span>
                </td>
                <td className="py-3 text-[var(--muted-foreground)]">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {studios.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--muted-foreground)]">
                  No studios yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* System Alerts */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">System Alerts</h3>
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
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
