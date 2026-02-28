'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import AdminShell from '@/components/admin-shell'
import { supabase } from '@/lib/supabase'

interface Studio {
  id: string
  name: string
  slug: string
  discipline: string
  tier: string
  description: string | null
  settings: Record<string, unknown>
  stripe_account_id: string | null
  currency: string
  timezone: string
  created_at: string
}

interface Member {
  id: string
  user_name: string
  user_email: string
  role: string
  status: string
  joined_at: string
}

interface RevenueMonth {
  month: string
  bookings: number
  revenue: number
  payout: number
}

interface ActivityMetric {
  label: string
  value: string | number
}

const TABS = ['Overview', 'Members', 'Revenue', 'Settings'] as const
type Tab = typeof TABS[number]

export default function StudioDetailPage() {
  const params = useParams()
  const studioId = params.id as string

  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [studio, setStudio] = useState<Studio | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [revenue, setRevenue] = useState<RevenueMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetric[]>([])
  const [suspending, setSuspending] = useState(false)

  // Load studio data
  useEffect(() => {
    async function loadStudio() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('studios')
          .select('*')
          .eq('id', studioId)
          .single()

        if (error || !data) {
          setStudio(null)
          return
        }

        setStudio(data)

        // Fetch member count and total revenue in parallel
        const [membersCountRes, paymentsRes, ownerRes] = await Promise.all([
          supabase
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('studio_id', studioId)
            .eq('status', 'active'),
          supabase
            .from('payments')
            .select('amount_cents')
            .eq('studio_id', studioId),
          // Get owner email
          supabase
            .from('memberships')
            .select('user_id')
            .eq('studio_id', studioId)
            .eq('role', 'owner')
            .limit(1),
        ])

        setMemberCount(membersCountRes.count ?? 0)

        const total = paymentsRes.data?.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0) ?? 0
        setTotalRevenue(total)

        // Fetch owner email
        if (ownerRes.data && ownerRes.data.length > 0) {
          const { data: ownerUser } = await supabase
            .from('users')
            .select('email')
            .eq('id', ownerRes.data[0].user_id)
            .single()
          setOwnerEmail(ownerUser?.email ?? null)
        }

        // Fetch activity metrics
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          const [classesRes, bookingsRes, recentPaymentsRes] = await Promise.all([
            supabase
              .from('class_instances')
              .select('*', { count: 'exact', head: true })
              .eq('studio_id', studioId)
              .gte('start_time', thirtyDaysAgo),
            supabase
              .from('bookings')
              .select('id, class_instance_id!inner(studio_id)')
              .eq('class_instance_id.studio_id' as string, studioId),
            supabase
              .from('payments')
              .select('amount_cents')
              .eq('studio_id', studioId)
              .gte('created_at', thirtyDaysAgo),
          ])

          const recentRevenue = recentPaymentsRes.data?.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0) ?? 0

          setActivityMetrics([
            { label: 'Classes (30d)', value: classesRes.count ?? 0 },
            { label: 'Total Bookings', value: bookingsRes.data?.length ?? 0 },
            { label: 'Revenue (30d)', value: `$${(recentRevenue / 100).toLocaleString()}` },
            { label: 'Avg Revenue/Member', value: membersCountRes.count ? `$${Math.round(total / (membersCountRes.count * 100)).toLocaleString()}` : '$0' },
          ])
        } catch {
          // Activity metrics are optional
        }
      } catch (err) {
        console.error('Failed to load studio:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStudio()
  }, [studioId])

  // Load members when Members tab is active
  useEffect(() => {
    if (activeTab !== 'Members') return

    async function loadMembers() {
      const { data: membershipsData } = await supabase
        .from('memberships')
        .select('id, user_id, role, status, joined_at')
        .eq('studio_id', studioId)
        .order('joined_at', { ascending: false })

      if (!membershipsData || membershipsData.length === 0) {
        setMembers([])
        return
      }

      // Fetch user details
      const userIds = membershipsData.map((m) => m.user_id)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds)

      const userMap: Record<string, { name: string; email: string }> = {}
      usersData?.forEach((u) => {
        userMap[u.id] = { name: u.name, email: u.email }
      })

      setMembers(
        membershipsData.map((m) => ({
          id: m.id,
          user_name: userMap[m.user_id]?.name ?? 'Unknown',
          user_email: userMap[m.user_id]?.email ?? '',
          role: m.role,
          status: m.status,
          joined_at: m.joined_at,
        }))
      )
    }

    loadMembers()
  }, [activeTab, studioId])

  // Load revenue when Revenue tab is active
  useEffect(() => {
    if (activeTab !== 'Revenue') return

    async function loadRevenue() {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount_cents, created_at')
        .eq('studio_id', studioId)
        .order('created_at', { ascending: true })

      if (!paymentsData || paymentsData.length === 0) {
        setRevenue([])
        return
      }

      // Also get bookings count per month
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('booked_at, class_instance_id!inner(studio_id)')
        .eq('class_instance_id.studio_id' as string, studioId)

      // Group payments by month
      const monthMap: Record<string, { revenue: number; bookings: number }> = {}

      paymentsData.forEach((p) => {
        const date = new Date(p.created_at)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, bookings: 0 }
        monthMap[key].revenue += p.amount_cents ?? 0
      })

      bookingsData?.forEach((b) => {
        const date = new Date(b.booked_at)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, bookings: 0 }
        monthMap[key].bookings += 1
      })

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      setRevenue(
        Object.entries(monthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, val]) => {
            const [year, month] = key.split('-')
            return {
              month: `${monthNames[parseInt(month) - 1]} ${year}`,
              bookings: val.bookings,
              revenue: val.revenue,
              payout: Math.round(val.revenue * 0.9),
            }
          })
      )
    }

    loadRevenue()
  }, [activeTab, studioId])

  if (loading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--primary)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Loading studio...</p>
          </div>
        </div>
      </AdminShell>
    )
  }

  if (!studio) {
    return (
      <AdminShell>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-lg text-[var(--muted-foreground)]">Studio not found</p>
          <Link href="/studios" className="mt-4 text-sm text-[var(--primary)] hover:underline">
            Back to Studios
          </Link>
        </div>
      </AdminShell>
    )
  }

  const stripeConnected = !!studio.stripe_account_id
  const settings = studio.settings as Record<string, unknown>
  const studioStatus = settings?.suspended ? 'suspended' : stripeConnected ? 'active' : 'pending'
  const customDomain = settings?.custom_domain as string | null

  async function handleSuspendToggle() {
    if (!studio) return
    setSuspending(true)
    const currentSettings = (studio.settings ?? {}) as Record<string, unknown>
    const isSuspended = !!currentSettings.suspended
    const newSettings = { ...currentSettings, suspended: !isSuspended }

    await supabase
      .from('studios')
      .update({ settings: newSettings })
      .eq('id', studioId)

    setStudio({ ...studio, settings: newSettings })
    setSuspending(false)
  }

  return (
    <AdminShell>
      {/* Breadcrumb & Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Link href="/studios" className="hover:text-[var(--foreground)]">Studios</Link>
          <span>/</span>
          <span className="text-[var(--foreground)]">{studio.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{studio.name}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{studio.slug}.studio.coop</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                studioStatus === 'active'
                  ? 'bg-emerald-950 text-emerald-400'
                  : studioStatus === 'suspended'
                    ? 'bg-red-950 text-red-400'
                    : 'bg-yellow-950 text-yellow-400'
              }`}
            >
              {studioStatus}
            </span>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              studio.tier === 'pro'
                ? 'bg-violet-950 text-violet-400'
                : studio.tier === 'studio'
                  ? 'bg-blue-950 text-blue-400'
                  : 'bg-zinc-800 text-zinc-400'
            }`}>
              {studio.tier}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-[var(--muted)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Members</p>
              <p className="mt-1 text-3xl font-extrabold">{memberCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Total Revenue</p>
              <p className="mt-1 text-3xl font-extrabold">${(totalRevenue / 100).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Stripe</p>
              <div className="mt-1 flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${stripeConnected ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                <p className="text-lg font-extrabold">{stripeConnected ? 'Connected' : 'Pending'}</p>
              </div>
              {studio.stripe_account_id && (
                <p className="mt-1 text-xs font-mono text-[var(--muted-foreground)]">{studio.stripe_account_id}</p>
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Domain</p>
              <p className="mt-1 text-lg font-extrabold">{customDomain ?? 'None'}</p>
            </div>
          </div>

          {/* Activity Metrics */}
          {activityMetrics.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {activityMetrics.map((m) => (
                <div key={m.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <p className="text-sm text-[var(--muted-foreground)]">{m.label}</p>
                  <p className="mt-1 text-2xl font-extrabold">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="mb-4 text-lg font-bold">Studio Details</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Owner Email</dt>
                <dd className="mt-1 font-medium">{ownerEmail ?? 'No owner assigned'}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Discipline</dt>
                <dd className="mt-1 font-medium capitalize">{studio.discipline}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Created</dt>
                <dd className="mt-1 font-medium">{new Date(studio.created_at).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Subdomain</dt>
                <dd className="mt-1 font-medium">{studio.slug}.studio.coop</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Timezone</dt>
                <dd className="mt-1 font-medium">{studio.timezone}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Currency</dt>
                <dd className="mt-1 font-medium">{studio.currency}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'Members' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-lg font-bold">Members ({members.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-6 py-3 font-medium">{m.user_name}</td>
                  <td className="px-6 py-3 text-[var(--muted-foreground)]">{m.user_email}</td>
                  <td className="px-6 py-3 capitalize">{m.role}</td>
                  <td className="px-6 py-3 text-[var(--muted-foreground)]">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      m.status === 'active'
                        ? 'bg-emerald-950 text-emerald-400'
                        : m.status === 'suspended'
                          ? 'bg-red-950 text-red-400'
                          : 'bg-yellow-950 text-yellow-400'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                    No members yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Revenue' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Total Revenue</p>
              <p className="mt-1 text-3xl font-extrabold">${(totalRevenue / 100).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Platform Fee (10%)</p>
              <p className="mt-1 text-3xl font-extrabold">${(totalRevenue / 1000).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Studio Payout</p>
              <p className="mt-1 text-3xl font-extrabold">${((totalRevenue * 0.9) / 100).toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h3 className="text-lg font-bold">Monthly Breakdown</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Payout</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.month} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-6 py-3 font-medium">{r.month}</td>
                    <td className="px-6 py-3">{r.bookings}</td>
                    <td className="px-6 py-3">${(r.revenue / 100).toLocaleString()}</td>
                    <td className="px-6 py-3">${(r.payout / 100).toLocaleString()}</td>
                  </tr>
                ))}
                {revenue.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                      No revenue data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Settings' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="mb-4 text-lg font-bold">Studio Configuration</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">Tier</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Current subscription tier</p>
                </div>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  studio.tier === 'pro'
                    ? 'bg-violet-950 text-violet-400'
                    : studio.tier === 'studio'
                      ? 'bg-blue-950 text-blue-400'
                      : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {studio.tier}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">Custom Domain</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{customDomain ?? 'Not configured'}</p>
                </div>
                <button className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 transition-colors">
                  Configure
                </button>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">Stripe Connection</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{stripeConnected ? 'Connected' : 'Not connected'}</p>
                </div>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  stripeConnected ? 'bg-emerald-950 text-emerald-400' : 'bg-yellow-950 text-yellow-400'
                }`}>
                  {stripeConnected ? 'Active' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">Timezone</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{studio.timezone}</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">Currency</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{studio.currency}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-medium ${studioStatus === 'suspended' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {studioStatus === 'suspended' ? 'Reactivate Studio' : 'Suspend Studio'}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {studioStatus === 'suspended' ? 'Re-enable this studio' : 'Temporarily disable this studio'}
                  </p>
                </div>
                <button
                  onClick={handleSuspendToggle}
                  disabled={suspending}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    studioStatus === 'suspended'
                      ? 'bg-emerald-950 text-emerald-400 hover:bg-emerald-900'
                      : 'bg-red-950 text-red-400 hover:bg-red-900'
                  }`}
                >
                  {suspending ? 'Processing...' : studioStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
