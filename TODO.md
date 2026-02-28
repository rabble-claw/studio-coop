# Studio Co-op — Comprehensive Audit & TODO

Full-stack review of demo, dashboard, API, mobile, admin, and database.
Organized by priority: Critical (blocks real usage) > High > Medium > Low.

---

## CRITICAL — Must Fix for App to Work

### C1. Auth system is broken (web)
**Two competing auth systems exist and neither works end-to-end.**
- Login page (`apps/web/src/app/login/page.tsx`) uses **Supabase Auth**
- Middleware (`apps/web/middleware.ts`) checks a **custom JWT** `session` cookie
- `api-client.ts:16-20` reads a cookie named `token` — neither system sets this
- **Result**: Users can't access dashboard after login; all API calls are unauthenticated (401)
- **Fix**: Unify on Supabase Auth. Update `middleware.ts` to check Supabase session. Update `api-client.ts` `getToken()` to use `supabase.auth.getSession()`.
- **Files**: `middleware.ts`, `lib/api-client.ts`, `lib/auth.ts` (legacy, remove), `lib/supabase/middleware.ts` (unused, wire up)

### C2. Stripe Connect onboarding routes not mounted
**`routes/stripe.ts` defines 4 Stripe Connect endpoints but is never imported in `index.ts`.**
Studios cannot onboard to Stripe, which blocks all payment processing.
- **Fix**: Add `import stripeRoutes from './routes/stripe'` and `app.route('/api/studios', stripeRoutes)` to `packages/api/src/index.ts`
- **Files**: `packages/api/src/index.ts`, `packages/api/src/routes/stripe.ts`

