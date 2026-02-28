// Co-op governance endpoints
//
// Mounted at /api/governance in index.ts so paths here are:
//   GET    /proposals                    — list proposals
//   POST   /proposals                    — create a proposal
//   GET    /proposals/:id                — get a single proposal
//   PUT    /proposals/:id                — update a proposal
//   POST   /proposals/:id/vote           — cast a vote
//   GET    /proposals/:id/results        — vote tally
//   GET    /board                        — list board members
//   POST   /board                        — add a board member
//   PUT    /board/:id                    — update board member
//   GET    /meetings                     — list meetings
//   POST   /meetings                     — create a meeting
//   GET    /meetings/:id                 — get meeting with agenda
//   PUT    /meetings/:id                 — update meeting
//   GET    /equity                       — share distribution

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { createServiceClient } from '../lib/supabase'
import { badRequest, forbidden, notFound, conflict } from '../lib/errors'

const governance = new Hono()

// ---------------------------------------------------------------------------
// GET /proposals — list all proposals
// ---------------------------------------------------------------------------

governance.get('/proposals', authMiddleware, async (c) => {
  const supabase = createServiceClient()
  const status = c.req.query('status')
  const category = c.req.query('category')

  let query = supabase
    .from('proposals')
    .select('*, proposer:users!proposed_by(id, name, email)')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const proposals = (data ?? []).map((p) => {
    const proposer = p.proposer as unknown as { id: string; name: string; email: string } | null
    return {
      ...p,
      proposer_name: proposer?.name ?? 'Unknown',
      proposer: undefined,
    }
  })

  return c.json({ proposals })
})

// ---------------------------------------------------------------------------
// POST /proposals — create a proposal
// ---------------------------------------------------------------------------

governance.post('/proposals', authMiddleware, async (c) => {
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const title = body.title as string | undefined
  const description = body.description as string | undefined
  const category = body.category as string | undefined
  const quorum_required = body.quorum_required as number | undefined
  const pass_threshold = body.pass_threshold as number | undefined
  const parent_proposal_id = body.parent_proposal_id as string | undefined

  if (!title?.trim()) throw badRequest('Title is required')
  if (!description?.trim()) throw badRequest('Description is required')

  const validCategories = ['policy', 'financial', 'membership', 'technical', 'amendment', 'other']
  if (category && !validCategories.includes(category)) {
    throw badRequest(`Category must be one of: ${validCategories.join(', ')}`)
  }

  const { data: proposal, error } = await supabase
    .from('proposals')
    .insert({
      title: title.trim(),
      description: description.trim(),
      proposed_by: user.id,
      category: category ?? null,
      quorum_required: quorum_required ?? 50,
      pass_threshold: pass_threshold ?? 66,
      parent_proposal_id: parent_proposal_id ?? null,
    })
    .select('*')
    .single()

  if (error || !proposal) throw badRequest('Failed to create proposal')

  return c.json({ proposal }, 201)
})

// ---------------------------------------------------------------------------
// GET /proposals/:id — get a single proposal
// ---------------------------------------------------------------------------

governance.get('/proposals/:id', authMiddleware, async (c) => {
  const proposalId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*, proposer:users!proposed_by(id, name, email)')
    .eq('id', proposalId)
    .single()

  if (!proposal) throw notFound('Proposal')

  const proposer = proposal.proposer as unknown as { id: string; name: string; email: string } | null

  return c.json({
    proposal: {
      ...proposal,
      proposer_name: proposer?.name ?? 'Unknown',
      proposer: undefined,
    },
  })
})

// ---------------------------------------------------------------------------
// PUT /proposals/:id — update a proposal
// ---------------------------------------------------------------------------

