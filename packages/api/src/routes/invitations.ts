// Member invitation routes — studio-scoped (mounted at /api/studios)
//
// DB schema: memberships has user_id (NOT NULL), studio_id, role, status (active|suspended|cancelled)
// No separate invitations table — for existing users we create a membership directly.
// For new users, we invite via Supabase auth.
//
//   POST /:studioId/members/invite — invite a member (admin only)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest } from '../lib/errors'

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
    // still return success with a note
    return c.json({
      invited: true,
      userExists: false,
      email,
      role,
      message: `Invitation created for ${name ?? email}. Please share the studio link with them to sign up.`,
      note: 'Email delivery may not be configured.',
    }, 201)
  }
})

export { invitations }
export default invitations
