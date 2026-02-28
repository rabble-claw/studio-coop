// Multi-studio network management
//
// Mounted at /api/studios in index.ts so paths here are:
//   GET  /:studioId/networks                          — list studio's networks (member)
//   POST /:studioId/networks                          — create a network (owner)
//   GET  /:studioId/networks/:networkId               — get network details with members
//   POST /:studioId/networks/:networkId/invite        — invite a studio to the network
//   DELETE /:studioId/networks/:networkId/members/:memberId — remove a studio from network
//   PUT  /:studioId/networks/:networkId/policy        — update cross-booking policy
//   GET  /discover                                    — list all networks (public)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireOwner, requireMember } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, forbidden, notFound, conflict } from '../lib/errors'

const networks = new Hono()

// ---------------------------------------------------------------------------
// GET /:studioId/networks -- list networks this studio belongs to
// ---------------------------------------------------------------------------

networks.get('/:studioId/networks', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: members } = await supabase
    .from('studio_network_members')
    .select('id, network_id, cross_booking_policy, discount_percent, joined_at, network:studio_networks(id, name, description)')
    .eq('studio_id', studioId)
    .order('joined_at', { ascending: false })

  const result = (members ?? []).map((m) => {
    const net = m.network as unknown as { id: string; name: string; description: string | null } | null
    return {
      id: net?.id ?? m.network_id,
      name: net?.name ?? 'Unknown',
      description: net?.description ?? null,
      cross_booking_policy: m.cross_booking_policy,
      discount_percent: m.discount_percent,
      joined_at: m.joined_at,
    }
  })

  return c.json({ networks: result })
})

// ---------------------------------------------------------------------------
// POST /:studioId/networks -- create a network (owner only)
// ---------------------------------------------------------------------------

networks.post('/:studioId/networks', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const name = body.name as string | undefined
  const description = body.description as string | undefined

  if (!name?.trim()) {
    throw badRequest('Network name is required')
  }

  // Create the network
  const { data: network, error } = await supabase
    .from('studio_networks')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
    })
    .select('*')
    .single()

  if (error || !network) {
    throw badRequest('Failed to create network')
  }

  // Auto-add creator studio as first member
  await supabase.from('studio_network_members').insert({
    network_id: network.id,
    studio_id: studioId,
    cross_booking_policy: 'full_price',
  })

  return c.json({ network }, 201)
})

// ---------------------------------------------------------------------------
// GET /:studioId/networks/:networkId -- get network details with members
// ---------------------------------------------------------------------------

networks.get('/:studioId/networks/:networkId', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const networkId = c.req.param('networkId')
  const supabase = createServiceClient()

  // Verify this studio is a member of the network
  const { data: membership } = await supabase
    .from('studio_network_members')
    .select('id')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .maybeSingle()

  if (!membership) throw notFound('Network membership')

  // Fetch the network
  const { data: network } = await supabase
    .from('studio_networks')
    .select('id, name, description, created_at')
    .eq('id', networkId)
    .single()

  if (!network) throw notFound('Network')

  // Fetch all members with studio info
  const { data: members } = await supabase
    .from('studio_network_members')
    .select('id, studio_id, cross_booking_policy, discount_percent, joined_at, studio:studios(id, name, slug, discipline)')
    .eq('network_id', networkId)
    .order('joined_at', { ascending: true })

  const normalizedMembers = (members ?? []).map((m) => {
    const s = m.studio as unknown as { id: string; name: string; slug: string; discipline: string } | null
    return {
      id: m.id,
      studio_id: m.studio_id,
      studio_name: s?.name ?? 'Unknown',
      studio_slug: s?.slug ?? '',
      discipline: s?.discipline ?? '',
      cross_booking_policy: m.cross_booking_policy,
      discount_percent: m.discount_percent,
      joined_at: m.joined_at,
    }
  })

  return c.json({ network, members: normalizedMembers })
})

// ---------------------------------------------------------------------------
// POST /:studioId/networks/:networkId/invite -- invite a studio to the network
// ---------------------------------------------------------------------------

networks.post('/:studioId/networks/:networkId/invite', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const networkId = c.req.param('networkId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const invitedStudioId = body.studioId as string | undefined

  if (!invitedStudioId) {
    throw badRequest('studioId is required')
  }

  // Verify this studio is a member of the network (only existing members can invite)
  const { data: myMembership } = await supabase
    .from('studio_network_members')
    .select('id')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .maybeSingle()

  if (!myMembership) throw forbidden('Only network members can invite studios')

  // Verify the invited studio exists
  const { data: invitedStudio } = await supabase
    .from('studios')
    .select('id')
    .eq('id', invitedStudioId)
    .maybeSingle()

  if (!invitedStudio) throw notFound('Studio')

  // Check the invited studio isn't already a member (UNIQUE constraint would also catch this)
  const { data: existing } = await supabase
    .from('studio_network_members')
    .select('id')
    .eq('network_id', networkId)
    .eq('studio_id', invitedStudioId)
    .maybeSingle()

  if (existing) {
    throw conflict('Studio is already a member of this network')
  }

  // Add the invited studio as a member
  const { data: member, error } = await supabase
    .from('studio_network_members')
    .insert({
      network_id: networkId,
      studio_id: invitedStudioId,
      cross_booking_policy: 'full_price',
    })
    .select('*')
    .single()

  if (error || !member) {
    throw badRequest('Failed to invite studio')
  }

  return c.json({ member }, 201)
})

