# Studio Co-op — Product Plan v2

**Date:** 2026-06-11
**Status:** ACTIVE — Phase 1 is GO (Emma confirmed ready to test, 2026-06-11)
**Update (same day, second work session):** Phase 0 item 4 (bug fixes) and the design revision are done — see §9 session log. M8 and M19 turned out to be already fixed with regression tests (TODO.md was stale); the real gap found and fixed was `allow_self_cancel` never being enforced.
**Supersedes:** [2026-02-26-full-platform-design.md](2026-02-26-full-platform-design.md) as the active product direction. That document remains the architecture reference.
**Companion:** [business-plan-v2-2026-06.md](../../research/business-plan-v2-2026-06.md)

---

## 1. Honest Status Assessment (June 2026)

### What exists (a lot)

The build-out phase succeeded beyond the original MVP scope. As of the last commit (2026-03-07):

- **38 API route files**, ~680 passing tests, clean builds across API + web + mobile
- Full booking/waitlist/check-in/feed/payments/plans/coupons/comps stack
- **AI intelligence suite** (built March 6, not yet reflected in any plan): daily churn-risk scoring, weekly AI briefs, schedule-efficiency analysis, 19-tool copilot, adaptive member onboarding sequences
- Financial planner (expenses, P&L, health scores, scenario planning)
- Manual billing mode (critical: lets a studio go live **before** Stripe is activated)
- Mindbody/Vagaro CSV migration wizard with dry-run mode
- Governance system, feature flags, networks/cross-booking, private bookings, iCal feeds, i18n, Sentry, GDPR export, 100 Playwright E2E tests
- In-flight (uncommitted): mobile demo mode with role switching, real app icons, sign-in/auth-context rework, DEPLOYMENT.md updates

### What doesn't exist

- **A single production customer.** Empire Aerial Arts has a seed migration but is not live.
- **A way to take money.** Legal entity, bank account, and Stripe activation are all still open (per the 2026-03-07 ops checkpoint).
- **Production confidence.** Secrets audit, post-deploy smoke tests, staging parity for the web worker, and a rollback playbook are all unfinished.
- **Three months of momentum.** No commits since 2026-03-07. The March stage gates (5 studios by Mar 31, 12 by May 31) were missed — not narrowly, but entirely.

### The core diagnosis

**The product is no longer the constraint.** The codebase is 12-18 months ahead of the business. Every additional feature built before Empire is live and paying adds maintenance surface and zero validated learning. The risk profile has inverted: the danger isn't "not enough product," it's an unvalidated, AI-generated codebase of this size meeting its first real users without production hardening.

### Promise-vs-reality gaps to reconcile

Marketing surfaces promise things the product doesn't have. Either build them, descope the promise, or mark them "roadmap":

| Promise (marketing/coop docs) | Reality | Recommendation |
|---|---|---|
| "Group chats, DMs" | Class feeds + reactions only; no messaging | Descope promise — feeds are the differentiator; messaging is P2 |
| "AI-built websites in 5 minutes" | Not built | Mark roadmap; don't lead with it |
| "Branded app included" | One co-op app with studio switcher | Reword to "your studio in our app, branded studio profile"; true white-label is P2 |
| "Video sharing" | Photo posts; video support unverified | Verify in pilot; fix or descope |
| Pricing on README ($19/$39) | Contradicts everything else | Fixed in this update — see business plan v2 §4 |

---

## 2. Strategy Shift: Stop Building Wide, Ship Deep

**Operating principle for the next 90 days: no new feature areas until Empire is live, migrated, and paying (manual billing counts).** Every sprint must advance pilot readiness or proof-of-value. Feature work is allowed only when it removes a blocker for a real studio in the funnel.

The plan below is sequenced by dependency, not ambition.

---

## 3. Phase 0 — Unblock & Harden (Weeks 1–2)

Goal: the platform can safely take a real studio, and nothing administrative blocks go-live.

1. **Land the in-flight work.** Review and commit the uncommitted mobile demo mode, app icons, auth changes. The demo mode matters — it's the sales tool for owner conversations.
2. **Legal entity + payments decision** (business dependency, blocks everything billing-related). See business plan v2 §6 — recommendation is NZ-first. One identity owner for bank + Stripe KYC.
3. **Production readiness sweep** (from the 2026-03-07 ops checkpoint, still open):
   - Cloudflare secrets audit for both workers
   - Post-deploy smoke script: web home, auth path, `/health`, Stripe webhook shape
   - Staging env for the web worker (API already has `env.staging`)
   - Rollback playbook + stable deployment ID tracking
