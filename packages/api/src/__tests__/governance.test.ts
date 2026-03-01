import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import governance from '../routes/governance'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-1', email: 'member@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/governance', governance)
  return app
}

function makeAsyncChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.then = (res: any) => Promise.resolve(result).then(res)
  chain.catch = (rej: any) => Promise.resolve(result).catch(rej)
  chain[Symbol.toStringTag] = 'Promise'
  return chain
}

const headers = { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }

// ─────────────────────────────────────────────────────────────────────────────
// Proposals
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/governance/proposals', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a list of proposals', async () => {
    const proposals = [
      { id: 'p1', title: 'Lower fees', status: 'open', proposer: { id: 'u1', name: 'Alice', email: 'a@a.com' } },
    ]
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: proposals, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals', { headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.proposals).toHaveLength(1)
    expect(body.proposals[0].proposer_name).toBe('Alice')
  })
})

describe('POST /api/governance/proposals', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a proposal and returns 201', async () => {
    const created = { id: 'p-new', title: 'New policy', description: 'Details', status: 'draft' }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: created, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'New policy', description: 'Details', category: 'policy' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.proposal.title).toBe('New policy')
  })

  it('returns 400 when title is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals', {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: 'Details' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/title/i)
  })

  it('returns 400 when description is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Test' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/description/i)
  })

  it('returns 400 for invalid category', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Test', description: 'Test', category: 'invalid' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/category/i)
  })
})

describe('GET /api/governance/proposals/:id', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a single proposal', async () => {
    const proposal = { id: 'p1', title: 'Fee change', proposer: { id: 'u1', name: 'Alice', email: 'a@a.com' } }
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: proposal, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/p1', { headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.proposal.title).toBe('Fee change')
    expect(body.proposal.proposer_name).toBe('Alice')
  })

  it('returns 404 when proposal not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/nonexistent', { headers })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Voting
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/governance/proposals/:id/vote', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when studio_id is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/p1/vote', {
      method: 'POST',
      headers,
      body: JSON.stringify({ vote: 'yes' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/studio_id/i)
  })

  it('returns 400 when vote is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/p1/vote', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studio_id: 's1' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/vote/i)
  })

  it('returns 400 for invalid vote value', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/p1/vote', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studio_id: 's1', vote: 'maybe' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/vote/i)
  })

  it('returns 404 when proposal not found', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'proposals') {
          return makeAsyncChain({ data: null, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/nonexistent/vote', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studio_id: 's1', vote: 'yes' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 400 when proposal is not open', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'proposals') {
          return makeAsyncChain({ data: { id: 'p1', status: 'draft', vote_start: null, vote_end: null }, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/p1/vote', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studio_id: 's1', vote: 'yes' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/not open/i)
  })

  it('casts a new vote and returns 201', async () => {
    const voteResult = { id: 'v1', proposal_id: 'p1', studio_id: 's1', vote: 'yes', voted_by: 'user-1' }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'proposals') {
          return makeAsyncChain({ data: { id: 'p1', status: 'open', vote_start: null, vote_end: null }, error: null })
        }
        if (table === 'memberships') {
          return makeAsyncChain({ data: { role: 'owner' }, error: null })
        }
        if (table === 'votes') {
          const chain = makeAsyncChain({ data: null, error: null })
          // First call is for existing vote check (maybeSingle returns null)
          // Second call is for insert
          chain.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: voteResult, error: null }),
            }),
          })
          return chain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/p1/vote', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studio_id: 's1', vote: 'yes' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.vote.vote).toBe('yes')
  })
})

describe('GET /api/governance/proposals/:id/results', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns vote tally and quorum info', async () => {
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'proposals') {
          return makeAsyncChain({ data: { id: 'p1', title: 'Test', status: 'open', quorum_required: 50, pass_threshold: 66 }, error: null })
        }
        if (table === 'votes') {
          return makeAsyncChain({
            data: [
              { id: 'v1', studio_id: 's1', vote: 'yes', voted_by: 'u1', voted_at: '2026-03-01', studio: { id: 's1', name: 'Studio A' } },
              { id: 'v2', studio_id: 's2', vote: 'no', voted_by: 'u2', voted_at: '2026-03-01', studio: { id: 's2', name: 'Studio B' } },
              { id: 'v3', studio_id: 's3', vote: 'yes', voted_by: 'u3', voted_at: '2026-03-01', studio: { id: 's3', name: 'Studio C' } },
            ],
            error: null,
          })
        }
        if (table === 'studios') {
          return makeAsyncChain({ data: null, error: null, count: 4 })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/p1/results', { headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.tally.yes).toBe(2)
    expect(body.tally.no).toBe(1)
    expect(body.tally.abstain).toBe(0)
    expect(body.total_votes).toBe(3)
    expect(body.eligible_studios).toBe(4)
    expect(body.quorum_met).toBe(true) // 3/4 = 75% >= 50%
    expect(body.yes_percent).toBe(66.7) // 2/3 = 66.7%
  })

  it('returns 404 when proposal not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/proposals/nonexistent/results', { headers })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Board
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/governance/board', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns active board members', async () => {
    const members = [
      {
        id: 'bm1', role: 'chair', status: 'active', term_start: '2026-01-01',
        user: { id: 'u1', name: 'Chair Person', email: 'chair@example.com' },
        studio: { id: 's1', name: 'Main Studio', slug: 'main' },
      },
    ]
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: members, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/board', { headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.board).toHaveLength(1)
    expect(body.board[0].user_name).toBe('Chair Person')
    expect(body.board[0].studio_name).toBe('Main Studio')
  })
})

