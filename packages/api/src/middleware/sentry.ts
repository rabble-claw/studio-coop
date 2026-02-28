import { Toucan } from 'toucan-js'
import type { Context, Next } from 'hono'

export async function sentryMiddleware(c: Context, next: Next) {
  const dsn = c.env?.SENTRY_DSN || process.env.SENTRY_DSN
  if (!dsn) {
    await next()
    return
  }

  const sentry = new Toucan({
    dsn,
    request: c.req.raw,
  })

  const user = c.get('user') as { id: string; email: string } | undefined
  if (user) {
    sentry.setUser({ id: user.id, email: user.email })
  }

  c.set('sentry', sentry)

  try {
    await next()
  } catch (error) {
    sentry.captureException(error)
    throw error
  }
}
