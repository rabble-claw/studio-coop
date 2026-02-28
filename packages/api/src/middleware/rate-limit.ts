import type { MiddlewareHandler } from 'hono'

/**
 * Simple rate-limit middleware for Cloudflare Workers.
 *
 * This uses an in-memory Map, which resets on each Worker cold-start.
 * For production, configure Cloudflare's built-in rate limiting at the zone
 * level (dashboard → Security → WAF → Rate limiting rules) which provides
 * durable, distributed enforcement.
 *
 * This middleware still adds standard rate-limit headers so clients can
 * self-throttle even if the zone-level rules are the real enforcement.
 */

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

// Periodic cleanup to prevent unbounded memory growth
const CLEANUP_INTERVAL_MS = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) {
      buckets.delete(key)
    }
  }
}

export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const { limit, windowSeconds } = config
  const windowMs = windowSeconds * 1000

  return async (c, next) => {
    cleanup()

    // Use CF-Connecting-IP (Cloudflare sets this), fall back to X-Forwarded-For
    const ip = c.req.header('cf-connecting-ip')
      ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'unknown'

    const path = new URL(c.req.url).pathname
    const key = `${ip}:${path}`
    const now = Date.now()

    let entry = buckets.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      buckets.set(key, entry)
    }

    entry.count++
    const remaining = Math.max(0, limit - entry.count)
    const resetEpoch = Math.ceil(entry.resetAt / 1000)

    // Set standard rate-limit response headers
    c.header('RateLimit-Limit', String(limit))
    c.header('RateLimit-Remaining', String(remaining))
    c.header('RateLimit-Reset', String(resetEpoch))

    if (entry.count > limit) {
      c.header('Retry-After', String(windowSeconds))
      return c.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
        429
      )
    }

    await next()
  }
}
