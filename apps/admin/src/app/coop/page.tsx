'use client'

import { useEffect, useState } from 'react'
import AdminShell from '@/components/admin-shell'
import { supabase } from '@/lib/supabase'

interface CoopMember {
  id: string
  name: string
  joined: string
  months: number
  totalPaid: number
  equityPercent: number
  votingEligible: boolean
}

const BOARD_MEMBERS = [
  { name: 'Sarah Chen', role: 'Chair', studio: 'Empire Aerial Arts', term: 'Jan 2026 - Dec 2026' },
  { name: 'Mike Reeves', role: 'Treasurer', studio: 'CrossFit Cuba St', term: 'Jan 2026 - Dec 2026' },
  { name: 'Priya Sharma', role: 'Secretary', studio: 'Wellington Yoga Collective', term: 'Jul 2025 - Jun 2026' },
]

interface MeetingMinute {
  id: string
  title: string
  date: string
  summary: string
}

interface Proposal {
  id: string
  title: string
  description: string
  status: 'open' | 'voting' | 'passed' | 'rejected'
  submitted_by: string
  submitted_at: string
}

const RECENT_VOTES = [
  { id: 'v1', title: 'Adopt multi-studio network feature', status: 'passed', yea: 6, nay: 1, abstain: 1, date: '2026-02-15' },
  { id: 'v2', title: 'Increase platform fee from 8% to 10%', status: 'rejected', yea: 2, nay: 5, abstain: 1, date: '2026-01-28' },
  { id: 'v3', title: 'Approve Q1 dividend distribution', status: 'passed', yea: 7, nay: 0, abstain: 1, date: '2026-01-15' },
]

const MEETING_MINUTES: MeetingMinute[] = [
  { id: 'm1', title: 'February Board Meeting', date: '2026-02-20', summary: 'Reviewed Q4 financials, approved network feature launch, discussed new pricing tiers.' },
  { id: 'm2', title: 'January Board Meeting', date: '2026-01-18', summary: 'Elected new board members, approved Q1 budget, set 2026 strategic priorities.' },
  { id: 'm3', title: 'December General Assembly', date: '2025-12-15', summary: 'Annual review, dividend vote, bylaw amendments for network membership.' },
]

const PROPOSALS: Proposal[] = [
  { id: 'p1', title: 'Add marketplace discovery feature', description: 'Create a public directory where potential students can discover co-op studios.', status: 'open', submitted_by: 'Wellington Yoga Collective', submitted_at: '2026-02-25' },
  { id: 'p2', title: 'Reduce minimum membership period for voting', description: 'Lower voting eligibility from 12 months to 6 months to increase participation.', status: 'voting', submitted_by: 'CrossFit Cuba St', submitted_at: '2026-02-10' },
  { id: 'p3', title: 'Implement local payment rails (PIX/UPI)', description: 'Support regional payment methods for studios in Brazil and India.', status: 'open', submitted_by: 'Empire Aerial Arts', submitted_at: '2026-02-05' },
]

