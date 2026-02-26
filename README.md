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

- **Free tier** for studios up to 100 members
- **$19/mo** for unlimited members + full features
- **$39/mo** for branded app + multi-location
- **Payment processing at cost** (Stripe's rate, zero markup)

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
