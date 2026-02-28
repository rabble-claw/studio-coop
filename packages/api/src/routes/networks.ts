// Multi-studio network management
//
// Mounted at /api/studios and /api/networks in index.ts so paths here are:
//   POST /:studioId/networks            — create a network (owner)
//   GET  /:studioId/networks            — list studio's networks (member)
//   GET  /:studioId/network-studios     — discover partner studios (member)
//   POST /:networkId/invite             — invite studio to network
//   POST /:networkId/accept             — accept invitation
//   POST /:networkId/decline            — decline invitation
//   PUT  /:networkId/policy             — update cross-booking policy

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireOwner, requireMember } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, forbidden, notFound, conflict } from '../lib/errors'

const networks = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/networks — create a network (owner only)
// ─────────────────────────────────────────────────────────────────────────────

networks.post('/:studioId/networks', authMiddleware, requireOwner, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const name = body.name as string | undefined
  const description = body.description as string | undefined

  if (!name?.trim()) {
    throw badRequest('Network name is required')
  }

  const { data: network, error } = await supabase
    .from('networks')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      created_by_studio_id: studioId,
    })
    .select('*')
    .single()

  if (error || !network) {
    throw badRequest('Failed to create network')
  }

  // Auto-add creator studio as active member
  await supabase.from('network_memberships').insert({
    network_id: network.id,
    studio_id: studioId,
    status: 'active',
    joined_at: new Date().toISOString(),
  })

  // Create default policy
  await supabase.from('network_policies').insert({
    network_id: network.id,
    allow_cross_booking: false,
    credit_sharing: false,
  })

  return c.json({ network }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/networks — list networks this studio belongs to
// ─────────────────────────────────────────────────────────────────────────────

networks.get('/:studioId/networks', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: memberships } = await supabase
    .from('network_memberships')
    .select('network_id, status, network:networks(id, name, description, created_by_studio_id)')
    .eq('studio_id', studioId)
    .order('network_id')

  const result = (memberships ?? []).map((m) => {
    const net = m.network as unknown as { id: string; name: string; description: string | null; created_by_studio_id: string } | null
    return {
      id: net?.id ?? m.network_id,
      name: net?.name ?? 'Unknown',
      description: net?.description ?? null,
      created_by_studio_id: net?.created_by_studio_id ?? null,
      status: m.status,
    }
  })

  return c.json({ networks: result })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/network-studios — discover partner studios
// ─────────────────────────────────────────────────────────────────────────────

networks.get('/:studioId/network-studios', authMiddleware, requireMember, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  // Get all network IDs for this studio
  const { data: myNetworks } = await supabase
    .from('network_memberships')
    .select('network_id')
    .eq('studio_id', studioId)
    .eq('status', 'active')

  if (!myNetworks || myNetworks.length === 0) {
    return c.json({ studios: [] })
  }

  const networkIds = myNetworks.map((n) => n.network_id)

  // Get all other studios in those networks
  const { data: partnerMemberships } = await supabase
    .from('network_memberships')
    .select('studio_id, studio:studios(id, name, slug, discipline)')
    .in('network_id', networkIds)
    .neq('studio_id', studioId)
    .eq('status', 'active')

  // Deduplicate by studio_id
  const seen = new Set<string>()
  const studios = (partnerMemberships ?? [])
    .filter((m) => {
      if (seen.has(m.studio_id)) return false
      seen.add(m.studio_id)
      return true
    })
    .map((m) => {
      const s = m.studio as unknown as { id: string; name: string; slug: string; discipline: string } | null
      return {
        id: s?.id ?? m.studio_id,
        name: s?.name ?? 'Unknown',
        slug: s?.slug ?? '',
        discipline: s?.discipline ?? '',
      }
    })

  return c.json({ studios })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:networkId/invite — invite a studio to the network
// ─────────────────────────────────────────────────────────────────────────────

networks.post('/:networkId/invite', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const invitedStudioId = body.studioId as string | undefined
  const inviterStudioId = body.inviterStudioId as string | undefined

  if (!invitedStudioId) {
    throw badRequest('studioId is required')
  }

  // Verify the network exists and check ownership
  const { data: network } = await supabase
    .from('networks')
    .select('id, created_by_studio_id')
    .eq('id', networkId)
    .single()

  if (!network) throw notFound('Network')

  // The user must be an owner/admin of the creator studio
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', network.created_by_studio_id)
    .eq('status', 'active')
    .single()

  if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
    throw forbidden('Only the network creator studio can invite others')
  }

  // Check the invited studio isn't already a member
  const { data: existing } = await supabase
    .from('network_memberships')
    .select('id, status')
    .eq('network_id', networkId)
    .eq('studio_id', invitedStudioId)
    .maybeSingle()

  if (existing) {
    throw conflict(`Studio already ${existing.status} in this network`)
  }

  const { data: invitation, error } = await supabase
    .from('network_memberships')
    .insert({
      network_id: networkId,
      studio_id: invitedStudioId,
      status: 'pending',
      invited_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !invitation) {
    throw badRequest('Failed to send invitation')
  }

  return c.json({ invitation }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:networkId/accept — accept a network invitation
// ─────────────────────────────────────────────────────────────────────────────

networks.post('/:networkId/accept', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const studioId = body.studioId as string | undefined

  if (!studioId) {
    throw badRequest('studioId is required')
  }

  // User must be owner/admin of the invited studio
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .single()

  if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
    throw forbidden('Only studio owner/admin can accept invitations')
  }

  // Find the pending invitation
  const { data: invitation } = await supabase
    .from('network_memberships')
    .select('id, status')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .single()

  if (!invitation) throw notFound('Invitation')
  if (invitation.status !== 'pending') {
    throw badRequest(`Invitation is already ${invitation.status}`)
  }

  const { data: updated, error } = await supabase
    .from('network_memberships')
    .update({ status: 'active', joined_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw badRequest('Failed to accept invitation')
  }

  return c.json({ membership: updated })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:networkId/decline — decline a network invitation
// ─────────────────────────────────────────────────────────────────────────────

networks.post('/:networkId/decline', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const studioId = body.studioId as string | undefined

  if (!studioId) {
    throw badRequest('studioId is required')
  }

  // User must be owner/admin of the invited studio
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .single()

  if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
    throw forbidden('Only studio owner/admin can decline invitations')
  }

  // Find the pending invitation
  const { data: invitation } = await supabase
    .from('network_memberships')
    .select('id, status')
    .eq('network_id', networkId)
    .eq('studio_id', studioId)
    .single()

  if (!invitation) throw notFound('Invitation')
  if (invitation.status !== 'pending') {
    throw badRequest(`Invitation is already ${invitation.status}`)
  }

  const { data: updated, error } = await supabase
    .from('network_memberships')
    .update({ status: 'declined' })
    .eq('id', invitation.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw badRequest('Failed to decline invitation')
  }

  return c.json({ membership: updated })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:networkId/policy — update cross-booking policy
// ─────────────────────────────────────────────────────────────────────────────

networks.put('/:networkId/policy', authMiddleware, async (c) => {
  const networkId = c.req.param('networkId')
  const user = c.get('user')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const studioId = body.studioId as string | undefined

  // Verify network exists
  const { data: network } = await supabase
    .from('networks')
    .select('id, created_by_studio_id')
    .eq('id', networkId)
    .single()

  if (!network) throw notFound('Network')

  // Only the creator studio's owner/admin can update policy
  const creatorStudioId = studioId ?? network.created_by_studio_id
  const { data: userMembership } = await supabase
    .from('memberships')
    .select('studio_id, role')
    .eq('user_id', user.id)
    .eq('studio_id', network.created_by_studio_id)
    .eq('status', 'active')
    .single()

  if (!userMembership || !['owner', 'admin'].includes(userMembership.role)) {
    throw forbidden('Only the network creator can update policy')
  }

  const policyData: Record<string, unknown> = { network_id: networkId }
  if (typeof body.allow_cross_booking === 'boolean') policyData.allow_cross_booking = body.allow_cross_booking
  if (typeof body.credit_sharing === 'boolean') policyData.credit_sharing = body.credit_sharing

  const { data: policy, error } = await supabase
    .from('network_policies')
    .upsert(policyData, { onConflict: 'network_id' })
    .select('*')
    .single()

  if (error || !policy) {
    throw badRequest('Failed to update policy')
  }

  return c.json({ policy })
})

export default networks
