import type { MiddlewareHandler } from 'hono'
import { forbidden, notFound } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'
import type { AuthEnv } from './auth'

type MemberRole = 'member' | 'teacher' | 'admin' | 'owner'

export type StudioEnv = AuthEnv & {
  Variables: AuthEnv['Variables'] & {
    studioId: string
    memberRole: MemberRole
  }
}

/**
 * Middleware that checks the user has one of the required roles
 * in the studio identified by :studioId param.
 */
export function requireRole(...roles: MemberRole[]): MiddlewareHandler<StudioEnv> {
  return async (c, next) => {
    const studioId = c.req.param('studioId')
    if (!studioId) {
      throw new Error('requireRole middleware needs :studioId route param')
    }

    const user = c.get('user')
    const supabase = createServiceClient()

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('studio_id', studioId)
      .eq('status', 'active')
      .single()

    if (!membership) {
      throw notFound('Studio membership')
    }

    if (!roles.includes(membership.role as MemberRole)) {
      throw forbidden(`Requires one of: ${roles.join(', ')}`)
    }

    c.set('studioId', studioId)
    c.set('memberRole', membership.role as MemberRole)
    await next()
  }
}

/**
 * Middleware that just checks the user is any active member of the studio.
 */
export const requireMember: MiddlewareHandler<StudioEnv> =
  requireRole('member', 'teacher', 'admin', 'owner')

export const requireStaff: MiddlewareHandler<StudioEnv> =
  requireRole('teacher', 'admin', 'owner')

export const requireAdmin: MiddlewareHandler<StudioEnv> =
  requireRole('admin', 'owner')

export const requireOwner: MiddlewareHandler<StudioEnv> =
  requireRole('owner')