// ---------------------------------------------------------------------------
// DELETE /:studioId/networks/:networkId/members/:memberId -- remove a studio from network
// ---------------------------------------------------------------------------

networks.delete('/:studioId/networks/:networkId/members/:memberId', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const networkId = c.req.param('networkId')
  const memberId = c.req.param('memberId')
  const supabase = createServiceClient()

  // Verify this studio is a member of the network
  const { data: myMembership } = await supabase
    .from('studio_network_members')
    .select('id')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .maybeSingle()

  if (!myMembership) throw forbidden('Only network members can remove studios')

  // Find the member to remove
  const { data: targetMember } = await supabase
    .from('studio_network_members')
    .select('id, studio_id')
    .eq('id', memberId)
    .eq('network_id', networkId)
    .maybeSingle()

  if (!targetMember) throw notFound('Network member')

  const { error } = await supabase
    .from('studio_network_members')
    .delete()
    .eq('id', memberId)

  if (error) throw new Error(error.message)

  return c.json({ removed: true, memberId })
})

// ---------------------------------------------------------------------------
// PUT /:studioId/networks/:networkId/policy -- update cross-booking policy
// ---------------------------------------------------------------------------

networks.put('/:studioId/networks/:networkId/policy', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const networkId = c.req.param('networkId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  // Find this studio's membership in the network
  const { data: membership } = await supabase
    .from('studio_network_members')
    .select('id')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .maybeSingle()

  if (!membership) throw notFound('Network membership')

  // Build update payload
  const updates: Record<string, unknown> = {}
  if (typeof body.cross_booking_policy === 'string') {
    const allowed = ['full_price', 'discounted', 'included']
    if (!allowed.includes(body.cross_booking_policy)) {
      throw badRequest(`cross_booking_policy must be one of: ${allowed.join(', ')}`)
    }
    updates.cross_booking_policy = body.cross_booking_policy
  }
  if (typeof body.discount_percent === 'number') {
    if (body.discount_percent < 0 || body.discount_percent > 100) {
      throw badRequest('discount_percent must be between 0 and 100')
    }
    updates.discount_percent = body.discount_percent
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest('No fields to update')
  }

  const { data: updated, error } = await supabase
    .from('studio_network_members')
    .update(updates)
    .eq('id', membership.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw badRequest('Failed to update policy')
  }

  return c.json({ membership: updated })
})

// ---------------------------------------------------------------------------
// GET /:studioId/network-studios -- discover partner studios across networks
// ---------------------------------------------------------------------------

networks.get('/:studioId/network-studios', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  // Find all networks this studio belongs to
  const { data: myMemberships } = await supabase
    .from('studio_network_members')
    .select('network_id')
    .eq('studio_id', studioId)

  const networkIds = (myMemberships ?? []).map((m) => m.network_id)
  if (networkIds.length === 0) {
    return c.json({ studios: [] })
  }

  // Get all other studios in those networks
  const { data: partnerMemberships } = await supabase
    .from('studio_network_members')
    .select('studio_id, studio:studios(id, name, slug, discipline)')
    .in('network_id', networkIds)
    .neq('studio_id', studioId)

  const studios = (partnerMemberships ?? []).map((m) => {
    const s = m.studio as unknown as { id: string; name: string; slug: string; discipline: string } | null
    return s ?? { id: m.studio_id, name: 'Unknown', slug: '', discipline: '' }
  })

  // Deduplicate by studio_id
  const seen = new Set<string>()
  const unique = studios.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })

  return c.json({ studios: unique })
})

// ---------------------------------------------------------------------------
// POST /:networkId/invite -- invite a studio to the network (non-studio-scoped)
// Mounted at /api/networks, so matches /api/networks/:networkId/invite
// ---------------------------------------------------------------------------

networks.post('/:networkId/invite', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const invitedStudioId = body.studioId as string | undefined

  if (!invitedStudioId) {
    throw badRequest('studioId is required')
  }

  // Fetch the network
  const { data: network } = await supabase
    .from('studio_networks')
    .select('id, created_by_studio_id')
    .eq('id', networkId)
    .single()

  if (!network) throw notFound('Network')

  // Check user is admin/owner of the creator studio
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', network.created_by_studio_id)
    .in('role', ['admin', 'owner'])
    .maybeSingle()

  if (!userMembership) throw forbidden('Only the network creator studio can invite')

  // Check not already a member
  const { data: existing } = await supabase
    .from('studio_network_members')
    .select('id')
    .eq('network_id', networkId)
    .eq('studio_id', invitedStudioId)
    .maybeSingle()

  if (existing) throw conflict('Studio is already a member of this network')

  // Insert invitation as pending
  const { data: invitation, error } = await supabase
    .from('studio_network_members')
    .insert({
      network_id: networkId,
      studio_id: invitedStudioId,
      status: 'pending',
      cross_booking_policy: 'full_price',
    })
    .select('*')
    .single()

  if (error || !invitation) throw badRequest('Failed to invite studio')

  return c.json({ invitation }, 201)
})

