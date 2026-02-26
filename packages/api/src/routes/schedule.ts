import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, requireOwner } from '../middleware/studio-access'
import { generateClassInstances } from '../lib/class-generator'
import { badRequest, forbidden } from '../lib/errors'

// Mounted at /api/studios and /api/admin — handles generation + schedule view
const schedule = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// Task 2a: Platform admin trigger
// POST /api/admin/generate-classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-level trigger — generates instances for one or all studios.
 * Protected by PLATFORM_ADMIN_KEY environment variable (Bearer token).
 */
schedule.post('/api/admin/generate-classes', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const adminKey = process.env.PLATFORM_ADMIN_KEY

  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    throw forbidden('Invalid platform admin key')
  }

  const body = await c.req.json().catch(() => ({}))
  const studioId: string | undefined = (body as any).studioId
  const weeksAhead: number = Number((body as any).weeksAhead) || 4

  if (studioId) {
    const count = await generateClassInstances(studioId, weeksAhead)
    return c.json({ generated: count, studioId })
  }

  // No studioId → error (we don't expose a "generate all" endpoint by default)
  throw badRequest('studioId is required')
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2b: Studio owner manual trigger
// POST /api/studios/:studioId/generate-classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Studio owner manual trigger — generates class instances for their studio.
 */
schedule.post(
  '/:studioId/generate-classes',
  authMiddleware,
  requireOwner,
  async (c) => {
    const studioId = c.get('studioId' as never) as string
    const body = await c.req.json().catch(() => ({}))
    const weeksAhead: number = Number((body as any).weeksAhead) || 4

    const count = await generateClassInstances(studioId, weeksAhead)
    return c.json({ generated: count, studioId })
  },
)

export { schedule }
export default schedule
