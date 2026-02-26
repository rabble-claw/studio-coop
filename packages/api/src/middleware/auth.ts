import type { MiddlewareHandler } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { unauthorized } from '../lib/errors'

export interface UserPayload {
  id: string
  email: string
  role?: string
}

export type AuthEnv = {
  Variables: {
    user: UserPayload
    accessToken: string
  }
}

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    const err = unauthorized('Missing or invalid Authorization header')
    return c.json(err.toJSON(), err.status as any)
  }

  const token = authHeader.slice(7)
  if (!token) {
    const err = unauthorized('Missing token')
    return c.json(err.toJSON(), err.status as any)
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    const err = unauthorized('Invalid or expired token')
    return c.json(err.toJSON(), err.status as any)
  }

  c.set('user', { id: user.id, email: user.email ?? '' })
  c.set('accessToken', token)
  await next()
}