governance.put('/proposals/:id', authMiddleware, async (c) => {
  const proposalId = c.req.param('id')
  const user = c.get('user')
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('proposals')
    .select('id, proposed_by, status')
    .eq('id', proposalId)
    .single()

  if (!existing) throw notFound('Proposal')

  // Only the proposer can update, or admins can change status
  if (existing.proposed_by !== user.id) {
    // Check if user is a board member (admin-level access)
    const { data: boardMember } = await supabase
      .from('board_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!boardMember) throw forbidden('Only the proposer or board members can update proposals')
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (typeof body.title === 'string') updates.title = (body.title as string).trim()
  if (typeof body.description === 'string') updates.description = (body.description as string).trim()
  if (typeof body.status === 'string') {
    const validStatuses = ['draft', 'open', 'passed', 'failed', 'withdrawn', 'amended']
    if (!validStatuses.includes(body.status as string)) {
      throw badRequest(`Status must be one of: ${validStatuses.join(', ')}`)
    }
    updates.status = body.status
  }
  if (typeof body.category === 'string') updates.category = body.category
  if (typeof body.vote_start === 'string') updates.vote_start = body.vote_start
  if (typeof body.vote_end === 'string') updates.vote_end = body.vote_end
  if (typeof body.quorum_required === 'number') updates.quorum_required = body.quorum_required
  if (typeof body.pass_threshold === 'number') updates.pass_threshold = body.pass_threshold

  if (Object.keys(updates).length === 0) throw badRequest('No fields to update')

  updates.updated_at = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', proposalId)
    .select('*')
    .single()

  if (error || !updated) throw badRequest('Failed to update proposal')

  return c.json({ proposal: updated })
})

// ---------------------------------------------------------------------------
// POST /proposals/:id/vote — cast a vote (one per studio)
// ---------------------------------------------------------------------------

governance.post('/proposals/:id/vote', authMiddleware, async (c) => {
  const proposalId = c.req.param('id')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const studioId = body.studio_id as string | undefined
  const vote = body.vote as string | undefined

  if (!studioId) throw badRequest('studio_id is required')
  if (!vote) throw badRequest('vote is required')

  const validVotes = ['yes', 'no', 'abstain']
  if (!validVotes.includes(vote)) {
    throw badRequest(`Vote must be one of: ${validVotes.join(', ')}`)
  }

  // Verify the proposal is open for voting
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, status, vote_start, vote_end')
    .eq('id', proposalId)
    .single()

  if (!proposal) throw notFound('Proposal')
  if (proposal.status !== 'open') throw badRequest('Proposal is not open for voting')

  // Check voting window if set
  const now = new Date()
  if (proposal.vote_end && new Date(proposal.vote_end) < now) {
    throw badRequest('Voting period has ended')
  }

  // Verify user is an owner/admin of the studio (voting rights)
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .maybeSingle()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    throw forbidden('Only studio owners/admins can vote on behalf of a studio')
  }

  // Upsert the vote (unique constraint on proposal_id + studio_id)
  const { data: existingVote } = await supabase
    .from('votes')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('studio_id', studioId)
    .maybeSingle()

  let voteResult
  if (existingVote) {
    const { data, error } = await supabase
      .from('votes')
      .update({ vote, voted_by: user.id, voted_at: new Date().toISOString() })
      .eq('id', existingVote.id)
      .select('*')
      .single()
    if (error) throw badRequest('Failed to update vote')
    voteResult = data
  } else {
    const { data, error } = await supabase
      .from('votes')
      .insert({
        proposal_id: proposalId,
        studio_id: studioId,
        vote,
        voted_by: user.id,
      })
      .select('*')
      .single()
    if (error) throw badRequest('Failed to cast vote')
    voteResult = data
  }

  return c.json({ vote: voteResult }, existingVote ? 200 : 201)
})

// ---------------------------------------------------------------------------
// GET /proposals/:id/results — vote tally
// ---------------------------------------------------------------------------

governance.get('/proposals/:id/results', authMiddleware, async (c) => {
  const proposalId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, status, quorum_required, pass_threshold')
    .eq('id', proposalId)
    .single()

  if (!proposal) throw notFound('Proposal')

  const { data: votes } = await supabase
    .from('votes')
    .select('id, studio_id, vote, voted_by, voted_at, studio:studios(id, name)')
    .eq('proposal_id', proposalId)

  const tally = { yes: 0, no: 0, abstain: 0 }
  for (const v of votes ?? []) {
    if (v.vote === 'yes') tally.yes++
    else if (v.vote === 'no') tally.no++
    else if (v.vote === 'abstain') tally.abstain++
  }

  const totalVotes = tally.yes + tally.no + tally.abstain

  // Get total eligible studios (studios on studio/pro tier)
  const { count: eligibleStudios } = await supabase
    .from('studios')
    .select('*', { count: 'exact', head: true })
    .in('tier', ['studio', 'pro'])

  const quorumMet = eligibleStudios
    ? (totalVotes / eligibleStudios) * 100 >= (proposal.quorum_required ?? 50)
    : false

  const passThreshold = proposal.pass_threshold ?? 66
  const yesPercent = (tally.yes + tally.no) > 0
    ? (tally.yes / (tally.yes + tally.no)) * 100
    : 0
  const passed = quorumMet && yesPercent >= passThreshold

  const normalizedVotes = (votes ?? []).map((v) => {
    const studio = v.studio as unknown as { id: string; name: string } | null
    return {
      studio_id: v.studio_id,
      studio_name: studio?.name ?? 'Unknown',
      vote: v.vote,
      voted_at: v.voted_at,
    }
  })

  return c.json({
    proposal_id: proposal.id,
    title: proposal.title,
    status: proposal.status,
    tally,
    total_votes: totalVotes,
    eligible_studios: eligibleStudios ?? 0,
    quorum_required: proposal.quorum_required,
    quorum_met: quorumMet,
    pass_threshold: passThreshold,
    yes_percent: Math.round(yesPercent * 10) / 10,
    passed,
    votes: normalizedVotes,
  })
})

// ---------------------------------------------------------------------------
// GET /board — list board members
// ---------------------------------------------------------------------------

governance.get('/board', authMiddleware, async (c) => {
  const supabase = createServiceClient()
  const status = c.req.query('status') ?? 'active'

  const { data, error } = await supabase
    .from('board_members')
    .select('*, user:users(id, name, email), studio:studios(id, name, slug)')
    .eq('status', status)
    .order('role')
    .order('term_start', { ascending: false })

  if (error) throw new Error(error.message)

  const members = (data ?? []).map((m) => {
    const user = m.user as unknown as { id: string; name: string; email: string } | null
    const studio = m.studio as unknown as { id: string; name: string; slug: string } | null
    return {
      ...m,
      user_name: user?.name ?? 'Unknown',
      user_email: user?.email ?? '',
      studio_name: studio?.name ?? null,
      user: undefined,
      studio: undefined,
    }
  })

  return c.json({ board: members })
})

// ---------------------------------------------------------------------------
// POST /board — add a board member
// ---------------------------------------------------------------------------

governance.post('/board', authMiddleware, async (c) => {
  const user = c.get('user')
  const supabase = createServiceClient()

  // Only existing board members (chair/secretary) can add new members
  const { data: callerBoard } = await supabase
    .from('board_members')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!callerBoard || !['chair', 'secretary'].includes(callerBoard.role)) {
    throw forbidden('Only the chair or secretary can add board members')
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const userId = body.user_id as string | undefined
  const studioId = body.studio_id as string | undefined
  const role = body.role as string | undefined
  const termStart = body.term_start as string | undefined
  const termEnd = body.term_end as string | undefined

  if (!userId) throw badRequest('user_id is required')
  if (!role) throw badRequest('role is required')
  if (!termStart) throw badRequest('term_start is required')

  const validRoles = ['chair', 'secretary', 'treasurer', 'member']
  if (!validRoles.includes(role)) {
    throw badRequest(`Role must be one of: ${validRoles.join(', ')}`)
  }

  const { data: member, error } = await supabase
    .from('board_members')
    .insert({
      user_id: userId,
      studio_id: studioId ?? null,
      role,
      term_start: termStart,
      term_end: termEnd ?? null,
    })
    .select('*')
    .single()

  if (error || !member) throw badRequest('Failed to add board member')

  return c.json({ member }, 201)
})

// ---------------------------------------------------------------------------
// PUT /board/:id — update a board member
// ---------------------------------------------------------------------------

governance.put('/board/:id', authMiddleware, async (c) => {
  const memberId = c.req.param('id')
  const user = c.get('user')
  const supabase = createServiceClient()

  // Only chair/secretary can update
  const { data: callerBoard } = await supabase
    .from('board_members')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!callerBoard || !['chair', 'secretary'].includes(callerBoard.role)) {
    throw forbidden('Only the chair or secretary can update board members')
  }

  const { data: existing } = await supabase
    .from('board_members')
    .select('id')
    .eq('id', memberId)
    .single()

  if (!existing) throw notFound('Board member')

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (typeof body.role === 'string') {
    const validRoles = ['chair', 'secretary', 'treasurer', 'member']
    if (!validRoles.includes(body.role as string)) {
      throw badRequest(`Role must be one of: ${validRoles.join(', ')}`)
    }
    updates.role = body.role
  }
  if (typeof body.status === 'string') {
    const validStatuses = ['active', 'completed', 'resigned']
    if (!validStatuses.includes(body.status as string)) {
      throw badRequest(`Status must be one of: ${validStatuses.join(', ')}`)
    }
    updates.status = body.status
  }
  if (typeof body.term_end === 'string') updates.term_end = body.term_end

  if (Object.keys(updates).length === 0) throw badRequest('No fields to update')

  const { data: updated, error } = await supabase
    .from('board_members')
    .update(updates)
    .eq('id', memberId)
    .select('*')
    .single()

  if (error || !updated) throw badRequest('Failed to update board member')

  return c.json({ member: updated })
})

