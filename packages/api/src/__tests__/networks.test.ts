import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import networks from '../routes/networks'
import { errorHandler } from '../middleware/error-handler'

vi.mock('../lib/supabase', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-123', email: 'test@example.com' })
    c.set('accessToken', 'fake-token')
    await next()
  }),
}))

vi.mock('../middleware/studio-access', () => ({
  requireAdmin: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'admin')
    await next()
  }),
  requireOwner: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'owner')
    await next()
  }),
  requireMember: vi.fn(async (c: any, next: any) => {
    c.set('studioId', c.req.param('studioId'))
    c.set('memberRole', 'member')
    await next()
  }),
}))

import { createServiceClient } from '../lib/supabase'

const STUDIO_ID = 'studio-abc'
const NETWORK_ID = 'network-123'
const INVITED_STUDIO_ID = 'studio-def'

function makeApp() {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/api/studios', networks)
  app.route('/api/networks', networks)
  return app
}

// Helper to create a chainable mock that terminates at the given method
function makeMockTerminal(data: unknown, error: unknown = null) {
  const result = { data, error }
  const methods = ['select', 'eq', 'neq', 'in', 'order', 'insert', 'update', 'delete', 'upsert', 'limit']
  const chain: Record<string, any> = {}
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Make chain itself thenable so `await supabase.from(...).select(...).eq(...)` works
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return chain
}

describe('POST /api/studios/:studioId/networks — create a network', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a network successfully', async () => {
    const newNetwork = {
      id: NETWORK_ID,
      name: 'Wellington Studios',
      description: 'Studios in Wellington',
      created_by_studio_id: STUDIO_ID,
      created_at: new Date().toISOString(),
    }

    const fromFn = vi.fn()
    let callNum = 0
    fromFn.mockImplementation(() => {
      callNum++
      if (callNum === 1) {
        // insert network
        return makeMockTerminal(newNetwork)
      }
      // insert membership + policy (just need to resolve)
      return makeMockTerminal({ id: 'x' })
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/networks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        name: 'Wellington Studios',
        description: 'Studios in Wellington',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.network.name).toBe('Wellington Studios')
  })

  it('rejects when name is missing', async () => {
    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/networks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ description: 'no name' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/studios/:studioId/networks — list studio networks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns networks for a studio', async () => {
    const memberships = [
      {
        network_id: NETWORK_ID,
        status: 'active',
        network: { id: NETWORK_ID, name: 'Wellington Studios', description: 'Studios in Wellington', created_by_studio_id: STUDIO_ID },
      },
    ]

    const chain = makeMockTerminal(null)
    chain.order = vi.fn(() => Promise.resolve({ data: memberships, error: null }))

    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => chain) } as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/networks`, {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.networks).toHaveLength(1)
    expect(body.networks[0].name).toBe('Wellington Studios')
  })

  it('returns empty array when studio has no networks', async () => {
    const chain = makeMockTerminal(null)
    chain.order = vi.fn(() => Promise.resolve({ data: null, error: null }))

    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn(() => chain) } as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/networks`, {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.networks).toEqual([])
  })
})

describe('POST /api/networks/:networkId/invite — invite studio to network', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invites a studio to the network', async () => {
    const network = { id: NETWORK_ID, created_by_studio_id: STUDIO_ID }
    const userMembership = { studio_id: STUDIO_ID, role: 'owner' }
    const invitation = {
      id: 'mem-1',
      network_id: NETWORK_ID,
      studio_id: INVITED_STUDIO_ID,
      status: 'pending',
    }

    const fromFn = vi.fn()
    let callNum = 0
    fromFn.mockImplementation((table: string) => {
      callNum++
      if (callNum === 1) {
        // Fetch network
        return makeMockTerminal(network)
      }
      if (callNum === 2) {
        // Check user membership
        return makeMockTerminal(userMembership)
      }
      if (callNum === 3) {
        // Check existing network membership
        return makeMockTerminal(null)
      }
      // Insert invitation
      return makeMockTerminal(invitation)
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/networks/${NETWORK_ID}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ studioId: INVITED_STUDIO_ID }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.invitation.status).toBe('pending')
  })
})

