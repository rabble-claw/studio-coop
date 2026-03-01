# Studio Co-op — Remaining Work Roadmap

Last updated: 2026-03-01

## Status Summary

- **API tests**: 582 passing (55 files)
- **API build**: Clean
- **Web build**: Clean
- **Migration 014**: Schema fixes applied (missing columns, indexes, RLS, RPCs)
- **Sentry**: Configured for API, web, and mobile

---

## Remaining Work

| # | Issue | Priority | Details |
|---|-------|----------|---------|
| D4 | Custom Domain — "Coming soon" | P1 | `apps/web/src/app/dashboard/settings/page.tsx` |
| D5 | Custom Email Domain — "Coming soon" | P1 | `apps/web/src/app/dashboard/settings/page.tsx` |
| E5 | Social links error handling | P2 | `apps/mobile/src/app/(public)/studio/[slug].tsx` |
| M8 | Cancellation settings path mismatch | P2 | `my.ts` reads wrong settings key for cancellation window |
| M19 | Private booking type mapping | P2 | "Corporate Event" maps to `party` instead of `group` |

---

## Previously Fixed (This Sprint)

- [x] Templates CRUD API: GET/POST/PUT/DELETE with 13 tests (A1-A4)
- [x] Members API: list/detail/notes with 17 tests (A5-A7)
- [x] Studio-wide bookings endpoint (A8)
- [x] Plan subscribers endpoint (A9)
- [x] Class instance detail endpoint (A10/B4)
- [x] User profile GET/PUT endpoints (B1-B2)
- [x] User memberships/studios endpoint (B3)
- [x] Mobile feed API paths fixed (C1-C3)
- [x] Mobile attendance path fixed (C4)
- [x] Mobile batch checkin path + body format fixed (C5)
- [x] Mobile push-token path fixed (/me/ → /my/)
- [x] Mobile notification preferences path fixed (/me/ → /my/)
- [x] Mobile comps + subscription paths fixed
- [x] Notification preferences button handler (D1)
- [x] Payment methods button handler (D2)
- [x] Payment deep link handling (D3)
- [x] Admin hardcoded UUID replaced with auth user (D6)
- [x] Notification mark-read error handling (E1)
- [x] Coupon deactivation error handling (E2)
- [x] Stripe refresh link error handling (E3)
- [x] Feed placeholder classId fixed (E4)
- [x] CSV file read error handling (E6)
- [x] 404 page created (F1)
- [x] Error boundary + global error pages (F2)
- [x] JSON-LD hardcoded domain fixed (F3)
- [x] Class info/roster tab duplication fixed (F4)
- [x] Invitation 201-on-failure → 502 with invited:false
- [x] Credit deduction race condition: atomic RPCs wired up

## Previously Fixed (Earlier Sprint)

- [x] Migration 014: missing columns (cancel_at_period_end, paused_at, booked_count, network status, stripe cols)
- [x] Migration 014: indexes on bookings, memberships, subscriptions, class_passes
- [x] Migration 014: RLS policies for feature_flags and governance DELETE operations
- [x] Migration 014: atomic RPC functions for credit deduction (race condition fix)
- [x] Comp revoke endpoint verified and working
- [x] Currency standardized to NZD across all dashboard pages
- [x] 58 new tests for 5 untested route files (classes, discover, governance, schedule, upload)
- [x] ConfirmDialog component replacing all 15 browser confirm/alert calls
- [x] Sentry integration (API middleware, web configs, mobile wrapper)
- [x] i18n setup with next-intl and 300+ translation keys
- [x] Playwright E2E test framework with 36 tests

## Previously Fixed (Earlier Sprints)

- [x] Auth system unified on Supabase Auth (C1 from original TODO)
- [x] Stripe Connect routes mounted (C2)
- [x] Missing DB columns migration 009 (C4)
- [x] Wrong table names fixed (C5)
- [x] Missing RPC function added (C6)
- [x] Dashboard fetch URLs fixed (C7-C9)
- [x] Mobile auth token flow fixed (C10)
- [x] Mobile API client paths fixed with /api prefix (C11)
- [x] Networks routes rewritten to match schema (C3)
- [x] Webhook private booking handler added (H1)
- [x] Subscription resume endpoint added (H2)
- [x] Jobs subquery fixed (H3)
- [x] Error states added to dashboard pages (H4)
- [x] Auth redirects added (H5)
- [x] Admin service role key (H6)
- [x] Mobile check-in wired to API (H7)
- [x] Mobile waitlist wired up (H8)
- [x] Mobile payment/checkout flow added (H9)
- [x] Demo schedule teacher.id fixed (H10)
- [x] Upload membership verification added (H13)
- [x] Nav highlighting fixed with startsWith (M1)
- [x] Dead code removed (L1 partial)
- [x] Attendance unique constraint added (L14)
- [x] Subscriptions active uniqueness added (L15)
- [x] DELETE policies on memberships/notifications added (L16)
