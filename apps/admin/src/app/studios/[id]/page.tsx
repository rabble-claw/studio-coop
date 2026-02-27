'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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
  owner_email: string
  stripe_connected: boolean
  custom_domain: string | null
}

const DEMO_STUDIOS: Record<string, Studio> = {
  '1': { id: '1', name: 'Empire Aerial Arts', slug: 'empire-aerial', discipline: 'aerial', tier: 'growth', members: 47, revenue_cents: 461300, status: 'active', created_at: '2026-01-15', owner_email: 'sarah@empireaerial.co.nz', stripe_connected: true, custom_domain: 'empireaerial.co.nz' },
  '2': { id: '2', name: 'Wellington Yoga Collective', slug: 'welly-yoga', discipline: 'yoga', tier: 'starter', members: 82, revenue_cents: 812600, status: 'active', created_at: '2026-01-22', owner_email: 'info@wellyyoga.co.nz', stripe_connected: true, custom_domain: null },
  '3': { id: '3', name: 'CrossFit Cuba St', slug: 'cf-cuba', discipline: 'crossfit', tier: 'growth', members: 124, revenue_cents: 1487200, status: 'active', created_at: '2026-02-01', owner_email: 'mike@cfcuba.nz', stripe_connected: true, custom_domain: 'cfcuba.nz' },
  '4': { id: '4', name: 'Dance Central', slug: 'dance-central', discipline: 'dance', tier: 'starter', members: 35, revenue_cents: 277200, status: 'active', created_at: '2026-02-10', owner_email: 'jen@dancecentral.nz', stripe_connected: true, custom_domain: null },
  '5': { id: '5', name: 'Barre & Beyond', slug: 'barre-beyond', discipline: 'barre', tier: 'growth', members: 58, revenue_cents: 574200, status: 'active', created_at: '2026-02-15', owner_email: 'lisa@barrebeyond.co.nz', stripe_connected: true, custom_domain: null },
  '6': { id: '6', name: 'Flow Pilates Studio', slug: 'flow-pilates', discipline: 'pilates', tier: 'starter', members: 0, revenue_cents: 0, status: 'pending', created_at: '2026-02-25', owner_email: 'emma@flowpilates.nz', stripe_connected: false, custom_domain: null },
}

const DEMO_MEMBERS = [
  { id: 'm1', name: 'Alice Johnson', email: 'alice@example.com', plan: 'Unlimited', joined: '2026-01-20', status: 'active' },
  { id: 'm2', name: 'Bob Smith', email: 'bob@example.com', plan: '10-Pack', joined: '2026-01-25', status: 'active' },
  { id: 'm3', name: 'Carol Davis', email: 'carol@example.com', plan: 'Unlimited', joined: '2026-02-01', status: 'active' },
  { id: 'm4', name: 'Dan Wilson', email: 'dan@example.com', plan: 'Drop-in', joined: '2026-02-10', status: 'active' },
  { id: 'm5', name: 'Eva Martinez', email: 'eva@example.com', plan: 'Unlimited', joined: '2026-02-15', status: 'paused' },
]

const DEMO_REVENUE = [
  { month: 'Jan 2026', bookings: 412, revenue: 156800, payout: 141120 },
  { month: 'Feb 2026', bookings: 487, revenue: 184200, payout: 165780 },
]

const TABS = ['Overview', 'Members', 'Revenue', 'Settings'] as const
type Tab = typeof TABS[number]

export default function StudioDetailPage() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const studio = DEMO_STUDIOS[params.id as string]

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
                studio.status === 'active'
                  ? 'bg-emerald-950 text-emerald-400'
                  : studio.status === 'pending'
                    ? 'bg-yellow-950 text-yellow-400'
                    : 'bg-red-950 text-red-400'
              }`}
            >
              {studio.status}
            </span>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
              studio.tier === 'growth' ? 'bg-violet-950 text-violet-400' : 'bg-zinc-800 text-zinc-400'
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
              <p className="mt-1 text-3xl font-extrabold">{studio.members}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Revenue</p>
              <p className="mt-1 text-3xl font-extrabold">${(studio.revenue_cents / 100).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Stripe</p>
              <p className="mt-1 text-3xl font-extrabold">{studio.stripe_connected ? 'Connected' : 'Pending'}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Domain</p>
              <p className="mt-1 text-lg font-extrabold">{studio.custom_domain ?? 'None'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h3 className="mb-4 text-lg font-bold">Studio Details</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Owner Email</dt>
                <dd className="mt-1 font-medium">{studio.owner_email}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Discipline</dt>
                <dd className="mt-1 font-medium capitalize">{studio.discipline}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Created</dt>
                <dd className="mt-1 font-medium">{studio.created_at}</dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--muted-foreground)]">Subdomain</dt>
                <dd className="mt-1 font-medium">{studio.slug}.studio.coop</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'Members' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h3 className="text-lg font-bold">Members ({DEMO_MEMBERS.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_MEMBERS.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-6 py-3 font-medium">{m.name}</td>
                  <td className="px-6 py-3 text-[var(--muted-foreground)]">{m.email}</td>
                  <td className="px-6 py-3">{m.plan}</td>
                  <td className="px-6 py-3 text-[var(--muted-foreground)]">{m.joined}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      m.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-yellow-950 text-yellow-400'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Revenue' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Total Revenue</p>
              <p className="mt-1 text-3xl font-extrabold">${(studio.revenue_cents / 100).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Platform Fee (10%)</p>
              <p className="mt-1 text-3xl font-extrabold">${(studio.revenue_cents / 1000).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <p className="text-sm text-[var(--muted-foreground)]">Studio Payout</p>
              <p className="mt-1 text-3xl font-extrabold">${((studio.revenue_cents * 0.9) / 100).toLocaleString()}</p>
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
                {DEMO_REVENUE.map((r) => (
                  <tr key={r.month} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-6 py-3 font-medium">{r.month}</td>
                    <td className="px-6 py-3">{r.bookings}</td>
                    <td className="px-6 py-3">${(r.revenue / 100).toLocaleString()}</td>
                    <td className="px-6 py-3">${(r.payout / 100).toLocaleString()}</td>
                  </tr>
                ))}
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
                  studio.tier === 'growth' ? 'bg-violet-950 text-violet-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {studio.tier}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">Custom Domain</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{studio.custom_domain ?? 'Not configured'}</p>
                </div>
                <button className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 transition-colors">
                  Configure
                </button>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <p className="font-medium">Stripe Connection</p>
                  <p className="text-sm text-[var(--muted-foreground)]">{studio.stripe_connected ? 'Connected' : 'Not connected'}</p>
                </div>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  studio.stripe_connected ? 'bg-emerald-950 text-emerald-400' : 'bg-yellow-950 text-yellow-400'
                }`}>
                  {studio.stripe_connected ? 'Active' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-400">Suspend Studio</p>
                  <p className="text-sm text-[var(--muted-foreground)]">Temporarily disable this studio</p>
                </div>
                <button className="rounded-lg bg-red-950 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900 transition-colors">
                  Suspend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