// ---------------------------------------------------------------------------
// GET /meetings — list meetings
// ---------------------------------------------------------------------------

governance.get('/meetings', authMiddleware, async (c) => {
  const supabase = createServiceClient()
  const status = c.req.query('status')

  let query = supabase
    .from('meetings')
    .select('*, recorder:users!recorded_by(id, name)')
    .order('meeting_date', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const meetings = (data ?? []).map((m) => {
    const recorder = m.recorder as unknown as { id: string; name: string } | null
    return {
      ...m,
      recorder_name: recorder?.name ?? null,
      recorder: undefined,
    }
  })

  return c.json({ meetings })
})

// ---------------------------------------------------------------------------
// POST /meetings — create a meeting
// ---------------------------------------------------------------------------

governance.post('/meetings', authMiddleware, async (c) => {
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const title = body.title as string | undefined
  const meetingDate = body.meeting_date as string | undefined
  const location = body.location as string | undefined
  const minutesText = body.minutes_text as string | undefined
  const agendaItems = body.agenda_items as Array<{ title: string; description?: string; proposal_id?: string }> | undefined

  if (!title?.trim()) throw badRequest('Title is required')
  if (!meetingDate) throw badRequest('meeting_date is required')

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      title: title.trim(),
      meeting_date: meetingDate,
      location: location?.trim() ?? null,
      minutes_text: minutesText?.trim() ?? null,
      recorded_by: user.id,
    })
    .select('*')
    .single()

  if (error || !meeting) throw badRequest('Failed to create meeting')

  // Insert agenda items if provided
  if (agendaItems && agendaItems.length > 0) {
    const items = agendaItems.map((item, idx) => ({
      meeting_id: meeting.id,
      title: item.title,
      description: item.description ?? null,
      sort_order: idx,
      proposal_id: item.proposal_id ?? null,
    }))

    await supabase.from('meeting_agenda_items').insert(items)
  }

  return c.json({ meeting }, 201)
})

