# E2E Test Status

**Last updated:** 2026-03-03
**Total:** 100 passed, 0 failed
**Demo project:** 87 passed
**Authenticated project:** 13 passed

---

## All Issues Resolved (2026-03-03)

### Demo Tests (87 passed)

All 15 demo-mode failures caused by the navigation consolidation (commit 6b64086) have been fixed:

| File | Tests Fixed | What Changed |
|------|-------------|--------------|
| `navigation.spec.ts` | 8 | Rewrote for 6-item nav (Overview, Schedule, Members, Money, Reports, Settings). Added tab navigation tests for Money and Reports pages. |
| `demo.spec.ts` | 2 | Plans/Coupons tests now navigate to `/demo/money` and use tab selectors. |
| `member-journey.spec.ts` | 2 | Feed tests now verify Community Feed section on Overview page (`/demo`) instead of removed `/demo/feed` route. |
| `studio-page.spec.ts` | 1 | Plans test now navigates to `/demo/money` instead of clicking removed Plans nav link. |
| `owner-journey.spec.ts` | 1 | Plans test now navigates to `/demo/money` instead of `/demo/plans`. |
| `teacher-journey.spec.ts` | 1 | Roster test no longer hardcodes "Riley" — checks for any status badge (Confirmed/Booked). |
| `public-pages.spec.ts` | 2 | Explore tests tagged `@auth` (require Supabase). Added try-catch to `explore/page.tsx` so page degrades gracefully without DB. |

### Authenticated Tests (13 passed)

All authenticated tests now pass against local Supabase. Issues fixed:

| Issue | Fix |
|-------|-----|
| Seed bcrypt hash didn't match `testpass123!` | Generated correct hash via PostgreSQL's `crypt()` |
| GoTrue v2 NULL column scan error | Set `email_change`, `phone_change`, etc. to empty strings in seed |
| `users_phone_key` unique constraint | Changed `phone` from empty string to NULL in seed |
| `auth.identities.provider_id` format | Changed from email to UUID for Supabase v2 |
| Playwright not loading env vars | Added dotenv config to `playwright.config.ts` |
| Login form placeholder mismatch | Changed selectors from `/email/i` to `/example\.com/i` |
| "Sign in" strict mode (2 elements) | Changed to `{ name: 'Sign in', exact: true }` |
| `POST /api/studios` endpoint missing | Changed setup wizard to use Supabase client directly |
| `country` column doesn't exist | Changed to `country_code` (from migration 013) |
| `public.users` duplicate key on seed | Added `ON CONFLICT (id) DO UPDATE` |
| Member count test timing | Changed to wait for aria-labeled link `Members: N` |
| Schedule card selector fragile | Changed to check for progressbar + class links |
| `getByLabel` not finding inputs | Changed to `getByPlaceholder` (labels lack `htmlFor`) |

### Prerequisites for authenticated tests
- Local Supabase running (`supabase start`)
- Database seeded (`supabase db reset`)
- Root `.env.local` with Supabase credentials
- Symlink: `apps/web/.env.local -> ../../.env.local`
