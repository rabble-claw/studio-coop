# Remaining Implementation Plans (11-16)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

These plans depend on Plans 1-10 being complete. Each should be expanded into full task-by-task plans when ready to implement.

---

## Plan 11: Web Dashboard Completion

**Goal:** Finish all dashboard pages with real API integration (replacing demo mode).

**Tasks:**
1. Studio setup wizard (create studio → Stripe onboarding → first template)
2. Schedule management page (create/edit templates, view generated instances, cancel classes)
3. Member management page (search, filter, view profiles, add notes, grant comps)
4. Member detail page (attendance history, subscription, comp classes, notes)
5. Plan management page (create/edit membership plans, view subscribers)
6. Coupon management page (create/edit, view redemptions)
7. Reports/analytics page (attendance trends, revenue, popular classes, retention)
8. Studio settings page (general, notifications, cancellation policy, closure dates)
9. Private booking management page
10. Replace all demo-data usage with real API calls
11. Responsive design pass (tablet-friendly for front-desk use)

---

## Plan 12: Mobile App Completion

**Goal:** Full-featured member + teacher app with real API integration.

**Tasks:**
1. API client setup (shared fetch wrapper with auth token)
2. Home screen: upcoming bookings, quick-book, studio feed
3. Schedule screen: browse by day, filter by type/teacher/level, book with one tap
4. Class detail: info, book/cancel, attendee count, teacher info
5. Booking flow: credit check → book → confirmation → calendar invite
6. Check-in mode (teacher): photo grid, batch check-in, walk-ins
7. Feed screens: per-class feed, post composer, camera integration, reactions
8. Profile: memberships, attendance history, class packs, comp classes
9. Multi-studio: studio switcher, discover networked studios
10. Push notification handling (deep links)
11. Offline support (cache schedule, queue bookings)
12. App Store / Play Store preparation (icons, screenshots, metadata)

---

## Plan 13: Multi-Studio Network

**Goal:** Enable studios to link together for cross-booking.

**Tasks:**
1. Network CRUD API (create network, invite studios, accept/decline)
2. Cross-booking policy configuration (full price, discounted, included)
3. Cross-booking flow: member of Studio A books at Studio B
   - Check network membership
   - Apply cross-booking policy (pricing)
   - Deduct from original studio's credits or charge at network rate
4. Network discovery: members see networked studios in app
5. Network admin: dashboard showing cross-studio activity
6. Network-level feed (optional): posts visible across networked studios

---

## Plan 14: Admin Panel

**Goal:** Platform super-admin for managing the co-op.

**Tasks:**
1. Scaffold `apps/admin` as Next.js app (separate from web dashboard)
2. Auth: platform admin accounts (not studio accounts)
3. Studio management: list all, approve new, view details, impersonate
4. Platform analytics: total studios, members, bookings, revenue
5. Billing management: studio tiers, invoicing, payment status
6. Feature flags: enable/disable features per studio or globally
7. Support tools: audit log viewer, error log viewer
8. Co-op governance: member studios, voting, equity tracking

---

## Plan 15: Mindbody Migration Tool

**Goal:** Wizard-driven import from Mindbody CSV exports.

**Tasks:**
1. Research Mindbody export formats (what CSVs are available)
2. CSV parser with column mapping UI
3. Member import: name, email, phone → users + memberships
4. Class template import: schedule → class_templates
5. Membership plan mapping: Mindbody plans → Studio Co-op plans
6. Attendance history import: historical records
7. Dry-run mode: preview what will be imported before committing
8. Validation + error reporting (duplicate emails, missing fields)
9. Post-migration checklist: re-collect payment methods, verify schedule, send welcome emails
10. Migration status dashboard in web app

---

## Plan 16: Private Bookings

**Goal:** Support parties, private tuition, and group bookings.

**Tasks:**
1. Private session type management (studio defines types + pricing)
2. Request form (public-facing page or in-app)
3. Request management dashboard (owner reviews, confirms/declines)
4. Scheduling: confirmed request → one-off class instance
5. Payment: deposit collection → balance due reminder → final payment
6. Calendar integration for private bookings
7. Public page for studio's private booking options