describe('POST /api/networks/:networkId/accept — accept network invitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a pending invitation', async () => {
    const userMembership = { studio_id: STUDIO_ID, role: 'owner' }
    const pendingInvitation = { id: 'mem-1', status: 'pending' }
    const updatedMembership = {
      id: 'mem-1',
      network_id: NETWORK_ID,
      studio_id: STUDIO_ID,
      status: 'active',
      joined_at: new Date().toISOString(),
    }

    const fromFn = vi.fn()
    let callNum = 0
    fromFn.mockImplementation(() => {
      callNum++
      if (callNum === 1) {
        // Check user membership in studio
        return makeMockTerminal(userMembership)
      }
      if (callNum === 2) {
        // Find pending invitation
        return makeMockTerminal(pendingInvitation)
      }
      // Update invitation
      return makeMockTerminal(updatedMembership)
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/networks/${NETWORK_ID}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ studioId: STUDIO_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.membership.status).toBe('active')
  })
})

describe('POST /api/networks/:networkId/decline — decline network invitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('declines a pending invitation', async () => {
    const userMembership = { studio_id: STUDIO_ID, role: 'owner' }
    const pendingInvitation = { id: 'mem-1', status: 'pending' }
    const declinedMembership = {
      id: 'mem-1',
      network_id: NETWORK_ID,
      studio_id: STUDIO_ID,
      status: 'declined',
    }

    const fromFn = vi.fn()
    let callNum = 0
    fromFn.mockImplementation(() => {
      callNum++
      if (callNum === 1) return makeMockTerminal(userMembership)
      if (callNum === 2) return makeMockTerminal(pendingInvitation)
      return makeMockTerminal(declinedMembership)
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/networks/${NETWORK_ID}/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ studioId: STUDIO_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.membership.status).toBe('declined')
  })
})

describe('PUT /api/networks/:networkId/policy — update cross-booking policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates network policy', async () => {
    const network = { id: NETWORK_ID, created_by_studio_id: STUDIO_ID }
    const userMembership = { studio_id: STUDIO_ID, role: 'owner' }
    const policy = {
      network_id: NETWORK_ID,
      allow_cross_booking: true,
      credit_sharing: true,
    }

    const fromFn = vi.fn()
    let callNum = 0
    fromFn.mockImplementation(() => {
      callNum++
      if (callNum === 1) return makeMockTerminal(network)
      if (callNum === 2) return makeMockTerminal(userMembership)
      return makeMockTerminal(policy)
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/networks/${NETWORK_ID}/policy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        studioId: STUDIO_ID,
        allow_cross_booking: true,
        credit_sharing: true,
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.policy.allow_cross_booking).toBe(true)
  })
})

describe('GET /api/studios/:studioId/network-studios — discover partner studios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns partner studios from networks', async () => {
    const networkMemberships = [{ network_id: NETWORK_ID }]
    const partnerMemberships = [
      {
        studio_id: INVITED_STUDIO_ID,
        studio: { id: INVITED_STUDIO_ID, name: 'Partner Studio', slug: 'partner', discipline: 'yoga' },
      },
    ]

    const fromFn = vi.fn()
    let callNum = 0
    fromFn.mockImplementation(() => {
      callNum++
      if (callNum === 1) return makeMockTerminal(networkMemberships)
      return makeMockTerminal(partnerMemberships)
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/network-studios`, {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.studios).toHaveLength(1)
    expect(body.studios[0].name).toBe('Partner Studio')
  })

  it('returns empty array when studio has no networks', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => makeMockTerminal([])),
    } as any)

    const app = makeApp()
    const res = await app.request(`/api/studios/${STUDIO_ID}/network-studios`, {
      headers: { Authorization: 'Bearer test-token' },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.studios).toEqual([])
  })
})

describe('Authorization checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('only network creator studio can invite', async () => {
    const network = { id: NETWORK_ID, created_by_studio_id: 'different-studio' }
    // User is not owner/admin of the creator studio
    const noMembership = null

    const fromFn = vi.fn()
    let callNum = 0
    fromFn.mockImplementation(() => {
      callNum++
      if (callNum === 1) return makeMockTerminal(network)  // fetch network
      if (callNum === 2) return makeMockTerminal(noMembership)  // user not member of creator studio
      return makeMockTerminal(null)
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: fromFn } as any)

    const app = makeApp()
    const res = await app.request(`/api/networks/${NETWORK_ID}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ studioId: INVITED_STUDIO_ID }),
    })
    expect(res.status).toBe(403)
  })
})
