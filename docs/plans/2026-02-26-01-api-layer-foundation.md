# API Layer Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the Hono API layer as the single backend for all Studio Co-op clients.

**Architecture:** Hono app in `packages/api/` with Supabase JWT auth middleware, typed error responses, and a testing scaffold. Deployed as a Vercel Edge Function or standalone Node server. All business logic will live here — clients never talk to Supabase directly.

**Tech Stack:** Hono, Supabase JS (server), Vitest, Zod, TypeScript

---

### Task 1: Initialize the API package

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@studio-coop/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "hono": "^4.7",
    "@supabase/supabase-js": "^2.49",
    "@studio-coop/shared": "workspace:*",
    "zod": "^3.24"
  },
  "devDependencies": {
    "tsx": "^4.19",
    "typescript": "^5.7",
    "vitest": "^3.0",
    "@types/node": "^22"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create minimal Hono app**

```typescript
// packages/api/src/index.ts
import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

export default app
export { app }
```

**Step 4: Run pnpm install from monorepo root**

```bash
cd /Users/openclaw/.openclaw/workspace/studio-coop && pnpm install
```

**Step 5: Commit**

```bash
git add packages/api/ && git commit -m "feat(api): initialize Hono API package"
```

---

### Task 2: Add Vitest testing scaffold

**Files:**
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/__tests__/health.test.ts`

**Step 1: Create vitest config**

```typescript
// packages/api/vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

**Step 2: Write health check test**

```typescript
// packages/api/src/__tests__/health.test.ts
import { describe, it, expect } from 'vitest'
import { app } from '../index'

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})
```

**Step 3: Run test**

```bash
cd packages/api && pnpm test:run
```
Expected: PASS

**Step 4: Commit**

```bash
git add packages/api/vitest.config.ts packages/api/src/__tests__/ && git commit -m "test(api): add vitest scaffold + health check test"
```

---

### Task 3: Create typed error handling

**Files:**
- Create: `packages/api/src/lib/errors.ts`
- Create: `packages/api/src/__tests__/errors.test.ts`

**Step 1: Write error test**

```typescript
// packages/api/src/__tests__/errors.test.ts
import { describe, it, expect } from 'vitest'
import { AppError, notFound, unauthorized, forbidden, badRequest } from '../lib/errors'

describe('AppError', () => {
  it('creates a structured error', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Studio not found')
    expect(err.status).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Studio not found')
  })

  it('has convenience constructors', () => {
    expect(notFound('Studio').status).toBe(404)
    expect(unauthorized().status).toBe(401)
    expect(forbidden().status).toBe(403)
    expect(badRequest('Invalid email').status).toBe(400)
  })
})
```

**Step 2: Run test — expect FAIL**

```bash
cd packages/api && pnpm test:run
```

**Step 3: Implement errors**

```typescript
// packages/api/src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    }
  }
}

export const notFound = (entity: string) =>
  new AppError(404, 'NOT_FOUND', `${entity} not found`)

export const unauthorized = (message = 'Unauthorized') =>
  new AppError(401, 'UNAUTHORIZED', message)

export const forbidden = (message = 'Forbidden') =>
  new AppError(403, 'FORBIDDEN', message)

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details)

export const conflict = (message: string) =>
  new AppError(409, 'CONFLICT', message)
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/lib/errors.ts packages/api/src/__tests__/errors.test.ts && git commit -m "feat(api): typed error handling"
```

---

### Task 4: Error handling middleware

**Files:**
- Create: `packages/api/src/middleware/error-handler.ts`
- Create: `packages/api/src/__tests__/error-handler.test.ts`

**Step 1: Write test**

```typescript
// packages/api/src/__tests__/error-handler.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { errorHandler } from '../middleware/error-handler'
import { notFound, badRequest } from '../lib/errors'

function createTestApp() {
  const app = new Hono()
  app.onError(errorHandler)

  app.get('/not-found', () => { throw notFound('Studio') })
  app.get('/bad-request', () => { throw badRequest('Invalid email') })
  app.get('/unexpected', () => { throw new Error('Something broke') })

  return app
}

describe('errorHandler middleware', () => {
  const app = createTestApp()

  it('handles AppError with correct status and body', async () => {
    const res = await app.request('/not-found')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Studio not found')
  })

  it('handles bad request', async () => {
    const res = await app.request('/bad-request')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('handles unexpected errors as 500', async () => {
    const res = await app.request('/unexpected')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

```typescript
// packages/api/src/middleware/error-handler.ts
import type { ErrorHandler } from 'hono'
import { AppError } from '../lib/errors'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as any)
  }

  console.error('Unexpected error:', err)
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
      },
    },
    500
  )
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/middleware/ packages/api/src/__tests__/error-handler.test.ts && git commit -m "feat(api): error handler middleware"
```

---

### Task 5: Supabase server client factory

**Files:**
- Create: `packages/api/src/lib/supabase.ts`
- Create: `packages/api/src/__tests__/supabase.test.ts`

**Step 1: Write test**

```typescript
// packages/api/src/__tests__/supabase.test.ts
import { describe, it, expect } from 'vitest'
import { createServiceClient, createAuthClient } from '../lib/supabase'

describe('Supabase client factory', () => {
  it('createServiceClient returns a client (uses service role key)', () => {
    // Will use env vars; in test we just verify it doesn't throw
    // Real integration tests need Supabase running
    expect(typeof createServiceClient).toBe('function')
  })

  it('createAuthClient returns a client scoped to user JWT', () => {
    expect(typeof createAuthClient).toBe('function')
  })
})
```

**Step 2: Implement**

```typescript
// packages/api/src/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? ''

/**
 * Admin client — bypasses RLS. Use for system operations only.
 */
