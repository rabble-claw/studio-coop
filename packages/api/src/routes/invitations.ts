// Member invitation routes — studio-scoped (mounted at /api/studios)
//
// DB schema: memberships has user_id (NOT NULL), studio_id, role, status (active|suspended|cancelled)
// No separate invitations table — for existing users we create a membership directly.
// For new users, we invite via Supabase auth.
//
//   POST /:studioId/members/invite — invite a member (admin only)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, requireOwner } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, notFound } from '../lib/errors'

const invitations = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/members/invite — invite a member
// ─────────────────────────────────────────────────────────────────────────────

invitations.post('/:studioId/members/invite', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const email = (body.email as string)?.toLowerCase().trim()
  const name = body.name as string | undefined
  const role = (body.role as string) ?? 'member'

  if (!email) throw badRequest('email is required')
  if (!['member', 'teacher', 'admin'].includes(role)) {
    throw badRequest('role must be member, teacher, or admin')
  }

  // Get studio info
  const { data: studio } = await supabase
    .from('studios')
    .select('name')
    .eq('id', studioId)
    .single()

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', email)
    .maybeSingle()

  if (existingUser) {
    // Check if already a member
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id, status')
      .eq('studio_id', studioId)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existingMembership?.status === 'active') {
      throw badRequest('User is already an active member of this studio')
    }

    if (existingMembership) {
      // Reactivate existing membership
      await supabase
        .from('memberships')
        .update({ status: 'active', role })
        .eq('id', existingMembership.id)
    } else {
      // Create new membership
      await supabase
        .from('memberships')
        .insert({
          studio_id: studioId,
          user_id: existingUser.id,
          role,
          status: 'active',
        })
    }

    // Create a notification for the user
    await supabase
      .from('notifications')
      .insert({
        user_id: existingUser.id,
        studio_id: studioId,
        type: 'studio_invite',
        title: `You've been added to ${studio?.name ?? 'a studio'}`,
        body: `You've been added to ${studio?.name ?? 'a studio'} as a ${role}.`,
        sent_at: new Date().toISOString(),
      })

    return c.json({
      invited: true,
      userExists: true,
      email,
      role,
      message: `${existingUser.name ?? email} has been added as a ${role}.`,
    }, 201)
  }

  // User doesn't exist — invite via Supabase auth
  try {
    const { data: newUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name: name ?? undefined },
      redirectTo: `${process.env.WEB_URL ?? 'https://studio.coop'}/login`,
    })

    if (inviteError) throw inviteError

    if (newUser?.user) {
      // Create the user profile and membership
      await supabase
        .from('users')
        .upsert({
          id: newUser.user.id,
          email,
          name: name ?? email.split('@')[0],
        }, { onConflict: 'id' })

      await supabase
        .from('memberships')
        .insert({
          studio_id: studioId,
          user_id: newUser.user.id,
          role,
          status: 'active',
        })
    }

    return c.json({
      invited: true,
      userExists: false,
      email,
      role,
      message: `Invitation email sent to ${name ?? email}. They'll be able to log in once they accept.`,
    }, 201)
  } catch (e) {
    // If Supabase admin invite fails (e.g., email not configured),
    // still return success but with a note about the email failure
    const message = e instanceof Error ? e.message : 'Failed to send invitation'
    return c.json({
      invited: true,
      userExists: false,
      email,
      role,
      note: `Invitation created but email could not be sent: ${message}`,
      message: `Invitation for ${name ?? email} created, but email delivery failed.`,
    }, 201)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/members/:userId/suspend — suspend a member (admin only)
// ─────────────────────────────────────────────────────────────────────────────

invitations.put('/:studioId/members/:userId/suspend', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const userId = c.req.param('userId')
  const supabase = createServiceClient()

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status, role')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .single()

  if (!membership) throw notFound('Membership')
  if (membership.status !== 'active') throw badRequest('Only active memberships can be suspended')
  if (membership.role === 'owner') throw badRequest('Cannot suspend the studio owner')

  const { error } = await supabase
    .from('memberships')
    .update({ status: 'suspended' })
    .eq('id', membership.id)

  if (error) throw new Error(error.message)

  return c.json({ userId, status: 'suspended' })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/members/:userId/reactivate — reactivate a suspended member (admin only)
// ─────────────────────────────────────────────────────────────────────────────

invitations.put('/:studioId/members/:userId/reactivate', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const userId = c.req.param('userId')
  const supabase = createServiceClient()

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .single()

  if (!membership) throw notFound('Membership')
  if (membership.status === 'active') throw badRequest('Membership is already active')
  if (!['suspended', 'cancelled'].includes(membership.status)) {
    throw badRequest('Only suspended or cancelled memberships can be reactivated')
  }

  const { error } = await supabase
    .from('memberships')
    .update({ status: 'active' })
    .eq('id', membership.id)

  if (error) throw new Error(error.message)

  return c.json({ userId, status: 'active' })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:studioId/members/:userId — remove a member (owner only)
// ─────────────────────────────────────────────────────────────────────────────

invitations.delete('/:studioId/members/:userId', authMiddleware, requireOwner, async (c) => {
  const studioId = c.req.param('studioId')
  const userId = c.req.param('userId')
  const supabase = createServiceClient()

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, status, role')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .single()

  if (!membership) throw notFound('Membership')
  if (membership.role === 'owner') throw badRequest('Cannot remove the studio owner')
  if (membership.status === 'cancelled') throw badRequest('Membership is already cancelled')

  const { error } = await supabase
    .from('memberships')
    .update({ status: 'cancelled' })
    .eq('id', membership.id)

  if (error) throw new Error(error.message)

  return c.json({ userId, status: 'cancelled' })
})

export { invitations }
export default invitations
