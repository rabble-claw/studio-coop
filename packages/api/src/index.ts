import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middleware/error-handler'
import plans from './routes/plans'
import webhooks from './routes/webhooks'
import classes from './routes/classes'
import subscriptions from './routes/subscriptions'
import schedule from './routes/schedule'
import bookings from './routes/bookings'
import my from './routes/my'
import checkin from './routes/checkin'
import attendance from './routes/attendance'
import notifications from './routes/notifications'
import jobs from './routes/jobs'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: [
    'http://localhost:3000',      // web dev
    'http://localhost:8081',      // expo dev
    process.env.WEB_URL ?? '',
  ].filter(Boolean),
  credentials: true,
}))

// Error handler
app.onError(errorHandler)

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
app.route('/api/my', notifications)
app.route('/api/jobs', jobs)

export default app
export { app }