// ---------------------------------------------------------------------------
// POST /:networkId/accept -- accept a pending network invitation
// ---------------------------------------------------------------------------

networks.post('/:networkId/accept', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const studioId = body.studioId as string | undefined

  if (!studioId) throw badRequest('studioId is required')

  // Check user is admin/owner of the studio
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .in('role', ['admin', 'owner'])
    .maybeSingle()

  if (!userMembership) throw forbidden('Only studio admins/owners can accept invitations')

  // Find the pending invitation
  const { data: pendingInvitation } = await supabase
    .from('studio_network_members')
    .select('id, status')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!pendingInvitation) throw notFound('Pending invitation')

  // Update to active
  const { data: updated, error } = await supabase
    .from('studio_network_members')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('id', pendingInvitation.id)
    .select('*')
    .single()

  if (error || !updated) throw badRequest('Failed to accept invitation')

  return c.json({ membership: updated })
})

// ---------------------------------------------------------------------------
// POST /:networkId/decline -- decline a pending network invitation
// ---------------------------------------------------------------------------

networks.post('/:networkId/decline', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const studioId = body.studioId as string | undefined

  if (!studioId) throw badRequest('studioId is required')

  // Check user is admin/owner of the studio
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .in('role', ['admin', 'owner'])
    .maybeSingle()

  if (!userMembership) throw forbidden('Only studio admins/owners can decline invitations')

  // Find the pending invitation
  const { data: pendingInvitation } = await supabase
    .from('studio_network_members')
    .select('id, status')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!pendingInvitation) throw notFound('Pending invitation')

  // Update to declined
  const { data: updated, error } = await supabase
    .from('studio_network_members')
    .update({ status: 'declined' })
    .eq('id', pendingInvitation.id)
    .select('*')
    .single()

  if (error || !updated) throw badRequest('Failed to decline invitation')

  return c.json({ membership: updated })
})

// ---------------------------------------------------------------------------
// PUT /:networkId/policy -- update cross-booking policy (non-studio-scoped)
// Mounted at /api/networks, so matches /api/networks/:networkId/policy
// ---------------------------------------------------------------------------

networks.put('/:networkId/policy', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user' as never) as { id: string; email: string }
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const studioId = body.studioId as string | undefined

  if (!studioId) throw badRequest('studioId is required')

  // Fetch the network to check creator
  const { data: network } = await supabase
    .from('studio_networks')
    .select('id, created_by_studio_id')
    .eq('id', networkId)
    .single()

  if (!network) throw notFound('Network')

  // Check user is admin/owner of the creator studio
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', network.created_by_studio_id)
    .in('role', ['admin', 'owner'])
    .maybeSingle()

  if (!userMembership) throw forbidden('Only the network creator can update policy')

  // Build update payload
  const updates: Record<string, unknown> = {}
  if (typeof body.allow_cross_booking === 'boolean') {
    updates.allow_cross_booking = body.allow_cross_booking
  }
  if (typeof body.credit_sharing === 'boolean') {
    updates.credit_sharing = body.credit_sharing
  }
  if (typeof body.cross_booking_policy === 'string') {
    updates.cross_booking_policy = body.cross_booking_policy
  }
  if (typeof body.discount_percent === 'number') {
    updates.discount_percent = body.discount_percent
  }

  // Upsert or update the network policy
  const { data: policy, error } = await supabase
    .from('network_policies')
    .upsert({
      network_id: networkId,
      ...updates,
    })
    .select('*')
    .single()

  if (error || !policy) throw badRequest('Failed to update policy')

  return c.json({ policy })
})

// ---------------------------------------------------------------------------
// GET /discover -- list all networks for discovery (public)
// ---------------------------------------------------------------------------

networks.get('/discover', async (c) => {
  const supabase = createServiceClient()

  const { data: allNetworks } = await supabase
    .from('studio_networks')
    .select('id, name, description, created_at')
    .order('created_at', { ascending: false })

  // For each network, get a count of members
  const networkIds = (allNetworks ?? []).map((n) => n.id)

  let memberCounts: Record<string, number> = {}
  if (networkIds.length > 0) {
    const { data: members } = await supabase
      .from('studio_network_members')
      .select('network_id')
      .in('network_id', networkIds)

    for (const m of members ?? []) {
      memberCounts[m.network_id] = (memberCounts[m.network_id] ?? 0) + 1
    }
  }

  const result = (allNetworks ?? []).map((n) => ({
    ...n,
    member_count: memberCounts[n.id] ?? 0,
  }))

  return c.json({ networks: result })
})

export default networks