export default function CoopPage() {
  const [coopMembers, setCoopMembers] = useState<CoopMember[]>([])
  const [totalStudios, setTotalStudios] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showNewMinute, setShowNewMinute] = useState(false)
  const [newMinuteTitle, setNewMinuteTitle] = useState('')
  const [newMinuteSummary, setNewMinuteSummary] = useState('')
  const [minutes, setMinutes] = useState(MEETING_MINUTES)
  const [proposals, setProposals] = useState(PROPOSALS)
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [newProposalTitle, setNewProposalTitle] = useState('')
  const [newProposalDesc, setNewProposalDesc] = useState('')

  useEffect(() => {
    async function loadCoopData() {
      try {
        // Fetch co-op eligible studios (tier = studio or pro)
        const [coopStudiosRes, totalStudiosRes] = await Promise.all([
          supabase
            .from('studios')
            .select('id, name, created_at, tier')
            .in('tier', ['studio', 'pro'])
            .order('created_at', { ascending: true }),
          supabase
            .from('studios')
            .select('*', { count: 'exact', head: true }),
        ])

        setTotalStudios(totalStudiosRes.count ?? 0)

        if (!coopStudiosRes.data || coopStudiosRes.data.length === 0) {
          setCoopMembers([])
          setLoading(false)
          return
        }

        // Fetch payments for these studios (platform fees = equity basis)
        const studioIds = coopStudiosRes.data.map((s) => s.id)
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('studio_id, amount_cents')
          .in('studio_id', studioIds)

        // Calculate per-studio totals
        const paymentMap: Record<string, number> = {}
        paymentsData?.forEach((p) => {
          paymentMap[p.studio_id] = (paymentMap[p.studio_id] ?? 0) + (p.amount_cents ?? 0)
        })

        // Calculate total platform fees across all co-op members (10% of revenue)
        const totalPlatformFees = Object.values(paymentMap).reduce((sum, v) => sum + Math.round(v * 0.1), 0)

        const now = new Date()
        const members: CoopMember[] = coopStudiosRes.data.map((s) => {
          const createdAt = new Date(s.created_at)
          const months = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
          const studioRevenue = paymentMap[s.id] ?? 0
          const platformFee = Math.round(studioRevenue * 0.1) // 10% platform fee
          const equityPercent = totalPlatformFees > 0
            ? Math.round((platformFee / totalPlatformFees) * 1000) / 10
            : 0

          return {
            id: s.id,
            name: s.name,
            joined: s.created_at,
            months,
            totalPaid: Math.round(platformFee / 100), // Convert cents to dollars
            equityPercent,
            votingEligible: months >= 12,
          }
        })

        setCoopMembers(members)
      } catch (err) {
        console.error('Failed to load co-op data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCoopData()
  }, [])

  const votingMembers = coopMembers.filter((m) => m.votingEligible).length
  const totalEquity = coopMembers.reduce((sum, m) => sum + m.totalPaid, 0)

  if (loading) {
    return (
      <AdminShell>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--primary)]" />
            <p className="text-sm text-[var(--muted-foreground)]">Loading co-op data...</p>
          </div>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Cooperative Governance</h2>
        <p className="text-sm text-[var(--muted-foreground)]">Manage co-op membership, equity, and voting</p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Member Studios</p>
          <p className="mt-1 text-3xl font-extrabold">{coopMembers.length}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">of {totalStudios} total studios</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Voting Members</p>
          <p className="mt-1 text-3xl font-extrabold">{votingMembers}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">12+ months membership</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Total Equity Pool</p>
          <p className="mt-1 text-3xl font-extrabold">${totalEquity.toLocaleString()}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Cumulative platform fees</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Next Election</p>
          <p className="mt-1 text-3xl font-extrabold">Q3</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Board of directors</p>
        </div>
      </div>

      {/* Board of Directors */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">Board of Directors</h3>
        <div className="grid grid-cols-3 gap-4">
          {BOARD_MEMBERS.map((b) => (
            <div key={b.name} className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
              <p className="font-semibold">{b.name}</p>
              <p className="text-sm text-[var(--primary)]">{b.role}</p>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">{b.studio}</p>
              <p className="text-xs text-[var(--muted-foreground)]">Term: {b.term}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Equity Tracker */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-bold">Equity Tracker</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Studio</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Member Since</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Months</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Total Paid</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Equity %</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Voting</th>
            </tr>
          </thead>
          <tbody>
            {coopMembers.map((m) => (
              <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-6 py-3 font-medium">{m.name}</td>
                <td className="px-6 py-3 text-[var(--muted-foreground)]">
                  {new Date(m.joined).toLocaleDateString()}
                </td>
                <td className="px-6 py-3">{m.months}</td>
                <td className="px-6 py-3">${m.totalPaid}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded-full bg-[var(--muted)]">
                      <div
                        className="h-2 rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.min(m.equityPercent * 5, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs">{m.equityPercent}%</span>
                  </div>
                </td>
                <td className="px-6 py-3">
                  {m.votingEligible ? (
                    <span className="inline-block rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      Eligible
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {12 - m.months} months to go
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {coopMembers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                  No co-op members yet. Studios on the &quot;studio&quot; or &quot;pro&quot; tier are co-op eligible.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Votes */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-bold">Recent Votes</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Proposal</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Result</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Yea</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Nay</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Abstain</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Date</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_VOTES.map((v) => (
              <tr key={v.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-6 py-3 font-medium">{v.title}</td>
                <td className="px-6 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    v.status === 'passed' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                  }`}>
                    {v.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-emerald-400">{v.yea}</td>
                <td className="px-6 py-3 text-red-400">{v.nay}</td>
                <td className="px-6 py-3 text-[var(--muted-foreground)]">{v.abstain}</td>
                <td className="px-6 py-3 text-[var(--muted-foreground)]">{v.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Member Proposals */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Member Proposals</h3>
          <button
            onClick={() => setShowNewProposal(true)}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            New Proposal
          </button>
        </div>

        {showNewProposal && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
            <div className="mb-3">
              <label className="text-sm font-medium">Title</label>
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                value={newProposalTitle}
                onChange={(e) => setNewProposalTitle(e.target.value)}
                placeholder="Proposal title"
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm min-h-[80px]"
                value={newProposalDesc}
                onChange={(e) => setNewProposalDesc(e.target.value)}
                placeholder="Describe your proposal"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!newProposalTitle.trim()) return
                  setProposals([
                    {
                      id: `p-${Date.now()}`,
                      title: newProposalTitle.trim(),
                      description: newProposalDesc.trim(),
                      status: 'open',
                      submitted_by: 'Admin',
                      submitted_at: new Date().toISOString().slice(0, 10),
                    },
                    ...proposals,
                  ])
                  setNewProposalTitle('')
                  setNewProposalDesc('')
                  setShowNewProposal(false)
                }}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Submit
              </button>
              <button
                onClick={() => setShowNewProposal(false)}
                className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {proposals.map((p) => (
            <div key={p.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{p.description}</p>
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                    Submitted by {p.submitted_by} on {p.submitted_at}
                  </p>
                </div>
                <span className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  p.status === 'open' ? 'bg-blue-950 text-blue-400' :
                  p.status === 'voting' ? 'bg-yellow-950 text-yellow-400' :
                  p.status === 'passed' ? 'bg-emerald-950 text-emerald-400' :
                  'bg-red-950 text-red-400'
                }`}>
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meeting Minutes */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Meeting Minutes</h3>
          <button
            onClick={() => setShowNewMinute(true)}
            className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 transition-colors"
          >
            Add Minutes
          </button>
        </div>

        {showNewMinute && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
            <div className="mb-3">
              <label className="text-sm font-medium">Title</label>
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                value={newMinuteTitle}
                onChange={(e) => setNewMinuteTitle(e.target.value)}
                placeholder="e.g. March Board Meeting"
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium">Summary</label>
              <textarea
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm min-h-[80px]"
                value={newMinuteSummary}
                onChange={(e) => setNewMinuteSummary(e.target.value)}
                placeholder="Key decisions and discussion points"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!newMinuteTitle.trim()) return
                  setMinutes([
                    {
                      id: `m-${Date.now()}`,
                      title: newMinuteTitle.trim(),
                      date: new Date().toISOString().slice(0, 10),
                      summary: newMinuteSummary.trim(),
                    },
                    ...minutes,
                  ])
                  setNewMinuteTitle('')
                  setNewMinuteSummary('')
                  setShowNewMinute(false)
                }}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Save
              </button>
              <button
                onClick={() => setShowNewMinute(false)}
                className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {minutes.map((m) => (
            <div key={m.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{m.summary}</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{m.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
