'use client'

import AdminShell from '@/components/admin-shell'

interface CoopMember {
  id: string
  name: string
  joined: string
  months: number
  totalPaid: number
  equityPercent: number
  votingEligible: boolean
}

const COOP_MEMBERS: CoopMember[] = [
  { id: '1', name: 'Empire Aerial Arts', joined: '2025-01-15', months: 14, totalPaid: 1386, equityPercent: 18.2, votingEligible: true },
  { id: '2', name: 'Wellington Yoga Collective', joined: '2025-03-01', months: 12, totalPaid: 1188, equityPercent: 15.6, votingEligible: true },
  { id: '3', name: 'CrossFit Cuba St', joined: '2025-04-10', months: 11, totalPaid: 1089, equityPercent: 14.3, votingEligible: false },
  { id: '4', name: 'Dance Central', joined: '2025-06-20', months: 9, totalPaid: 891, equityPercent: 11.7, votingEligible: false },
  { id: '5', name: 'Barre & Beyond', joined: '2025-08-01', months: 7, totalPaid: 693, equityPercent: 9.1, votingEligible: false },
  { id: '6', name: 'Urban Climb', joined: '2025-09-15', months: 6, totalPaid: 594, equityPercent: 7.8, votingEligible: false },
  { id: '7', name: 'Zen Martial Arts', joined: '2025-11-01', months: 4, totalPaid: 396, equityPercent: 5.2, votingEligible: false },
  { id: '8', name: 'Flow Pilates Studio', joined: '2026-01-10', months: 2, totalPaid: 198, equityPercent: 2.6, votingEligible: false },
]

const BOARD_MEMBERS = [
  { name: 'Sarah Chen', role: 'Chair', studio: 'Empire Aerial Arts', term: 'Jan 2026 - Dec 2026' },
  { name: 'Mike Reeves', role: 'Treasurer', studio: 'CrossFit Cuba St', term: 'Jan 2026 - Dec 2026' },
  { name: 'Priya Sharma', role: 'Secretary', studio: 'Wellington Yoga Collective', term: 'Jul 2025 - Jun 2026' },
]

const RECENT_VOTES = [
  { id: 'v1', title: 'Adopt multi-studio network feature', status: 'passed', yea: 6, nay: 1, abstain: 1, date: '2026-02-15' },
  { id: 'v2', title: 'Increase platform fee from 8% to 10%', status: 'rejected', yea: 2, nay: 5, abstain: 1, date: '2026-01-28' },
  { id: 'v3', title: 'Approve Q1 dividend distribution', status: 'passed', yea: 7, nay: 0, abstain: 1, date: '2026-01-15' },
]

export default function CoopPage() {
  const votingMembers = COOP_MEMBERS.filter((m) => m.votingEligible).length
  const totalEquity = COOP_MEMBERS.reduce((sum, m) => sum + m.totalPaid, 0)

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
          <p className="mt-1 text-3xl font-extrabold">{COOP_MEMBERS.length}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">of 12 total studios</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Voting Members</p>
          <p className="mt-1 text-3xl font-extrabold">{votingMembers}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">12+ months membership</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">Total Equity Pool</p>
          <p className="mt-1 text-3xl font-extrabold">${totalEquity.toLocaleString()}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Cumulative contributions</p>
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
            {COOP_MEMBERS.map((m) => (
              <tr key={m.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-6 py-3 font-medium">{m.name}</td>
                <td className="px-6 py-3 text-[var(--muted-foreground)]">{m.joined}</td>
                <td className="px-6 py-3">{m.months}</td>
                <td className="px-6 py-3">${m.totalPaid}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded-full bg-[var(--muted)]">
                      <div
                        className="h-2 rounded-full bg-[var(--primary)]"
                        style={{ width: `${m.equityPercent * 5}%` }}
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
          </tbody>
        </table>
      </div>

      {/* Recent Votes */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
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
    </AdminShell>
  )
}
