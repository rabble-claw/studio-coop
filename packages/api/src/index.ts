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
import feed, { postFeed } from './routes/feed'
import { upload } from './routes/upload'
import networks from './routes/networks'
import migration from './routes/migration'
import { stripeRoutes } from './routes/stripe'
import featureFlags from './routes/feature-flags'
import governance from './routes/governance'
import discover from './routes/discover'
import { getConfig } from './lib/config'

// Validate environment configuration at startup — fail fast in production
try {
  getConfig()
} catch (e) {
  const msg = (e as Error).message
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Startup aborted: ${msg}`)
  }
  console.warn('Environment config validation warning:', msg)
}

const app = new Hono()

// Global middleware
app.use('*', sentryMiddleware)
app.use('*', logger())
app.use('*', cors({
  origin: [
    'http://localhost:3000',      // web dev
    'http://localhost:8081',      // expo dev
    'https://studio.coop',       // production
    process.env.WEB_URL ?? '',
  ].filter(Boolean),
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

export default app
export { app }
