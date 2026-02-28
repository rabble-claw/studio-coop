'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/admin-shell'
import { supabase } from '@/lib/supabase'

interface Studio {
  id: string
  name: string
  slug: string
  discipline: string
  tier: string
  member_count: number
  revenue_cents: number
  stripe_account_id: string | null
  created_at: string
}

export default function StudiosPage() {
  const [studios, setStudios] = useState<Studio[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadStudios = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('studios')
        .select('id, name, slug, discipline, tier, stripe_account_id, created_at')
        .order('created_at', { ascending: false })

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
      }

      if (tierFilter) {
        query = query.eq('tier', tierFilter)
      }

      // statusFilter maps to stripe status: 'active' = has stripe, 'pending' = no stripe
      // There's no status column on studios, so we derive from stripe_account_id

      const { data: studiosData, error } = await query

      if (error) {
        console.error('Failed to load studios:', error)
        return
      }

      if (!studiosData || studiosData.length === 0) {
        setStudios([])
        return
      }

      // Apply status filter
      let filtered = studiosData
      if (statusFilter === 'active') {
        filtered = studiosData.filter((s) => s.stripe_account_id !== null)
      } else if (statusFilter === 'pending') {
        filtered = studiosData.filter((s) => s.stripe_account_id === null)
      }

      // Fetch member counts and revenue for all studios
      const studioIds = filtered.map((s) => s.id)

      const [membershipsRes, paymentsRes] = await Promise.all([
        supabase
          .from('memberships')
          .select('studio_id')
          .in('studio_id', studioIds)
          .eq('status', 'active'),
        supabase
          .from('payments')
          .select('studio_id, amount_cents')
          .in('studio_id', studioIds),
      ])

      const memberCountMap: Record<string, number> = {}
      membershipsRes.data?.forEach((m) => {
        memberCountMap[m.studio_id] = (memberCountMap[m.studio_id] ?? 0) + 1
      })

      const revenueMap: Record<string, number> = {}
      paymentsRes.data?.forEach((p) => {
        revenueMap[p.studio_id] = (revenueMap[p.studio_id] ?? 0) + (p.amount_cents ?? 0)
      })

      setStudios(
        filtered.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          discipline: s.discipline,
          tier: s.tier,
          member_count: memberCountMap[s.id] ?? 0,
          revenue_cents: revenueMap[s.id] ?? 0,
          stripe_account_id: s.stripe_account_id,
          created_at: s.created_at,
        }))
      )
    } catch (err) {
      console.error('Failed to load studios:', err)
    } finally {
      setLoading(false)
    }
  }, [search, tierFilter, statusFilter])

  useEffect(() => {
    loadStudios()
  }, [loadStudios])

  function getStatus(studio: Studio): 'active' | 'pending' {
    return studio.stripe_account_id ? 'active' : 'pending'
  }

  return (
    <AdminShell>
      {/* Header with search */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Studios</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {loading ? 'Loading...' : `${studios.length} studios on the platform`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search studios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">All Tiers</option>
            <option value="free">Free</option>
            <option value="studio">Studio</option>
            <option value="pro">Pro</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Studios table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--primary)]" />
              <p className="text-sm text-[var(--muted-foreground)]">Loading studios...</p>
            </div>
          </div>
        ) : (
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
              {studios.map((s) => {
                const status = getStatus(s)
                return (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{s.slug}.studio.coop</p>
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">{s.member_count}</td>
                    <td className="px-6 py-4">${(s.revenue_cents / 100).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === 'active'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-yellow-950 text-yellow-400'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/studios/${s.id}`}
                        className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-zinc-700 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {studios.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-[var(--muted-foreground)]">
                    No studios found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  )
}