// ---------------------------------------------------------------------------
// GET /meetings/:id — get meeting with agenda items
// ---------------------------------------------------------------------------

governance.get('/meetings/:id', authMiddleware, async (c) => {
  const meetingId = c.req.param('id')
  const supabase = createServiceClient()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*, recorder:users!recorded_by(id, name)')
    .eq('id', meetingId)
    .single()

  if (!meeting) throw notFound('Meeting')

  const { data: agendaItems } = await supabase
    .from('meeting_agenda_items')
    .select('*, proposal:proposals(id, title, status)')
    .eq('meeting_id', meetingId)
    .order('sort_order')

  const recorder = meeting.recorder as unknown as { id: string; name: string } | null

  const normalizedItems = (agendaItems ?? []).map((item) => {
    const proposal = item.proposal as unknown as { id: string; title: string; status: string } | null
    return {
      ...item,
      proposal_title: proposal?.title ?? null,
      proposal_status: proposal?.status ?? null,
      proposal: undefined,
    }
  })

  return c.json({
    meeting: {
      ...meeting,
      recorder_name: recorder?.name ?? null,
      recorder: undefined,
    },
    agenda_items: normalizedItems,
  })
})

// ---------------------------------------------------------------------------
// PUT /meetings/:id — update a meeting
// ---------------------------------------------------------------------------