### C3. Networks API references wrong table names
The entire `routes/networks.ts` uses tables that don't exist:
| Code uses | Schema has |
|---|---|
| `networks` | `studio_networks` |
| `network_memberships` | `studio_network_members` |
| `network_policies` | *(doesn't exist)* |

Also references columns that don't exist: `created_by_studio_id`, `status`, `invited_at`
- **Fix**: Rewrite `networks.ts` to match actual schema, or create a migration adding the missing tables/columns
- **Files**: `packages/api/src/routes/networks.ts`, `supabase/migrations/`

### C4. Missing database columns referenced in code
| Table | Missing Column | Used In |
|---|---|---|
| `users` | `stripe_customer_id` | `lib/stripe.ts:36,47` |
| `memberships` | `stripe_customer_id` | `lib/payments.ts:42,67` |
| `payments` | `status` | `lib/payments.ts:144`, `webhooks.ts` |
| `coupons` | `free_classes` | `routes/plans.ts:266` |
| `coupons` | `stripe_coupon_id` | `routes/plans.ts:278` |
- **Fix**: Create migration `009_add_missing_columns.sql`
- **Files**: `supabase/migrations/`, `packages/api/src/lib/stripe.ts`, `packages/api/src/lib/payments.ts`

### C5. Wrong table names in API code
| Code uses | Should be |
|---|---|
| `plans` (payments.ts:91) | `membership_plans` |
| `comp_credits` (plans.ts:267) | `comp_classes` |
- **Fix**: Find-and-replace in affected files

### C6. Missing RPC function `increment_coupon_redemptions`
Called in `routes/plans.ts` but never defined in any migration.
- **Fix**: Add to migration or replace with direct UPDATE query

### C7. Dashboard pages fetch from wrong URLs
- **Coupons page** (`dashboard/coupons/page.tsx:115,154`): fetches `/api/studios/.../coupons` — hits Next.js, not the Hono API
- **Member detail** (`dashboard/members/[id]/page.tsx:183,222`): same issue for comp classes
- **Fix**: Use `couponApi` and `memberApi` from `api-client.ts` instead of raw `fetch()`

### C8. Members list queries non-existent column
`dashboard/members/page.tsx:52` selects `created_at` — should be `joined_at` on `memberships` table.

### C9. Member detail FK join references wrong table
`dashboard/members/[id]/page.tsx:150` joins `plan:plans!subscriptions_plan_id_fkey(...)` — table is `membership_plans`, not `plans`.

### C10. Mobile app auth token never set
`apps/mobile/src/lib/api.ts` stores token in AsyncStorage with `setToken()`, but **no code ever calls `setToken()`** after sign-in. All API calls go out unauthenticated.
- **Fix**: After Supabase sign-in, extract JWT and call `setToken()`, or rewrite `getToken()` to read from Supabase session.

### C11. Mobile API client paths missing `/api` prefix
All paths in `apps/mobile/src/lib/api.ts` start with `/studios/...` but the server mounts at `/api/studios/...`. Every API call 404s unless `API_URL` includes `/api`.

---

## HIGH — Features Broken or Significantly Degraded

### H1. Webhook missing private booking payment handler
`routes/webhooks.ts` handles `payment_intent.succeeded` for `class_pack` and `drop_in` but NOT `private_booking_deposit` or `private_booking_balance`. Payments succeed in Stripe but `deposit_paid` is never updated.

### H2. No subscription resume endpoint
`lib/stripe.ts` exports `resumeStripeSubscription()` but no route calls it. Paused subscriptions can't be reactivated.

### H3. Broken subquery in jobs.ts generate-classes
`routes/jobs.ts:233-238` passes a Supabase query builder to `.in()` as `unknown as string[]`. This will fail at runtime.

### H4. Dashboard pages silently swallow errors
Plans, Reports, Bookings, Network, Notifications, Settings all catch API errors and show empty states instead of error messages. Combined with C1 (broken auth), every API-backed page appears empty.

### H5. No redirect to login when unauthenticated
~10 dashboard pages just show empty/loading states when `getUser()` returns null instead of redirecting to `/login`.

### H6. Admin app uses anon key with RLS
`apps/admin/src/lib/supabase.ts` uses the anon key. RLS policies restrict data to studio members. Admin can't see studios they're not a member of.
- **Fix**: Use service role key for admin queries, or create admin RLS bypass policies.

### H7. Mobile check-in screen bypasses API entirely
`apps/mobile/src/app/(tabs)/class/[id]/checkin.tsx` makes all calls directly to Supabase, bypassing API business logic. The `checkinApi` methods are dead code.

### H8. Mobile waitlist never wired up
`bookingApi.joinWaitlist()` exists but is never called. Schedule and class detail screens show "Class Full" with no join option.

### H9. No payment/checkout flow in mobile app
No screen exists for purchasing class packs, subscribing to plans, or paying for drop-ins. The coupon-input component is also unused.

### H10. Demo schedule: new classes missing `teacher.id`
`apps/web/src/app/demo/schedule/page.tsx:69` creates classes with `teacher: { name }` but the `DemoClass` interface requires `{ id, name }`. TypeScript build error.

### H11. Private bookings hardcode NZD currency
`routes/private-bookings.ts:258,349` hardcodes `currency: 'nzd'` instead of reading from studio settings.

### H12. Schedule view requires admin
`routes/schedule.ts:233` uses `requireAdmin` — regular members can't view available classes via this endpoint.

### H13. Upload endpoint has no membership verification
`routes/upload.ts` requires auth but doesn't verify the user belongs to the specified studio. Any user can upload to any studio's storage.

---

## MEDIUM — UX Issues, Inconsistencies, Missing Features

### M1. Nav highlighting broken on sub-routes
`dashboard-shell.tsx:93` uses `pathname === href` (exact match). Sub-pages like `/dashboard/members/abc123` don't highlight the parent nav item.
- **Fix**: Use `pathname.startsWith(href)` with special-case for root.

### M2. Demo timezone issue
`demo-data.ts:160` uses `toISOString().split('T')[0]` which returns UTC date. NZ users (the target audience for the demo studio) will see wrong "Today's Classes" after noon UTC.
- **Fix**: Use local date or make timezone-aware.

### M3. Demo `booked_count` uses `Math.random()` — hydration mismatch
`demo-data.ts:169` generates random values each render, causing Next.js SSR/client mismatch.
- **Fix**: Use seeded PRNG based on class ID.

### M4. Demo check-in data only for past classes
`demo-data.ts:496` skips today/future classes. The Check-in tab on upcoming classes shows "No attendees" even though there are bookings.

### M5. Stale header comments in lib/stripe.ts and lib/payments.ts
Both files say "stubs for Plan 3" but contain real implementations. Misleading.

### M6. Dead code in lib/payments.ts
Contains `createCheckoutSession`, `createPaymentIntent`, and `processRefund` that duplicate `lib/stripe.ts` with different signatures and wrong table names. Never called.

### M7. Notifications lack pagination
`routes/notifications.ts:115` hard-limits to 50 with no cursor/offset support.

### M8. Race condition on bookings
`routes/bookings.ts:76-78` — capacity check and insert are not atomic. Concurrent requests can overbook.

### M9. Invitation endpoint returns 201 on failure
`routes/invitations.ts:138-149` catches all errors and returns `{ invited: true }` with status 201.

### M10. Notification settings endpoint lacks access control
`routes/studio-settings.ts:173` — `GET /:studioId/settings/notifications` only requires auth, not membership. Any user can read any studio's notification settings.

### M11. Reports at-risk query has N+1 and possible wrong column
`routes/reports.ts:253-261` queries per-member in a loop. Also `attendance` may not have `studio_id` column directly.

### M12. Reminder endpoint in my.ts is a stub
`routes/my.ts:210` has TODO — queries reminder data but never sends notifications.

### M13. Late-cancel fees not implemented
`routes/my.ts:82` says "future work". Settings define `late_cancel_fee_cents` but no logic charges it.

### M14. Environment config validation never called
`lib/config.ts` defines Zod validation with `getConfig()` but it's never invoked at startup.

### M15. Feed page authors not linked to profiles
`apps/web/src/app/demo/feed/page.tsx:123` and class detail feed tab render author names as plain text, not links.

### M16. Demo notifications don't link to referenced content
Clicking a notification marks it read but doesn't navigate to the referenced class/badge/post.

### M17. Network page is read-only in demo
No buttons to join, invite, or configure. Purely informational.

### M18. Plans page — no edit/delete in demo
Plans can be created but not edited or deleted.

### M19. Private bookings form type mismatch
Dashboard sends `client_name`/`client_email` but DB schema has `title`/`user_id`.

### M20. Feed page creates new Supabase client every render
`dashboard/feed/page.tsx:33` and `dashboard/classes/[id]/page.tsx:95` — should use `useRef`.

### M21. Member detail missing studio_id filter
`dashboard/members/[id]/page.tsx:87-90` queries by `user_id` only. `.single()` fails for multi-studio users.

### M22. Mobile: multiple screens bypass API for direct Supabase
Class detail, studio detail, and onboarding all use direct Supabase queries instead of the API client. Inconsistent architecture.

### M23. Mobile: "Book" button only navigates
Home screen "Quick Book" section shows "Book" button that just navigates to class detail. Misleading label.

### M24. Mobile: no photo upload in feed
Feed composer only supports text. No image picker despite `media_urls` support.

### M25. Mobile: no "first reaction" UI on posts
If a post has zero reactions, no reaction buttons appear. Nobody can be the first to react.

### M26. Hardcoded NZD/en-NZ in dashboard pages
`dashboard/plans/page.tsx:83` (NZD), `dashboard/members/page.tsx:194` (en-NZ locale).

### M27. Modal backgrounds break dark mode
`demo/plans/page.tsx:88`, `demo/coupons/page.tsx:134`, `demo/private-bookings/page.tsx:93` use `bg-white` instead of `bg-card`.

---

## LOW — Polish, Cleanup, Future Features

### L1. Unused imports and dead code
- `[slug]/page.tsx:4` — unused `Image` from next/image
- `demo/members/[id]/badges/page.tsx:6` — unused `DemoBadge` type
- `lib/supabase/admin.ts` — never imported
- `lib/db.ts`, `lib/auth.ts` — legacy, only used by legacy API routes no frontend calls
- `routes/networks.ts:349` — unused `creatorStudioId` variable
- Mobile: `authApi`, `checkinApi`, `studioListApi` methods are dead code

### L2. No slug validation for reserved routes
`[slug]/page.tsx` could conflict if a studio uses slugs like `api`, `login`, `dashboard`, `demo`.

### L3. Hardcoded Empire-specific content in [slug] page
`[slug]/page.tsx:79-106` has `empireContent` object. Non-Empire studios get a bare-bones page.

### L4. Co-op governance data is ephemeral
Board members, votes, proposals, meeting minutes in admin app are hardcoded constants and React state only. No database tables.

### L5. Admin feature flags not persisted
System page toggle only changes React state.

### L6. Missing push notification EAS config
`apps/mobile/app.json` doesn't list `expo-notifications` plugin.

### L7. No "Mark All Read" button for mobile notifications
`notificationApi.markAllRead()` exists but isn't used. No unread badge on tab bar.

### L8. Vagaro import instructions missing in demo migrate page
Only Mindbody has step-by-step instructions.

### L9. Reports show raw numbers, not currency-formatted
Revenue amounts display `$12,450` without NZD indicator.

### L10. Network invite requires raw UUID
`dashboard/network/page.tsx:237` — no studio search/autocomplete.

### L11. Demo member stats/badges empty for teachers
Teacher members (4 of 12) have no stats data, showing empty profiles.

### L12. Demo comp classes hardcoded same for every member
`demo/members/[id]/page.tsx:24-27` — everyone sees identical comp data.

### L13. No rate limiting on API
Sensitive endpoints (booking, coupon redemption, push token) have no rate limits.

### L14. Attendance table missing unique constraint
`(class_instance_id, user_id)` — allows duplicate check-in records.

### L15. Subscriptions table missing active uniqueness
No constraint preventing multiple active subscriptions per user per studio.

### L16. No DELETE policy on memberships or notifications
Staff can't remove memberships; users can't clear old notifications via RLS.

---

## Implementation Priority Order

### Phase 1: Make the app actually work
1. **C1** — Fix auth system (unify on Supabase Auth)
2. **C2** — Mount Stripe Connect routes
3. **C4** — Add missing DB columns (migration)
4. **C5** — Fix wrong table names in API code
5. **C3** — Fix or rewrite networks routes
6. **C6** — Add missing RPC function
7. **C7-C9** — Fix dashboard fetch URLs and column names
8. **H4-H5** — Add error states and auth redirects

### Phase 2: Make payments work end-to-end
1. **H1** — Add webhook handler for private booking payments
2. **H2** — Add subscription resume endpoint
3. **H3** — Fix broken subquery in jobs
4. **H11** — Use studio currency instead of hardcoded NZD
5. **H12** — Allow members to view schedule

### Phase 3: Fix demo for a great first impression
1. **H10** — Fix demo schedule teacher.id
2. **M2** — Fix timezone handling
3. **M3** — Fix hydration mismatch with seeded random
4. **M4** — Fix check-in data for upcoming classes
5. **M15-M18** — Add missing links and interactivity
6. **M27** — Fix dark mode modals

### Phase 4: Mobile app
1. **C10-C11** — Fix mobile auth and API paths
2. **H7-H9** — Wire up check-in, waitlist, payments
3. **M22-M25** — Fix inconsistencies and missing features

### Phase 5: Admin and polish
1. **H6** — Fix admin RLS
2. **L1** — Remove dead code
3. **L2-L3** — Slug validation and Empire-specific content
4. **L4-L5** — Persist co-op governance and feature flags
5. **L13-L16** — Security and constraints
