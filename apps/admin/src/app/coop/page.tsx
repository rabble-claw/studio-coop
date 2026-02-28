'use client'

import { useEffect, useState, useCallback } from 'react'
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

interface BoardMember {
  id: string
  user_id: string
  studio_id: string | null
  role: string
  term_start: string
  term_end: string | null
  status: string
  user_name: string
  studio_name: string | null
}

interface Proposal {
  id: string
  title: string
  description: string
  status: string
  category: string | null
  proposed_by: string
  proposer_name: string
  vote_start: string | null
  vote_end: string | null
  quorum_required: number
  pass_threshold: number
  created_at: string
}

interface Meeting {
  id: string
  title: string
  meeting_date: string
  location: string | null
  minutes_text: string | null
  status: string
  recorder_name: string | null
}

interface VoteResult {
  proposal_id: string
  tally: { yes: number; no: number; abstain: number }
  total_votes: number
  quorum_met: boolean
  yes_percent: number
  passed: boolean
}

export default function CoopPage() {
  const [coopMembers, setCoopMembers] = useState<CoopMember[]>([])
  const [totalStudios, setTotalStudios] = useState(0)
  const [loading, setLoading] = useState(true)

  // Board
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([])

  // Proposals
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [newProposalTitle, setNewProposalTitle] = useState('')
  const [newProposalDesc, setNewProposalDesc] = useState('')
  const [newProposalCategory, setNewProposalCategory] = useState('other')
  const [voteResults, setVoteResults] = useState<Record<string, VoteResult>>({})

  // Meetings
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [newMeetingTitle, setNewMeetingTitle] = useState('')
  const [newMeetingDate, setNewMeetingDate] = useState('')
  const [newMeetingLocation, setNewMeetingLocation] = useState('')
  const [newMeetingSummary, setNewMeetingSummary] = useState('')

  const loadGovernanceData = useCallback(async () => {
    try {
      // Load board members from DB
      const { data: boardData } = await supabase
        .from('board_members')
        .select('*, user:users(id, name, email), studio:studios(id, name)')
        .eq('status', 'active')
        .order('role')

      const board: BoardMember[] = (boardData ?? []).map((m: any) => {
        const user = m.user as any
        const studio = m.studio as any
        return {
          id: m.id,
          user_id: m.user_id,
          studio_id: m.studio_id,
          role: m.role,
          term_start: m.term_start,
          term_end: m.term_end,
          status: m.status,
          user_name: user?.name ?? 'Unknown',
          studio_name: studio?.name ?? null,
        }
      })
      setBoardMembers(board)

      // Load proposals from DB
      const { data: proposalData } = await supabase
        .from('proposals')
        .select('*, proposer:users!proposed_by(id, name)')
        .order('created_at', { ascending: false })

      const props: Proposal[] = (proposalData ?? []).map((p: any) => {
        const proposer = p.proposer as any
        return {
          ...p,
          proposer_name: proposer?.name ?? 'Unknown',
          proposer: undefined,
        }
      })
      setProposals(props)

      // Load vote results for closed/open proposals
      const proposalIds = props.filter(p => ['open', 'passed', 'failed'].includes(p.status)).map(p => p.id)
      const results: Record<string, VoteResult> = {}
      for (const pid of proposalIds) {
        const { data: votes } = await supabase
          .from('votes')
          .select('vote')
          .eq('proposal_id', pid)

        const tally = { yes: 0, no: 0, abstain: 0 }
        for (const v of votes ?? []) {
          if (v.vote === 'yes') tally.yes++
          else if (v.vote === 'no') tally.no++
          else if (v.vote === 'abstain') tally.abstain++
        }
        const total = tally.yes + tally.no + tally.abstain
        const yesPercent = (tally.yes + tally.no) > 0 ? Math.round((tally.yes / (tally.yes + tally.no)) * 1000) / 10 : 0
        results[pid] = {
          proposal_id: pid,
          tally,
          total_votes: total,
          quorum_met: false,
          yes_percent: yesPercent,
          passed: false,
        }
      }
      setVoteResults(results)

      // Load meetings from DB
      const { data: meetingData } = await supabase
        .from('meetings')
        .select('*, recorder:users!recorded_by(id, name)')
        .order('meeting_date', { ascending: false })
        .limit(10)

      const mtgs: Meeting[] = (meetingData ?? []).map((m: any) => {
        const recorder = m.recorder as any
        return {
          ...m,
          recorder_name: recorder?.name ?? null,
          recorder: undefined,
        }
      })
      setMeetings(mtgs)
    } catch (err) {
      console.error('Failed to load governance data:', err)
    }
  }, [])

  useEffect(() => {
    async function loadCoopData() {
      try {
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
          loadGovernanceData()
          return
        }

        const studioIds = coopStudiosRes.data.map((s) => s.id)
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('studio_id, amount_cents')
          .in('studio_id', studioIds)

        const paymentMap: Record<string, number> = {}
        paymentsData?.forEach((p) => {
          paymentMap[p.studio_id] = (paymentMap[p.studio_id] ?? 0) + (p.amount_cents ?? 0)
        })

        const totalPlatformFees = Object.values(paymentMap).reduce((sum, v) => sum + Math.round(v * 0.1), 0)

        const now = new Date()
        const members: CoopMember[] = coopStudiosRes.data.map((s) => {
          const createdAt = new Date(s.created_at)
          const months = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
          const studioRevenue = paymentMap[s.id] ?? 0
          const platformFee = Math.round(studioRevenue * 0.1)
          const equityPercent = totalPlatformFees > 0
            ? Math.round((platformFee / totalPlatformFees) * 1000) / 10
            : 0

          return {
            id: s.id,
            name: s.name,
            joined: s.created_at,
            months,
            totalPaid: Math.round(platformFee / 100),
            equityPercent,
            votingEligible: months >= 12,
          }
        })

        setCoopMembers(members)
        await loadGovernanceData()
      } catch (err) {
        console.error('Failed to load co-op data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCoopData()
  }, [loadGovernanceData])

  const handleCreateProposal = async () => {
    if (!newProposalTitle.trim()) return
    try {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          title: newProposalTitle.trim(),
          description: newProposalDesc.trim(),
          proposed_by: '00000000-0000-0000-0000-000000000000', // admin placeholder
          category: newProposalCategory,
          status: 'draft',
        })
        .select('*')
        .single()

      if (!error && data) {
        setProposals([{ ...data, proposer_name: 'Admin' }, ...proposals])
      }
    } catch (err) {
      console.error('Failed to create proposal:', err)
    }
    setNewProposalTitle('')
    setNewProposalDesc('')
    setNewProposalCategory('other')
    setShowNewProposal(false)
  }

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim() || !newMeetingDate) return
    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          title: newMeetingTitle.trim(),
          meeting_date: newMeetingDate,
          location: newMeetingLocation.trim() || null,
          minutes_text: newMeetingSummary.trim() || null,
          status: 'scheduled',
        })
        .select('*')
        .single()

      if (!error && data) {
        setMeetings([{ ...data, recorder_name: null }, ...meetings])
      }
    } catch (err) {
      console.error('Failed to create meeting:', err)
    }
    setNewMeetingTitle('')
    setNewMeetingDate('')
    setNewMeetingLocation('')
    setNewMeetingSummary('')
    setShowNewMeeting(false)
  }

  const handleUpdateProposalStatus = async (id: string, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'open') {
      updates.vote_start = new Date().toISOString()
    }
    const { error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', id)

    if (!error) {
      setProposals(proposals.map(p => p.id === id ? { ...p, status: newStatus } : p))
    }
  }

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
          <p className="text-sm text-[var(--muted-foreground)]">Board Members</p>
          <p className="mt-1 text-3xl font-extrabold">{boardMembers.length}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Active board seats</p>
        </div>
      </div>

      {/* Board of Directors */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">Board of Directors</h3>
        {boardMembers.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {boardMembers.map((b) => (
              <div key={b.id} className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
                <p className="font-semibold">{b.user_name}</p>
                <p className="text-sm text-[var(--primary)] capitalize">{b.role}</p>
                {b.studio_name && (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)]">{b.studio_name}</p>
                )}
                <p className="text-xs text-[var(--muted-foreground)]">
                  Term: {new Date(b.term_start).toLocaleDateString()} - {b.term_end ? new Date(b.term_end).toLocaleDateString() : 'Present'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">No board members elected yet. Board members are managed via the governance API.</p>
        )}
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

      {/* Proposals & Votes */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Proposals & Votes</h3>
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
            <div className="mb-3">
              <label className="text-sm font-medium">Category</label>
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                value={newProposalCategory}
                onChange={(e) => setNewProposalCategory(e.target.value)}
              >
                <option value="policy">Policy</option>
                <option value="financial">Financial</option>
                <option value="membership">Membership</option>
                <option value="technical">Technical</option>
                <option value="amendment">Amendment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateProposal}
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

        {proposals.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Proposal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Votes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => {
                const result = voteResults[p.id]
                return (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        by {p.proposer_name} on {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {p.category && (
                        <span className="inline-block rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs capitalize">
                          {p.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.status === 'open' ? 'bg-blue-950 text-blue-400' :
                        p.status === 'draft' ? 'bg-zinc-800 text-zinc-400' :
                        p.status === 'passed' ? 'bg-emerald-950 text-emerald-400' :
                        p.status === 'failed' ? 'bg-red-950 text-red-400' :
                        p.status === 'withdrawn' ? 'bg-yellow-950 text-yellow-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {result ? (
                        <span>
                          <span className="text-emerald-400">{result.tally.yes}Y</span>{' / '}
                          <span className="text-red-400">{result.tally.no}N</span>{' / '}
                          <span className="text-[var(--muted-foreground)]">{result.tally.abstain}A</span>
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'draft' && (
                        <button
                          onClick={() => handleUpdateProposalStatus(p.id, 'open')}
                          className="rounded bg-blue-950 px-2 py-1 text-xs text-blue-400 hover:bg-blue-900"
                        >
                          Open Voting
                        </button>
                      )}
                      {p.status === 'open' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleUpdateProposalStatus(p.id, 'passed')}
                            className="rounded bg-emerald-950 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-900"
                          >
                            Pass
                          </button>
                          <button
                            onClick={() => handleUpdateProposalStatus(p.id, 'failed')}
                            className="rounded bg-red-950 px-2 py-1 text-xs text-red-400 hover:bg-red-900"
                          >
                            Fail
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">No proposals yet.</p>
        )}
      </div>

      {/* Meeting Minutes */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Meeting Minutes</h3>
          <button
            onClick={() => setShowNewMeeting(true)}
            className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 transition-colors"
          >
            Add Meeting
          </button>
        </div>

        {showNewMeeting && (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
            <div className="mb-3">
              <label className="text-sm font-medium">Title</label>
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                placeholder="e.g. March Board Meeting"
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium">Date</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium">Location</label>
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                value={newMeetingLocation}
                onChange={(e) => setNewMeetingLocation(e.target.value)}
                placeholder="e.g. Video call / Office"
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-medium">Summary / Minutes</label>
              <textarea
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm min-h-[80px]"
                value={newMeetingSummary}
                onChange={(e) => setNewMeetingSummary(e.target.value)}
                placeholder="Key decisions and discussion points (Markdown supported)"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateMeeting}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Save
              </button>
              <button
                onClick={() => setShowNewMeeting(false)}
                className="rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {meetings.map((m) => (
            <div key={m.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{m.title}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      m.status === 'completed' ? 'bg-emerald-950 text-emerald-400' :
                      m.status === 'scheduled' ? 'bg-blue-950 text-blue-400' :
                      m.status === 'cancelled' ? 'bg-red-950 text-red-400' :
                      'bg-yellow-950 text-yellow-400'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                  {m.minutes_text && (
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{m.minutes_text}</p>
                  )}
                  {m.location && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">Location: {m.location}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                  {new Date(m.meeting_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {meetings.length === 0 && (
            <p className="py-4 text-sm text-[var(--muted-foreground)]">No meetings recorded yet.</p>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