governance.put('/meetings/:id', authMiddleware, async (c) => {
  const meetingId = c.req.param('id')
  const user = c.get('user')
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('meetings')
    .select('id, recorded_by')
    .eq('id', meetingId)
    .single()

  if (!existing) throw notFound('Meeting')

  // Only the recorder or a board member can update
  if (existing.recorded_by !== user.id) {
    const { data: boardMember } = await supabase
      .from('board_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!boardMember) throw forbidden('Only the recorder or board members can update meetings')
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (typeof body.title === 'string') updates.title = (body.title as string).trim()
  if (typeof body.location === 'string') updates.location = (body.location as string).trim()
  if (typeof body.minutes_text === 'string') updates.minutes_text = (body.minutes_text as string).trim()
  if (typeof body.meeting_date === 'string') updates.meeting_date = body.meeting_date
  if (typeof body.status === 'string') {
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled']
    if (!validStatuses.includes(body.status as string)) {
      throw badRequest(`Status must be one of: ${validStatuses.join(', ')}`)
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) throw badRequest('No fields to update')

  const { data: updated, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', meetingId)
    .select('*')
    .single()

  if (error || !updated) throw badRequest('Failed to update meeting')

  // Handle agenda items update if provided
  const agendaItems = body.agenda_items as Array<{ id?: string; title: string; description?: string; proposal_id?: string; outcome?: string }> | undefined
  if (agendaItems) {
    // Delete existing and re-insert for simplicity
    await supabase.from('meeting_agenda_items').delete().eq('meeting_id', meetingId)

    if (agendaItems.length > 0) {
      const items = agendaItems.map((item, idx) => ({
        meeting_id: meetingId,
        title: item.title,
        description: item.description ?? null,
        sort_order: idx,
        proposal_id: item.proposal_id ?? null,
        outcome: item.outcome ?? null,
      }))

      await supabase.from('meeting_agenda_items').insert(items)
    }
  }

  return c.json({ meeting: updated })
})

// ---------------------------------------------------------------------------
// GET /equity — share distribution
// ---------------------------------------------------------------------------

governance.get('/equity', authMiddleware, async (c) => {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('equity_holdings')
    .select('*, studio:studios(id, name, slug)')
    .order('shares', { ascending: false })

  if (error) throw new Error(error.message)

  const holdings = (data ?? []).map((h) => {
    const studio = h.studio as unknown as { id: string; name: string; slug: string } | null
    return {
      ...h,
      studio_name: studio?.name ?? 'Unknown',
      studio_slug: studio?.slug ?? '',
      studio: undefined,
    }
  })

  // Calculate totals per share class
  const totalsByClass: Record<string, number> = {}
  for (const h of holdings) {
    totalsByClass[h.share_class] = (totalsByClass[h.share_class] ?? 0) + h.shares
  }

  return c.json({ holdings, totals_by_class: totalsByClass })
})

export default governance
