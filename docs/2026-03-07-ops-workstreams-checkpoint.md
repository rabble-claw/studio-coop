# Studio.coop Ops Workstreams Checkpoint — 2026-03-07

## Initial checkpoint (status + first blockers)

1) Estonia OpCo setup path — **In progress**
- First blocker: legal path still ambiguous (OÜ now vs cooperative later), and required Estonia contact person/legal address provider not selected.

2) Banking + Stripe activation path — **In progress**
- First blocker: payout account/KYC owner stack not finalized (who is legal rep + proof docs + chosen bank/EMI).

3) Emma (Empire) interview + pilot discovery loop — **In progress**
- First blocker: no scheduled interview slot and no explicit pilot success scorecard owner.

4) AI business-planning branch review + merge recommendation — **Completed (analysis)**
- First blocker: branch name not present in local/remote refs; relevant AI/business-planning work appears already merged in `main`.

5) CF Pages/deployment readiness check — **In progress**
- First blocker: readiness depends on production secrets + Cloudflare account state (not verifiable from repo-only review).

---

## 1) Estonia OpCo setup path

### Short plan
1. Confirm target legal sequence (Estonia OÜ operating company first, coop wrapper later).
2. Build pre-incorporation checklist (identity, address/contact person, naming, ownership/cap table).
3. Build execution checklist with dependencies and hard blockers.

### Execution
- Drafted practical path from current state:
  - Step A: confirm legal model decision (OÜ as immediate operating company).
  - Step B: secure e-Residency readiness (if signer not already equipped with card/PIN/reader).
  - Step C: select Estonia legal address + contact person service.
  - Step D: reserve name + register OÜ in e-Business Register.
  - Step E: set board/UBO records aligned with future Stripe verification.
  - Step F: set accounting + annual reporting owner (provider + cadence).

### Blockers / Rabble input needed
- Decide legal operating model explicitly: `Estonia OÜ now` vs alternative jurisdiction interim.
- Confirm legal rep/director(s) and UBO structure for KYC alignment.
- Pick contact-person/legal-address provider (or share preferred one).

---

## 2) Banking + Stripe activation path

### Short plan
1. Sequence banking and Stripe so verification data is consistent across both.
2. Define minimal docs packet for onboarding.
3. Define activation gates (test payment + payout verified).

### Execution
- Proposed activation sequence:
  1. Open business account/EMI for OÜ (EUR IBAN).
  2. Complete Stripe account onboarding with matching legal entity + UBO/director data.
  3. Set webhook + secret management in API worker.
  4. Run sandbox checkout and webhook lifecycle validation.
  5. Run live €1 payment + payout verification.
- Stripe requirements update risk captured:
  - EU connected accounts (including EE) have evolving 2026 verification requirements; hosted/embedded onboarding preferred to avoid API drift.

### Blockers / Rabble input needed
- Choose payout bank/EMI (Wise/LHV/other).
- Confirm legal person completing Stripe verification.
- Share whether current Stripe account exists for studio.coop or must be created from scratch.

---

## 3) Emma interview script + pilot discovery loop

### Short plan
1. Finalize interview script tuned to Empire owner/operator workflow.
2. Define 30-day pilot discovery loop and evidence scorecard.
3. Turn outcomes into explicit go/no-go pilot decisions.

### Execution
- Existing script in `research/customer-development-discovery-script.md` is strong; built operational loop around it:
  - T0: 45–60 min Emma interview + recording consent.
  - T+24h: complete scorecard + top-3 pain ranking.
  - Week 1: map pains to product hypotheses + owner-visible metrics.
  - Week 2: run one workflow intervention (e.g., onboarding, schedule ops, payment friction).
  - Week 3: collect proof outcomes (time saved, reduced confusion, conversion/retention proxy).
  - Week 4: close-loop interview + ask for 1–2 warm intros if proof threshold met.
- Suggested pilot proof thresholds for 30 days:
  - Owner says “would recommend” (yes/no).
  - At least one measurable ops win (time or error reduction).
  - Willingness to introduce 1+ peer studio.

### Blockers / Rabble input needed
- Need calendar slot with Emma.
- Need explicit owner of post-call scorecard and weekly follow-up cadence.

---

## 4) AI business-planning branch review + merge recommendation

### Short plan
1. Locate branch/ref and compare to `main`.
2. Review commit scope and test/deployment risk.
3. Produce merge recommendation.

### Execution
- Branch discovery:
  - No branch explicitly named `ai-business-planning` in local/remote refs.
  - AI/business planning related commits are already in `main`:
    - `b38a755` AI-powered studio intelligence
    - `831ea02` copilot tooling + coop planning docs
    - `634882b` financial planner
- Recommendation:
  - **No merge action needed** if this is the intended branch (already merged).
  - If a separate unpublished branch exists elsewhere, provide ref/remote and re-run review.

### Blockers / Rabble input needed
- Confirm exact branch/ref if a separate review target exists.

---

## 5) Cloudflare Pages/deployment readiness + next actions

### Short plan
1. Verify deploy topology and scripts in repo.
2. Check config consistency (routes, env vars, compat flags, CI gates).
3. Produce go-live checklist with next actions.

### Execution
- Repo indicates Workers-based deploy for web+api (not classic Pages project):
  - Web: `apps/web/wrangler.jsonc` routes for `studio.coop/*`, `www.studio.coop/*`.
  - API: `packages/api/wrangler.toml` route `api.studio.coop/*` + hourly cron.
- Readiness positives:
  - CI covers type/build/tests + web build + demo E2E.
  - Node compat flags present for Worker runtime.
  - Deployment docs define required secrets and routes.
- Gaps to close before declaring deployment-ready:
  1. Secret completeness audit in Cloudflare for both workers (not checkable from repo).
  2. Post-deploy smoke script for: web home, auth path, `/health`, Stripe webhook endpoint shape.
  3. Staging environment parity for web worker (api has `env.staging`; web config currently single env).
  4. Confirm rollback playbook + previous stable deployment ID tracking.

### Blockers / Rabble input needed
- Cloudflare dashboard/API access context for secret audit and route verification.
- Decision: keep Workers-only deploy model or introduce Pages project for marketing/docs surface.

---

## Immediate next actions (unblocked)

1. Lock legal path: "Estonia OÜ now, coop governance layer phased in" (or explicit alternative).
2. Appoint one KYC identity owner (director/UBO packet) for both bank and Stripe.
3. Book Emma call and assign discovery scorecard owner.
4. Confirm target branch/ref for any still-unmerged AI planning work.
5. Run Cloudflare live secret/route audit and smoke test after next deploy.
