import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middleware/error-handler'
import plans from './routes/plans'
import webhooks from './routes/webhooks'
import classes from './routes/classes'
import subscriptions from './routes/subscriptions'

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
app.route('/api/subscriptions', subscriptions)
app.route('/api/webhooks', webhooks)

export default app
export { app }