describe('POST /api/governance/board', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 403 when caller is not chair or secretary', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: { id: 'bm1', role: 'member' }, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/board', {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: 'u2', role: 'member', term_start: '2026-06-01' }),
    })

    expect(res.status).toBe(403)
  })

  it('returns 400 when user_id is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: { id: 'bm1', role: 'chair' }, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/board', {
      method: 'POST',
      headers,
      body: JSON.stringify({ role: 'member', term_start: '2026-06-01' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/user_id/i)
  })

  it('adds a board member when caller is chair', async () => {
    const newMember = { id: 'bm-new', user_id: 'u2', role: 'treasurer', term_start: '2026-06-01' }
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'board_members') {
          const chain = makeAsyncChain({ data: { id: 'bm1', role: 'chair' }, error: null })
          chain.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: newMember, error: null }),
            }),
          })
          return chain
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/board', {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: 'u2', role: 'treasurer', term_start: '2026-06-01' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.member.role).toBe('treasurer')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Meetings
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/governance/meetings', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when title is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/meetings', {
      method: 'POST',
      headers,
      body: JSON.stringify({ meeting_date: '2026-04-01' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/title/i)
  })

  it('returns 400 when meeting_date is missing', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/meetings', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Monthly board meeting' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as any
    expect(body.error.message).toMatch(/meeting_date/i)
  })

  it('creates a meeting and returns 201', async () => {
    const meeting = { id: 'm1', title: 'Monthly meeting', meeting_date: '2026-04-01' }
    const mock = {
      from: vi.fn(() => {
        const chain = makeAsyncChain({ data: meeting, error: null })
        chain.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: meeting, error: null }),
          }),
        })
        return chain
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/meetings', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Monthly meeting', meeting_date: '2026-04-01' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.meeting.title).toBe('Monthly meeting')
  })
})

describe('GET /api/governance/meetings/:id', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns a meeting with agenda items', async () => {
    const meeting = {
      id: 'm1', title: 'Board meeting', meeting_date: '2026-04-01',
      recorder: { id: 'u1', name: 'Secretary' },
    }
    const agendaItems = [
      { id: 'ai1', title: 'Budget review', sort_order: 0, proposal: { id: 'p1', title: 'Budget', status: 'open' } },
    ]

    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'meetings') {
          return makeAsyncChain({ data: meeting, error: null })
        }
        if (table === 'meeting_agenda_items') {
          return makeAsyncChain({ data: agendaItems, error: null })
        }
        return makeAsyncChain({ data: null, error: null })
      }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/meetings/m1', { headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.meeting.title).toBe('Board meeting')
    expect(body.meeting.recorder_name).toBe('Secretary')
    expect(body.agenda_items).toHaveLength(1)
    expect(body.agenda_items[0].proposal_title).toBe('Budget')
  })

  it('returns 404 when meeting not found', async () => {
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: null, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/meetings/nonexistent', { headers })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Equity
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/governance/equity', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns equity holdings with totals by share class', async () => {
    const holdings = [
      { id: 'e1', studio_id: 's1', shares: 100, share_class: 'A', studio: { id: 's1', name: 'Studio A', slug: 'studio-a' } },
      { id: 'e2', studio_id: 's2', shares: 50, share_class: 'A', studio: { id: 's2', name: 'Studio B', slug: 'studio-b' } },
      { id: 'e3', studio_id: 's3', shares: 25, share_class: 'B', studio: { id: 's3', name: 'Studio C', slug: 'studio-c' } },
    ]
    const mock = {
      from: vi.fn(() => makeAsyncChain({ data: holdings, error: null })),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const app = makeApp()
    const res = await app.request('/api/governance/equity', { headers })

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.holdings).toHaveLength(3)
    expect(body.totals_by_class.A).toBe(150)
    expect(body.totals_by_class.B).toBe(25)
    expect(body.holdings[0].studio_name).toBe('Studio A')
  })
})
