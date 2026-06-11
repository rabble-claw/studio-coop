# Studio Co-op

**Community-first studio management. Cooperatively minded. Radically affordable.**

Booking, check-in, class community feeds — built for studios, owned by studios.

## What is this?

Studio Co-op is an open-source studio management platform that combines:
- **Booking & scheduling** with smart confirmation flows that reduce no-shows
- **Teacher check-in** with photo grids (complete attendance in <30 seconds)
- **Class community feeds** visible only to attendees (privacy-first)
- **Discipline-aware features** for pole, BJJ, yoga, CrossFit, cycling, and more

## Why?

Existing studio software (Mindbody, etc.) is expensive, cross-advertises your competitors to your members, and has zero community features. Studio Co-op works *for* studios, never against them.

- **Flat monthly price, everything included** — no feature gates, no per-member price ladder
- **Zero take-rate** — we never take a percentage of your studio's revenue
- **Payment processing at cost** (Stripe's rate, zero markup)
- **Surplus returned to member studios** via patronage rebates

Current pricing model and economics: [research/business-plan-v2-2026-06.md](research/business-plan-v2-2026-06.md)

## Tech Stack

- **Web:** Next.js 15 (App Router)
- **Mobile:** Expo / React Native
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Payments:** Stripe Connect
- **Monorepo:** Turborepo + pnpm

## Structure

```
studio-coop/
├── apps/
│   ├── web/          # Studio dashboard + marketing site
│   └── mobile/       # Member + teacher app
├── packages/
│   ├── shared/       # Types, validation schemas (Zod)
│   └── db/           # Drizzle ORM schema
└── supabase/         # Migrations + config
```

## Development

```bash
pnpm install
pnpm dev
```

## License

AGPL-3.0 — open source, cooperative spirit.