4. **Security pass before first real member data.** This codebase was generated fast; before it holds real members' names, emails, payment status, and minors' attendance records, run the security review against auth middleware, RLS policies, and the export/upload endpoints. Fix the two known data-integrity bugs that will surface in week one of a real pilot:
   - **M8**: cancellation-window settings path mismatch in `my.ts` (members would see/get wrong cancellation behavior)
   - **M19**: "Corporate Event" private bookings mapped to `party` instead of `group`
5. **App store track started.** Apple Developer account + EAS production builds + TestFlight. This has multi-week lead time; start it now even though the pilot can run on web + TestFlight.

**Exit criteria:** deploy is repeatable with smoke verification; a test studio can be created, take a (manual-billing) payment, and export its data; M8/M19 fixed; TestFlight build in Emma's hands.

---

## 4. Phase 1 — Empire Live (Weeks 2–6)

Goal: Empire Aerial Arts runs on Studio Co-op for real, with Mindbody as fallback only.

1. **Emma discovery interview** (script exists in `research/customer-development-discovery-script.md`) — do this FIRST; it sets the migration spec. Capture: exact plans/pricing, cancellation policy, no-show handling, deposit practice for privates, must-keep vs. hated Mindbody features.
2. **Configure Empire for real:** plans, schedule templates, teachers, levels (pole 1–5, Movement & Cirque, Fitness & Development), cancellation window, waitlist rules.
3. **Migration rehearsal:** real Mindbody CSV export → dry-run import → reconciliation report → fix importer against real data (the importer has only ever seen synthetic exports).
4. **Billing path:** manual billing mode from day one; switch to Stripe when activation completes. Do not let Stripe KYC block go-live.
5. **Parallel run (2 weeks):** schedule + bookings mirrored in both systems; teachers check in via Studio Co-op; daily reconciliation. Define cutover and **rollback-to-Mindbody** criteria in writing before starting.
6. **Teacher onboarding:** 30-minute session per teacher; check-in flow must hit the <30s promise with real class sizes.
7. **Fix-as-found budget:** reserve ~40% of capacity for friction discovered during the parallel run. This is the most informative product work of the year — instrument it.

**Exit criteria:** Empire's actual schedule, members, and passes live; teachers checking in on the app; members booking; Mindbody cancelled or in notice period; Emma paying (manual billing acceptable).

---

## 5. Phase 2 — Prove Value (Weeks 6–12)

Goal: turn one live studio into evidence and a repeatable pitch.

1. **Pilot scorecard** (owner: Rabble; cadence: weekly): activation rate, no-show rate vs. Mindbody baseline, admin hours saved, member adoption %, feed engagement, "would recommend" answer.
2. **AI features on real data.** Tune retention scoring and the weekly brief against Empire's actual patterns; these were built on synthetic assumptions. The weekly brief landing in Emma's inbox every Monday is the retention hook for *her*.
3. **No-show proof point.** The "smart confirmations saved X no-shows" banner becomes the headline case-study number.
4. **Data-export trust check.** Run a full export and verify a studio could actually leave. The co-op promise must be demonstrably true before recruiting founding members.
5. **Case study + testimonial** for the marketing site; replace placeholder claims with Empire's real numbers.
6. **Warm intros:** when (and only when) the scorecard supports it, Emma asks 2 Wellington studio owners. This starts the "leave Mindbody together" Wellington cluster.

**Exit criteria:** written case study with real numbers; ≥2 warm intros in the funnel; AI brief/retention validated by an actual owner.

---

## 6. Phase 3 — Repeatability (Months 3–4)

Goal: studios #2 and #3 onboard in days, not weeks, without bespoke founder labor.

