import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { errorHandler } from './middleware/error-handler'

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

// Route groups will be added here:
// app.route('/api/studios', studioRoutes)
// app.route('/api/classes', classRoutes)
// app.route('/api/bookings', bookingRoutes)
// etc.

export default app
export { app }
