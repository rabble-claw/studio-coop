# Deployment Guide

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (for Postgres)

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

### Web App (Vercel)

The web app deploys to Vercel automatically on push to `main`.

1. Import the repo in Vercel
2. Set framework to Next.js
3. Set root directory to `apps/web` (or use the `vercel.json` config)
4. Add environment variables:
   - `DATABASE_URL` — production Postgres connection string
   - `JWT_SECRET` — secure random string
   - `STRIPE_SECRET_KEY` — live Stripe key
   - `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard
   - `NEXT_PUBLIC_API_URL` — URL of the deployed API
   - `NEXT_PUBLIC_APP_URL` — Vercel deployment URL
   - `RESEND_API_KEY` — for email notifications

### API (standalone or Vercel)

**Option A: Vercel Edge Functions**
The API can be deployed as a Vercel Edge Function alongside the web app. Add a catch-all API route that proxies to the Hono app.

**Option B: Standalone (VPS/Docker)**
```bash
docker build -f packages/api/Dockerfile -t studio-coop-api .
docker run -p 3001:3001 \
  -e DATABASE_URL=postgres://... \
  -e JWT_SECRET=... \
  -e STRIPE_SECRET_KEY=... \
  studio-coop-api
```

### Database

**Option A: Supabase (hosted Postgres)**
- Create a project at supabase.com
- Run migrations via the Supabase CLI or dashboard
- Use the connection string for `DATABASE_URL`

**Option B: Self-hosted Postgres**
- Any PostgreSQL 16+ instance
- Run `supabase/migrations/*.sql` in order
- Optionally run `supabase/seed.sql` for demo data

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

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes | Secret for signing auth tokens |
| `STRIPE_SECRET_KEY` | Yes | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_CONNECT_CLIENT_ID` | For onboarding | Stripe Connect platform ID |
| `RESEND_API_KEY` | For email | Resend email service key |
| `RESEND_FROM_EMAIL` | For email | Sender email address |
| `NEXT_PUBLIC_API_URL` | Yes | Public API URL |
| `NEXT_PUBLIC_APP_URL` | Yes | Public web app URL |
| `NEXT_PUBLIC_APP_NAME` | No | App display name (default: "Studio Co-op") |

---

## CI/CD

GitHub Actions runs on every push and PR:
- Install dependencies
- Type check shared packages
- Lint
- Run tests (with Postgres service)
- Build web app

See `.github/workflows/ci.yml`.

## Cloudflare Pages Deployment

### Setup

1. Connect the repo to Cloudflare Pages
2. Set build settings:
   - **Build command:** `cd apps/web && npx @cloudflare/next-on-pages`
   - **Build output directory:** `apps/web/.vercel/output/static`
   - **Root directory:** `/`
3. Add environment variables in Cloudflare dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Pages URL)
   - `NEXT_PUBLIC_APP_NAME`

### Local Preview

```bash
cd apps/web
pnpm build:cf-pages
pnpm preview:cf
```

### Supabase Hosted

The project uses hosted Supabase (project: `lomrjhkneodiowwarrzz`, region: Asia-Pacific).

To push migrations to the hosted instance:
```bash
npx supabase db push --project-ref lomrjhkneodiowwarrzz
```
