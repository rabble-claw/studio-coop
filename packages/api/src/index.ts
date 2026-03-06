import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middleware/error-handler'
import { sentryMiddleware } from './middleware/sentry'
import { rateLimit } from './middleware/rate-limit'
import plans from './routes/plans'
import webhooks from './routes/webhooks'
import classes from './routes/classes'
import subscriptions from './routes/subscriptions'
import schedule from './routes/schedule'
import bookings from './routes/bookings'
import my from './routes/my'
import checkin from './routes/checkin'
import attendance from './routes/attendance'
import comps from './routes/comps'
import coupons from './routes/coupons'
import notifications from './routes/notifications'
import jobs from './routes/jobs'
import studioSettings from './routes/studio-settings'
import privateBookings from './routes/private-bookings'
import reports from './routes/reports'
import invitations from './routes/invitations'
import memberRoutes from './routes/members'
import templates from './routes/templates'
import feed, { postFeed } from './routes/feed'
import { upload } from './routes/upload'
import networks from './routes/networks'
import migration from './routes/migration'
import { stripeRoutes } from './routes/stripe'
import featureFlags from './routes/feature-flags'
import governance from './routes/governance'
import discover from './routes/discover'
import achievements from './routes/achievements'
import skills from './routes/skills'
import subRequests from './routes/sub-requests'
import finances from './routes/finances'
import calendarFeed from './routes/calendar-feed'
import exportRoute from './routes/export'
import manualBilling from './routes/manual-billing'
import social from './routes/social'
import retention from './routes/retention'
import weeklyBrief from './routes/weekly-brief'
import scheduleEfficiency from './routes/schedule-efficiency'
import { getConfig } from './lib/config'

// Validate environment configuration at startup (best-effort).
// In Cloudflare Workers, secrets are only available via the `env` binding at
// request time, NOT through `process.env`, so this will always warn in Workers.
try {
  getConfig()
} catch (e) {
  console.warn('Environment config validation warning:', (e as Error).message)
}

const app = new Hono()

// Global middleware
app.use('*', sentryMiddleware)
app.use('*', logger())

// Security headers — applied before CORS so they appear on all responses
app.use('*', async (c, next) => {
  await next()
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
})

const corsOrigins = [
  'https://studio.coop',
  process.env.WEB_URL ?? '',
].filter(Boolean)

if (process.env.ENVIRONMENT !== 'production') {
  corsOrigins.push('http://localhost:3000', 'http://localhost:8081')
}

app.use('*', cors({
  origin: corsOrigins,
  credentials: true,
}))

// Error handler
app.onError(errorHandler)

// Rate limiting on sensitive endpoints (L13)
// For production, also configure Cloudflare WAF rate limiting at the zone level.
app.use('/api/discover/*', rateLimit({ limit: 30, windowSeconds: 60 }))
app.use('/api/studios/*/classes/*/book', rateLimit({ limit: 10, windowSeconds: 60 }))
app.use('/api/studios/*/coupons/redeem', rateLimit({ limit: 5, windowSeconds: 60 }))
app.use('/api/my/push-token', rateLimit({ limit: 5, windowSeconds: 60 }))
app.use('/api/cal/*', rateLimit({ limit: 60, windowSeconds: 3600 }))

// Health check (no auth)
app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version ?? '0.0.1',
}))

// Route groups
app.route('/api/studios', plans)
app.route('/api/studios', classes)
app.route('/api/studios', schedule)
app.route('/api/studios', bookings)
app.route('/api/subscriptions', subscriptions)
app.route('/api/webhooks', webhooks)
app.route('/api', my)
app.route('/', schedule)  // for /api/admin/generate-classes
app.route('/api/classes', checkin)
app.route('/api/studios', attendance)
app.route('/api/my', attendance)
app.route('/api/studios', comps)
app.route('/api/my', comps)
app.route('/api/studios', coupons)
app.route('/api/my', notifications)
app.route('/api/jobs', jobs)
app.route('/api/studios', studioSettings)
app.route('/api/studios', privateBookings)
app.route('/api/studios', reports)
app.route('/api/studios', memberRoutes)
app.route('/api/studios', templates)
app.route('/api/studios', invitations)
app.route('/api/classes', feed)
app.route('/api/feed', postFeed)
app.route('/api/upload', upload)
app.route('/api/studios', networks)
app.route('/api/networks', networks)
app.route('/api/studios', migration)
app.route('/api/studios', stripeRoutes)
app.route('/api/admin', featureFlags)
app.route('/api/studios', featureFlags)
app.route('/api/governance', governance)
app.route('/api/discover', discover)
app.route('/api/studios', achievements)
app.route('/api/studios', skills)
app.route('/api/studios', subRequests)
app.route('/api/studios', finances)
app.route('/api/studios', manualBilling)
app.route('/api/studios', social)
app.route('/api/studios', retention)
app.route('/api/studios', weeklyBrief)
app.route('/api/studios', scheduleEfficiency)
app.route('/api', calendarFeed)
app.route('/api', exportRoute)

export default {
  fetch: app.fetch,
  async scheduled(event: { scheduledTime: number; cron: string }, env: Record<string, string>, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    const cronSecret = env.CRON_SECRET || process.env.CRON_SECRET
    if (!cronSecret) return

    const baseUrl = 'http://localhost'
    const headers = { 'Authorization': `Bearer ${cronSecret}`, 'Content-Type': 'application/json' }

    // Reminders — every hour
    ctx.waitUntil(Promise.resolve(app.fetch(new Request(`${baseUrl}/api/jobs/reminders`, { method: 'POST', headers }))))

    // Daily jobs — run at midnight UTC (hour 0)
    const hour = new Date(event.scheduledTime).getUTCHours()
    if (hour === 0) {
      ctx.waitUntil(Promise.resolve(app.fetch(new Request(`${baseUrl}/api/jobs/reengagement`, { method: 'POST', headers }))))
      ctx.waitUntil(Promise.resolve(app.fetch(new Request(`${baseUrl}/api/jobs/generate-classes`, { method: 'POST', headers }))))
      ctx.waitUntil(Promise.resolve(app.fetch(new Request(`${baseUrl}/api/jobs/onboarding`, { method: 'POST', headers }))))
    }

    // Daily retention scoring — run at 1am UTC
    if (hour === 1) {
      ctx.waitUntil(Promise.resolve(app.fetch(new Request(`${baseUrl}/api/jobs/retention-scores`, { method: 'POST', headers }))))
    }

    // Weekly brief — run at 18:00 UTC Sunday (6am Monday NZST)
    const dayOfWeek = new Date(event.scheduledTime).getUTCDay()
    if (dayOfWeek === 0 && hour === 18) {
      ctx.waitUntil(Promise.resolve(app.fetch(new Request(`${baseUrl}/api/jobs/weekly-brief`, { method: 'POST', headers }))))
    }
  },
}
export { app }
