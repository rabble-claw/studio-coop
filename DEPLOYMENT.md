# Deployment Guide

## Architecture
- **Database:** Supabase (hosted Postgres + Auth + Realtime + Storage)
- **Web App:** Cloudflare Pages (Next.js via `@cloudflare/next-on-pages`)
- **API:** Cloudflare Workers (Hono)
- **Mobile:** Expo / EAS Build
- **Admin:** Cloudflare Pages

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

The Hono API deploys as a Cloudflare Worker:

```bash
cd packages/api

# Configure wrangler
cat > wrangler.toml << 'EOF'
name = "studio-coop-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NEXT_PUBLIC_APP_URL = "https://studio.coop"

# Secrets (set via wrangler secret put):
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
# STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# RESEND_API_KEY
EOF

# Set secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put JWT_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY

# Deploy
wrangler deploy
```

### Web App (Cloudflare Pages)

```bash
cd apps/web

# Install CF adapter
pnpm add @cloudflare/next-on-pages

# Build for CF Pages
npx @cloudflare/next-on-pages

# Deploy via Wrangler or connect your GitHub repo in the CF dashboard:
# - Build command: npx @cloudflare/next-on-pages
# - Build output directory: apps/web/.vercel/output/static
# - Or connect via CF Pages GitHub integration

# Set environment variables in CF Pages dashboard:
# NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Custom Domain

In Cloudflare dashboard:
1. Add `studio.coop` to your Cloudflare account (transfer DNS from Gandi, or use CF as DNS)
2. Point `studio.coop` to your CF Pages deployment
3. Point `api.studio.coop` to your CF Worker
4. SSL is automatic

### Admin Panel (Cloudflare Pages)

Same as web app but deploy `apps/admin` as a separate CF Pages project at `admin.studio.coop`.

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