1. **48-hour onboarding playbook** distilled from Empire's migration (checklist + importer fixes + templates per discipline).
2. **Migration tool hardening** from real Mindbody exports (Empire's plus intro-call exports from prospects).
3. **D4/D5 custom domain + email domain** — only if a paying prospect needs it (these are P1 in TODO.md but no customer has asked yet).
4. **Billing automation:** Stripe live, subscription lifecycle verified end-to-end, dunning emails.
5. **Founding-member onboarding for the co-op**: provisional membership flow, published pricing-logic page, patronage explainer (per cooperative model doc).

**Exit criteria:** studio #2 live within 14 days of "yes"; founder hours per onboarding < 10 and falling.

---

## 7. Explicit Non-Goals (Next 90 Days)

Deliberately **not** doing, regardless of how buildable they are:

- Studio networks / cross-booking growth features (built; dormant until ≥5 studios)
- LATAM / regional payment rails (business plan keeps this gated on local rails anyway)
- AI website builder (marketing idea, not validated; big surface)
- Member-to-member DMs / group chat
- Per-studio white-label apps (the switcher model is fine at this scale)
- New verticals beyond pole/aerial/dance/yoga (the NZ boutique cluster)
- Any new API surface that doesn't trace to a pilot blocker

---

## 8. Standing Quality Bar

- Pre-push hook (build + tests) stays mandatory; CI green is a release gate
- Every pilot-discovered bug gets a regression test before the fix merges
- Sentry triage weekly during the pilot; error budget: zero unhandled API errors in member-facing flows
- Keep the demo environment working — it's the first thing every prospect sees

---

## 9. Session Log — 2026-06-11 (second session)

Done while Rabble was out, after "Emma is ready to test":

**Fixes (test-first):**
- `allow_self_cancel: false` now enforced in the member cancel route (`my.ts`) — was configurable in settings but silently ignored; members could always self-cancel. Returns 403 with "contact the studio" message. Regression test added.
- Verified M8 (cancellation key) and M19 (corporate-event type mapping) were already fixed with regression tests — TODO.md table was stale.
- Mobile social links: new `socialUrl()` normalizer (`apps/mobile/src/lib/social-links.ts`, 7 tests) converts bare `@handles`/domains owners actually type into openable URLs; taps now show an alert instead of failing silently (E5 closed properly).
- Fixed time-bomb test fixture (calendar-feed, hardcoded 2026-03-10 — started failing in mid-March when the date passed) and a stale `window_hours` fixture key in journey tests.
- `e2e/global-setup.ts` no longer aborts the whole E2E run when local Supabase is down — demo-project tests run anyway.

**Design revision (Emma-facing surfaces, E2E-safe — labels/roles unchanged):**
- New identity: Fraunces (display) + Archivo (body) replacing Sora/Manrope; deepened palette (ember `#d94f35`, pine `#25655a`, gold accent `#f3c64f`) in `globals.css` tokens; h1/h2 carry the display face.
- Dashboard shell: emoji nav icons → lucide SVG icons; refined active state (underline indicator); new logo mark.
- Landing page: added the missing co-op ownership section (dark pine panel: 0% take-rate / one-studio-one-vote / your-data-your-exit) — the #1 positioning pillar from business plan v2 was absent from the page entirely. Updated marks, italic display accents.
- Mobile `tailwind.config.js` palette synced to the web tokens.

**Verification:** API 717/717 (vitest), mobile 62/62 (jest), web build clean, API tsc clean, demo E2E 87/87 (note: run with `--workers=4`; unbounded parallelism against a cold `next dev` server causes mass timeout failures that look like navigation bugs).

## 9A. Session Log — 2026-06-12 (deploy + Empire schedule import)

**Deployed to production** (api.studio.coop + studio.coop): all of §9 plus the schedule work below.

**Empire schedule imported from Mindbody (the #schedule complaint):** root cause was threefold — prod DB had zero schedule data (seed 025 had no templates/instances; the page showed a stale hardcoded March scrape), migration 026 (AI tables) had never been pushed to prod, and `CRON_SECRET` was unset so **no cron job had ever run in production**. Fixes:
- Migration `027_seed_empire_schedule.sql`: 11 display-only teacher users, 26 weekly templates, 51 exact instances — generated from Mindbody's public consumer API (`prod-mkt-gateway.mindbody.io/v1/search/class_times`, works unauthenticated; fetch script pattern is in the migration header). Pushed 026+027 via `supabase db push` (CLI is linked to prod with stored creds).
- `CRON_SECRET` set on the API worker; `generate-classes` job verified manually (generated 60 forward instances).
- Page now fetches classes via the API (anon RLS nulls the `users`/`class_templates` joins, which blanked teacher/class names); hardcoded fallback only renders when the DB is empty; fallback data refreshed.
- Discover endpoint: class cutoff now uses the **studio's timezone** (`todayInTimezone()`, TDD'd) instead of UTC — UTC showed NZ studios yesterday's classes every morning — and returns 60 classes (was 20, which truncated mid-week).

**Known wart:** generator (`class-generator.ts`) still computes dates in UTC, so it can create an instance for a studio-local "yesterday" once per day. Harmless (display filters by studio-local today) but worth fixing in Phase 1.

**Teacher display users** use `mindbody-import+<slug>@studio.coop` emails — replace/merge when real teachers are invited during onboarding.

## 10. Decisions Needed From Rabble

1. Approve the "no new feature areas until Empire is live" freeze (this plan's spine).
2. Legal entity path — NZ-first recommendation in business plan v2 §6.
3. Pricing reconciliation — recommendation in business plan v2 §4.
4. Date for the Emma interview (everything in Phase 1 sequences behind it).
5. Whether the uncommitted mobile demo work is ready to land or needs another pass.
