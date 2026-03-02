import type { MiddlewareHandler } from 'hono'
import { forbidden } from '../lib/errors'
import type { AuthEnv } from './auth'

/**
 * Middleware that restricts access to platform-level admins.
 * Checks the authenticated user's ID against PLATFORM_ADMIN_IDS env var
 * (comma-separated list of Supabase user UUIDs).
 */
export const requirePlatformAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const user = c.get('user')
  const adminIds = (process.env.PLATFORM_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)

  if (!adminIds.includes(user.id)) {
    const err = forbidden('Platform admin required')
    return c.json(err.toJSON(), err.status as any)
  }

  await next()
}
