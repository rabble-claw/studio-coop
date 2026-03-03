# Deployment Guide

## Architecture
- **Database:** Supabase (hosted Postgres + Auth + Realtime + Storage)
- **Web App:** Cloudflare Workers (Next.js via `@opennextjs/cloudflare`) → `studio.coop`
- **API:** Cloudflare Workers (Hono) → `api.studio.coop`
- **Mobile:** Expo / EAS Build
- **Admin:** Cloudflare Workers (planned) → `admin.studio.coop`

## Live URLs
- **Web:** https://studio.coop (backup: https://studio-coop.protestnet.workers.dev)
- **API:** https://api.studio.coop (backup: https://studio-coop-api.protestnet.workers.dev)
- **API Health:** https://api.studio.coop/health

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 9+
- Supabase CLI (`npx supabase init` / `npx supabase start` for local)
- Wrangler CLI (`pnpm add -g wrangler`) for Cloudflare

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/rabble-claw/studio-coop.git
cd studio-coop
pnpm install

# 2. Start Postgres
docker compose up db -d

# 3. Run migrations
psql postgres://studio_coop:studio_coop_dev@localhost:5433/studio_coop < supabase/migrations/001_initial.sql
psql postgres://studio_coop:studio_coop_dev@localhost:5433/studio_coop < supabase/seed.sql

# 4. Copy env vars
cp .env.example .env
# Edit .env with your Stripe keys, etc.

# 5. Start everything
pnpm dev
# Web:  http://localhost:3000
# API:  http://localhost:3001
```

### Docker Compose (full stack)

```bash
docker compose up --build
```

This starts Postgres, the API, and the web app together.

---

## Production Deployment

### Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Link your local project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
3. Push migrations:
   ```bash
   npx supabase db push
   ```
4. Optionally seed: `npx supabase db seed`
5. Note your connection string, anon key, and service role key

### API (Cloudflare Workers)

The Hono API deploys as a Cloudflare Worker with a custom esbuild step:

```bash
cd packages/api

# Set secrets (first time only)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put JWT_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY

# Deploy
wrangler deploy --env=""
```

The build uses `build.mjs` (esbuild) to bundle for Workers, externalizing Node builtins (provided by `nodejs_compat`) and `expo-server-sdk` (dynamically imported for push notifications).

### Web App (Cloudflare Workers via OpenNext)

```bash
cd apps/web

# Build and deploy
npx @opennextjs/cloudflare build
npx wrangler deploy

# Or use the shorthand:
pnpm deploy
```

**Environment variables** are set in `wrangler.jsonc`. For secrets:
```bash
cd apps/web
wrangler secret put NEXT_PUBLIC_SUPABASE_URL
wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Custom Domains

DNS for `studio.coop` is managed by Cloudflare (zone: `a5b77a4ea14830fa6fe265811f0f5ef1`).

Routes are configured in the wrangler configs:
- `studio.coop` + `www.studio.coop` → `studio-coop` Worker (web app)
- `api.studio.coop/*` → `studio-coop-api` Worker (API)

SSL is automatic via Cloudflare.

### Admin Panel

Same as web app but deploy `apps/admin` as a separate Worker at `admin.studio.coop`.

### Mobile App

```bash
cd apps/mobile

# Install EAS CLI
npm install -g eas-cli

# Build for development
eas build --profile development --platform all

# Build for production
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Error Monitoring (Sentry)

Sentry is configured for all three platforms: API, web app, and mobile.

### API (Cloudflare Workers)

The API uses [toucan-js](https://github.com/robertcepa/toucan-js) for Sentry in Workers.
The middleware is at `packages/api/src/middleware/sentry.ts`.

```bash
cd packages/api
wrangler secret put SENTRY_DSN
# Paste your Sentry DSN for the API project
```

### Web App (Next.js)

The web app uses `@sentry/nextjs`. Configuration files:
- `apps/web/sentry.client.config.ts` — browser-side
- `apps/web/sentry.server.config.ts` — server-side (SSR)
- `apps/web/sentry.edge.config.ts` — edge runtime

Error boundaries (`apps/web/src/app/error.tsx` and `global-error.tsx`) automatically
report uncaught exceptions to Sentry.

Set the DSN as an environment variable:
```bash
cd apps/web
wrangler secret put NEXT_PUBLIC_SENTRY_DSN
# Paste your Sentry DSN for the web project
```

### Mobile (Expo / React Native)

The mobile app uses `@sentry/react-native`. Configure the DSN in the Expo environment
or in `apps/mobile/app.json` under the Sentry plugin section.

### Recommended Production Sample Rates

| Setting | Value | Notes |
|---------|-------|-------|
| `tracesSampleRate` | `0.1` (10%) | Keeps costs low while capturing enough data |
| `replaysSessionSampleRate` | `0` | Disable session replay by default |
| `replaysOnErrorSampleRate` | `1.0` (100%) | Capture replay on every error |

---

## Environment Variables Reference

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `SUPABASE_URL` | Yes | API Worker secret | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | API Worker secret | Supabase service role key |
| `SUPABASE_ANON_KEY` | Yes | API Worker secret | Supabase anon key |
| `JWT_SECRET` | Yes | API Worker secret | Secret for signing auth tokens |
| `STRIPE_SECRET_KEY` | Yes | API Worker secret | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | API Worker secret | Stripe webhook signing secret |
| `STRIPE_CONNECT_CLIENT_ID` | For onboarding | API Worker secret | Stripe Connect platform ID |
| `RESEND_API_KEY` | For email | API Worker secret | Resend email service key |
| `NEXT_PUBLIC_API_URL` | Yes | Web Worker var | Public API URL (`https://api.studio.coop`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Web Worker var | Public web app URL (`https://studio.coop`) |
| `NEXT_PUBLIC_APP_NAME` | No | Web Worker var | App display name (default: "Studio Co-op") |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Web Worker secret | Supabase URL for client-side |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Web Worker secret | Supabase anon key for client-side |
| `SENTRY_DSN` | Recommended | API Worker secret | Sentry DSN for API error monitoring |
| `NEXT_PUBLIC_SENTRY_DSN` | Recommended | Web Worker secret | Sentry DSN for web app error monitoring |

---

## CI/CD

GitHub Actions runs on every push and PR:
- Install dependencies
- Type check shared packages
- Lint
- Run tests (with Postgres service)
- Build web app

See `.github/workflows/ci.yml`.

### Supabase Hosted

The project uses hosted Supabase (project: `lomrjhkneodiowwarrzz`, region: Asia-Pacific).

To push migrations to the hosted instance:
```bash
npx supabase db push --project-ref lomrjhkneodiowwarrzz
```