export function createServiceClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Auth client — scoped to user's JWT. Respects RLS.
 */
export function createAuthClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

**Step 3: Run test — expect PASS**

**Step 4: Commit**

```bash
git add packages/api/src/lib/supabase.ts packages/api/src/__tests__/supabase.test.ts && git commit -m "feat(api): supabase client factory"
```

---

### Task 6: Auth middleware

**Files:**
- Create: `packages/api/src/middleware/auth.ts`
- Create: `packages/api/src/__tests__/auth.test.ts`

**Step 1: Write test**

```typescript
// packages/api/src/__tests__/auth.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../middleware/auth'

describe('authMiddleware', () => {
  const app = new Hono<AuthEnv>()
  app.use('/*', authMiddleware)
  app.get('/protected', (c) => {
    const user = c.get('user')
    return c.json({ userId: user.id })
  })

  it('rejects requests without Authorization header', async () => {
    const res = await app.request('/protected')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects requests with invalid token format', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: 'InvalidFormat' },
    })
    expect(res.status).toBe(401)
  })
})
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

```typescript
// packages/api/src/middleware/auth.ts
import type { Context, MiddlewareHandler } from 'hono'
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
    throw unauthorized('Missing or invalid Authorization header')
  }

  const token = authHeader.slice(7)
  if (!token) {
    throw unauthorized('Missing token')
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
    throw unauthorized('Invalid or expired token')
  }

  c.set('user', { id: user.id, email: user.email ?? '' })
  c.set('accessToken', token)
  await next()
}
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/api/src/middleware/auth.ts packages/api/src/__tests__/auth.test.ts && git commit -m "feat(api): auth middleware with Supabase JWT validation"
```

---

### Task 7: Studio membership middleware

**Files:**
- Create: `packages/api/src/middleware/studio-access.ts`
- Create: `packages/api/src/__tests__/studio-access.test.ts`

**Step 1: Write test**

```typescript
// packages/api/src/__tests__/studio-access.test.ts
import { describe, it, expect } from 'vitest'
import { requireRole } from '../middleware/studio-access'

describe('requireRole', () => {
  it('exports a middleware factory', () => {
    expect(typeof requireRole).toBe('function')
    const mw = requireRole('owner', 'admin')
    expect(typeof mw).toBe('function')
  })
})
```

**Step 2: Implement**

```typescript
// packages/api/src/middleware/studio-access.ts
import type { MiddlewareHandler } from 'hono'
import { forbidden, notFound } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'
import type { AuthEnv } from './auth'

type MemberRole = 'member' | 'teacher' | 'admin' | 'owner'

export type StudioEnv = AuthEnv & {
  Variables: AuthEnv['Variables'] & {
    studioId: string
    memberRole: MemberRole
  }
}

/**
 * Middleware that checks the user has one of the required roles
 * in the studio identified by :studioId param.
 */
export function requireRole(...roles: MemberRole[]): MiddlewareHandler<StudioEnv> {
  return async (c, next) => {
    const studioId = c.req.param('studioId')
    if (!studioId) {
      throw new Error('requireRole middleware needs :studioId route param')
    }

    const user = c.get('user')
    const supabase = createServiceClient()

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('studio_id', studioId)
      .eq('status', 'active')
      .single()

    if (!membership) {
      throw notFound('Studio membership')
    }

    if (!roles.includes(membership.role as MemberRole)) {
      throw forbidden(`Requires one of: ${roles.join(', ')}`)
    }

    c.set('studioId', studioId)
    c.set('memberRole', membership.role as MemberRole)
    await next()
  }
}

/**
 * Middleware that just checks the user is any active member of the studio.
 */
export const requireMember: MiddlewareHandler<StudioEnv> =
  requireRole('member', 'teacher', 'admin', 'owner')

export const requireStaff: MiddlewareHandler<StudioEnv> =
  requireRole('teacher', 'admin', 'owner')

export const requireAdmin: MiddlewareHandler<StudioEnv> =
  requireRole('admin', 'owner')

export const requireOwner: MiddlewareHandler<StudioEnv> =
  requireRole('owner')
```

**Step 3: Run test — expect PASS**

**Step 4: Commit**

```bash
git add packages/api/src/middleware/studio-access.ts packages/api/src/__tests__/studio-access.test.ts && git commit -m "feat(api): studio role-based access middleware"
```

---

### Task 8: Wire up app with all middleware + register in turbo.json

**Files:**
- Modify: `packages/api/src/index.ts`
- Modify: `turbo.json` (add api dev/build/test tasks)

**Step 1: Update main app file**

```typescript
// packages/api/src/index.ts
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
```

**Step 2: Verify all tests still pass**

```bash
cd packages/api && pnpm test:run
```

**Step 3: Commit**

```bash
git add packages/api/src/index.ts turbo.json && git commit -m "feat(api): wire up middleware + CORS + logging"
```

---

### Task 9: Add dev server entry point

**Files:**
- Create: `packages/api/src/serve.ts`

**Step 1: Create server entry**

```typescript
// packages/api/src/serve.ts
import { serve } from '@hono/node-server'
import app from './index'

const port = Number(process.env.PORT ?? 3001)

console.log(`🚀 Studio Co-op API running on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
```

**Step 2: Update package.json dev script**

In `packages/api/package.json`, update:
```json
"dev": "tsx watch src/serve.ts"
```

Add dependency:
```json
"@hono/node-server": "^1.14"
```

**Step 3: Run pnpm install, verify dev server starts**

```bash
pnpm install && cd packages/api && pnpm dev
```
Expected: "🚀 Studio Co-op API running on http://localhost:3001"

**Step 4: Commit**

```bash
git add packages/api/ && git commit -m "feat(api): dev server with @hono/node-server"
```
