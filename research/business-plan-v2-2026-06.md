# Business Plan v2 — June 2026

**Date:** 2026-06-11
**Status:** Draft for Rabble review (written autonomously; decisions flagged in §10)
**Supersedes:** [business-plan-v1-working-draft-2026-03.md](business-plan-v1-working-draft-2026-03.md)
**Companion:** [Product Plan v2](../docs/plans/2026-06-11-product-plan-v2.md)

Audience: founder + first studio-owner champions.
Goal: a non-extractive platform co-op that is financially stable and understandable to small business owners.

---

## 1. What Changed Since v1 (March 2026)

**Internally — honest rebase.** The March stage gates were missed entirely (Gate 1: 5 studios by Mar 31; Gate 2: 12 by May 31; actual: 0 live studios, no commits since Mar 7). The blockers were never product: legal entity, bank/Stripe KYC, and the Emma pilot kickoff were all still open at the March 7 ops checkpoint and remain open. Meanwhile the product gained an AI intelligence suite (churn scoring, weekly briefs, copilot, schedule analysis) and manual billing mode. **Conclusion: the constraint is execution of go-to-market and ops, not software.** This plan rebases the timeline and narrows focus accordingly.

**Externally — the market moved in our favor on narrative, against us on features:**

1. **Consolidation accelerated dramatically.** Mindbody + ClassPass rebranded as "Playlist," then merged with EGYM into a **$7.5B entity** (completed Mar 31, 2026). Momence — the indie modern challenger — was absorbed into PE rollup **Clubessential Holdings** (Jan 2025). EverCommerce exited fitness to Constellation; ABC Fitness (Glofox) has been in a sale process; Daxko bought ShapeNet, Vision, and Exercise.com. *Every* "alternative" is now or soon will be PE/rollup-owned.
2. **Both open-source alternatives died.** OpenStudio archived 2023; its successor Costasiella stopped development Jan 1, 2026 and was archived Jan 17, 2026. There is **no platform cooperative in fitness/wellness software anywhere** — the niche we target is verifiably empty as of June 2026.
3. **AI became table stakes.** Churn-risk AI and AI assistants shipped across the board in 2025–26: WellnessLiving "Isaac," ABC/Glofox AI front-desk agents (Mar 2026), Arketa AI (May 2026), TeamUp AI Business Advisor (Mar 2026), WallaPredict (Sep 2025), Mindbody "Clients At Risk." Our AI suite is **parity, not differentiation** — but bundling it at no extra cost still differentiates against upsell-heavy incumbents.
4. **Mindbody is attacking down-market in ANZ.** New "Go" plan at **A$89/mo** (May 13, 2026). Expect an NZ equivalent. Price alone cannot be our moat.
5. **Regulatory tailwind for our payments posture.** NZ interchange caps (Dec 2025) and Australia's card-surcharge ban (Oct 1, 2026) make "pass fees to the member" designs legally risky — our pass-through-to-studio model is the compliant posture.

---

## 2. Model Summary (Unchanged in Principle)

1. Flat monthly SaaS pricing — **no take-rate on studio revenue, no per-member price ladder.**
2. Payment processing passed through at cost (Stripe NZ: **2.65% + NZ$0.30** domestic — use this exact figure, not 2.7%).
3. Cost-plus pricing discipline with a resilience buffer (RF 25%).
4. Surplus returned via patronage after reserves are met.
5. One studio, one vote on major pricing/patronage changes.

The June 2026 research validates both structural choices: take-rate monetization (Momence 5%+4% on Basic; Arketa 3% platform fee; Heylo 1–5%) and member-count ladders (TeamUp, Gymdesk, GymMaster) are the two traps every low-cost competitor fell into, and both punish studio growth. Flat + pass-through is differentiated against the **entire** set.

---

## 3. Market & Competition (June 2026 Refresh)

### Who we actually compete with in NZ

The February research benchmarked the wrong tier. Mindbody is the incumbent to *migrate from*, but the conversion battle is against the modern low-cost set:

| Competitor | Price (≈NZD/mo) | Take-rate | Notes |
|---|---|---|---|
| **Punchpass** | 97 / 163 / 245 (USD 59/99/149) | None | **The real NZ incumbent for yoga** — verified studios in Wellington, Dunedin, plus AU. No native app (PWA only), no NZD billing. Markets "No Platform Tax." |
| **GymMaster** (Christchurch) | NZD 129 / 189 / 299 | None | Only competitor with published NZD pricing. Gym-oriented, not boutique class-pack studios. |
| **TeamUp** | ~195 entry (USD 119), scales with member count | None | All features every tier; branded app +US$99. Has a dedicated pole-studio product page. No NZD option. |
| **Gymdesk** | ~123–330 (USD 75–200, member-banded) | None | Gym/martial arts focus; Ezypay AU/NZ support. |
| **Momence** | "Free"/US$60 — but 2.5–9% effective take-rates; real-world US$250–2,000+ | High | Now PE-owned (Clubessential). Take-rate makes it expensive at any real volume. |
| **Mindbody Go (AU)** | A$89 entry | Marketplace ~20% commission on new clients | Down-market attack launched May 2026; upper tiers A$279–369. |
| **Arketa** | US$49–124 + **3% platform fee** | 3% + Stripe | AI-forward, $15M Series A, US-centric. |

Quote-only premium set (Glofox ~US$160–400, Mariana Tek ~US$179–285, Walla US$220–599, bsport) is not our fight at this stage.

**Key facts for positioning:**
- A studio doing NZD 20k/month in card revenue pays ~NZD 1,800/mo more on Momence Basic and ~NZD 600/mo more on Arketa Individual than on a zero-take-rate platform — before subscription fees.
- **Nobody except GymMaster and Bookwhen publishes NZD pricing.** NZD-native billing removes FX uncertainty and GST friction (overseas SaaS shouldn't charge GST-registered NZ studios 15% GST, but the reverse-charge confusion is real).
- Mindbody owner backlash is documented and quotable: price creep (one decade-long customer: $80→$469/mo), 24-month contracts, post-cancellation billing. ClassPass payout grievances (~$8 payouts vs $25 drop-ins) now sit inside the same $7.5B entity that sells studio software — the conflict of interest writes our story for us.

### Our four positioning pillars (in order)

1. **Ownership & permanence** — the only studio-owned platform; cannot be acquired out from under members. Every competitor consolidation headline is free marketing. This is now our *lead* message, not price.
2. **Non-extractive flat pricing** — no take-rate, no member ladder, pass-through Stripe at 2.65% + 30c, NZD-native, patronage rebates. Quantify with the Momence/Arketa math above.
3. **Community feeds** — per-class attendee-only feeds remain genuinely unique across the entire competitive set.
4. **AI included, not upsold** — churn scoring, weekly owner briefs, copilot bundled in base price (vs. Mindbody's Attentive partnership, WellnessLiving's Isaac tiers, Arketa's quote-gated AI).

**Wedge vs Punchpass specifically** (the NZ conversion fight): native mobile app, community feeds, NZD billing, co-op ownership, comparable-or-lower NZD price. Do not claim SMS or payroll — we don't have them either.

---

## 4. Pricing (Decision Needed — Recommendation Below)

### The problem

Four conflicting pricing stories currently exist in public/internal surfaces:

| Surface | Says |
|---|---|
| README.md | Free tier / $19 / $39 (obsolete — fixed in this update) |
| Marketing site, pitch deck, cooperative docs (public) | **$99 AUD flat, everything included** |
| research/studio-coop-marketing.md | $69/$99/$149 USD tiers |
| Business plan v1 (Decision Lock, Mar 6) | **NZD 99/139/189 tiers**, ARPS 132 |

### DECIDED (Rabble directive, 2026-06-12): price competitively low — "this is cheap to run"

**Working number: NZD 69/month per studio location (ex GST), flat, everything included.** One price for everyone; founding studios get founding governance status and patronage seniority rather than a discount. Payment processing pass-through at Stripe's 2.65% + 30c. AU entry at A$59–69 when we cross the Tasman.

Why NZD 69:

1. **It undercuts every full-featured competitor in NZ:** Punchpass entry ≈ NZD 97 (and no native app), Mindbody Go ≈ NZD 97 (AU only), GymMaster 129, TeamUp ≈ 195, Momence effective 330+. Only lightweight booking tools (Bookwhen NZD 24–69) sit near it, and they aren't studio management. ≈ USD 42 — globally cheap, not just locally.
2. **It's the honest co-op price.** Vendor infrastructure for the *entire platform* is ~NZD 150/mo; the marginal cost of a studio is a few dollars. A cost-plus cooperative charging 139 while costs are this low would be extraction with extra steps. 69 prices in future support labor, not fantasy margin.
3. **It's not suspicious-cheap.** NZD 49 anchors below sustainability once paid support exists (25 studios × 49 = 1,225/mo vs 2,300 lean costs) and reads "too cheap to trust." 69 is a confident statement, not a clearance sale.
4. **The co-op structure de-risks underpricing.** The published cost-plus formula and one-studio-one-vote governance mean the price follows costs *by covenant* — adjusting later isn't a bait-and-switch, it's the mechanism members signed up for. And when revenue overshoots costs, patronage returns the difference, pushing the *net effective* price into the 50s at scale.

Superseded options kept for the record: v1 three-tier lock (NZD 99/139/189, ARPS 132) and the interim flat-139 recommendation. Single-price reasoning from that recommendation still applies: no feature gates, no tier ladders, one vote, one formula.

**All public surfaces must converge on "NZD 69 flat, everything included"** — file list in §10.

GST note: an NZ entity must add 15% GST for NZ customers; publish prices as "ex GST" from day one to avoid a later effective price rise.

### Positioning vs benchmark (Option B)

- NZ boutique reality check (replacing v1's single NZD 220 benchmark): Mindbody NZ reportedly NZD 139–549; Punchpass ≈ NZD 97–245; GymMaster NZD 129–299; full-service all-in commonly NZD 250–600+.
- At NZD 139 everything-included (branded studio presence, native app, AI, community, migration), we undercut every full-featured option **and** are the only NZD-native, zero-take-rate, member-owned choice.
- Patronage rebates lower net effective price further once reserves are funded (mechanics unchanged from [cooperative-pricing-and-patronage-model.md](cooperative-pricing-and-patronage-model.md)).

---

## 5. Unit Economics (Rebased)

Two cost stages matter (both from the [March ledger](lean-operated-monthly-cost-ledger-2026-03.md), resilience factor 25%):

| Stage | TMC | Required revenue | Break-even at NZD 69 |
|---|---|---|---|
| **Founder-operated** (vendor stack only, labor subsidized) | ~150 | ~190 | **3 studios** |
| **Lean-operated** (paid part-time support/ops) | 2,300 | 2,875 | **42 studios** |

How to read this at the flat-69 price:

1. **Cash-positive on hard costs almost immediately** — 3 studios covers every invoice. From studio #4, the platform pays for itself while Rabble's labor is the subsidy (which it is regardless of price at this stage).
2. **Paid support becomes affordable at ~42 studios.** That's the real break-even and lands roughly mid-to-late 2027 on the §8 adoption gates. Until then, support labor is founder-subsidized or part-funded — the deliberate trade: the low price is the growth engine that gets us to 42 faster than 139 would have gotten us to 21, because price becomes a headline weapon ("half of GymMaster, a third of TeamUp, no take-rate").
3. **At scale the surplus comes back.** 100 studios → NZD 6,900/mo against perhaps 4,000–4,500 of costs → patronage pool pushes net effective price into the 50s. The cheaper-than-everyone price *and* a rebate is an unanswerable combination for PE-owned rivals.
4. **Safety valve:** the cost-plus floor formula is published and member-voted. If real costs exceed the model, the price follows the formula — pre-agreed, not sprung.

Sensitivity to watch: TMC was estimated in March and includes lean ops labor. Re-tighten from real invoices at first revenue (30-minute exercise per [cost baseline doc](current-stack-cost-baseline-2026-03.md)). If lean TMC lands nearer 1,500, lean break-even drops to ~27 studios.

---

## 6. Legal Entity & Payments Path (Blocking Decision)

This has been the open blocker since March. Framework:

| | NZ company now | Estonia OÜ now |
|---|---|---|
| Customers (NZ studios), founder (Auckland), bank KYC | All local, fast | All remote, slower |
| Stripe | Stripe NZ supported, domestic rates 2.65%+30c | EE accounts face evolving 2026 EU verification requirements (flagged in March checkpoint) |
| GST | Clean: register, charge 15%, studios claim it back | Cross-border reverse-charge confusion for NZ customers |
| Co-op path | NZ Co-operative Companies Act 1996 — native conversion path | Coop wrapper across jurisdictions = complexity |
| EU expansion later | Add EU entity when EU revenue justifies it | Ready, but premature |

**Recommendation: incorporate in NZ now** (standard company first, co-op conversion or co-op-from-day-one per legal advice), open an NZ bank account, activate Stripe NZ, appoint Rabble as the single KYC identity owner. Revisit Estonia only when EU revenue is real. This is a founder decision — but **make it within 2 weeks**; every other workstream queues behind it.

---

## 7. Go-to-Market (Rebased)

Strategy unchanged in character — champion-led, warm intros only, no cold outbound — but resequenced around one truth: **nothing matters until Empire is live.**

1. **Empire pilot (now → August).** Emma interview → configure → migration rehearsal on her real Mindbody export → 2-week parallel run → cutover. Manual billing from day one so Stripe KYC can't block go-live. (Empire's site confirms they're still on Mindbody as of June 2026 — the pilot opportunity is intact, but every month risks her renewing or switching elsewhere. Body Electric, also on Cuba St and also on Mindbody, is prospect #2.)
2. **Wellington cluster ("leave Mindbody together").** Empire case study + Emma's intros → the 3–5 pole/aerial/dance studios that know each other. The city-cluster co-op story is also the PR hook (platform.coop network, NZ tech/business media).
3. **NZ vertical depth before breadth.** Pole/aerial/dance first (community-dense, Mindbody-frustrated, underserved), yoga second (means fighting entrenched Punchpass — only with the case study in hand).
4. **AU later, with eyes open.** Mindbody Go at A$89 means AU entry needs the ownership/community story leading, not price. A$129 flat positioning. Not before 2027 unless an AU champion appears organically.
5. **Founding-member co-op formation** at 5–10 studios (per [cooperative-formation.md](../docs/cooperative-formation.md) Phase 2, now targeting Q4 2026): provisional membership from signup, formal incorporation event with founding studios — itself a press moment.

Referral mechanics, anti-spam rules, and activation-gated rewards: unchanged from [v1 model doc](cooperative-pricing-and-patronage-model.md) §7.

---

## 8. Stage Gates (Rebased, with Kill/Pivot Criteria)

| Gate | Date | Targets | If missed |
|---|---|---|---|
| **0 — Unblocked** | Jul 15, 2026 | Entity formed; bank + Stripe KYC submitted; Emma interview done; production-readiness sweep complete | Diagnose founder bandwidth honestly — consider hiring ops help or pausing |
| **1 — First proof** | Aug 31, 2026 | Empire live & paying (manual billing OK); parallel run complete; scorecard ≥ "would recommend" + 1 measurable ops win; 2 warm intros | **Hard stop & reassess** — if we can't land the friendly anchor customer, the model is unproven at its easiest point |
| **2 — Cluster** | Oct 31, 2026 | 5 active studios; ≥80% day-14 activation; ≥1 unprompted referral | Warm-intro loop broken — diagnose (product? onboarding labor? pricing?) before adding studios |
| **3 — Cohort retention** | Dec 20, 2026 | 10–12 active studios; day-90 retention ≥85% for first cohort; founding co-op membership ratified | Retention < 85% → stop growth, fix churn causes |
| **4 — Scale** | Mar 31, 2027 | 25+ active studios (hard-cost break-even passed at 3; on the path to lean break-even at 42); floor coverage formula published; first patronage policy vote | Re-examine TMC and adoption assumptions with a year of real data |

These gates are ~6 months later than v1's. That is the honest cost of the March–June stall; compressing them again without removing the ops bottleneck would just repeat it.

---

## 9. Risks (Updated, Honest)

1. **Single-founder execution bandwidth** — the proven #1 risk (it's why Q2 was lost). Mitigation: the product-freeze in Product Plan v2, gate 0 deadline, and considering paid part-time ops/support help (already in the TMC ledger).
2. **AI-generated codebase meets real users.** ~680 tests passing ≠ production-proven. First real studio will find what synthetic data didn't. Mitigation: security pass + parallel-run + fix-as-found budget (Product Plan v2 Phases 0–1).
3. **Incumbent price attack.** Mindbody Go (A$89) shows willingness; a NZD equivalent could erase the list-price gap. Mitigation: lead with ownership/community/take-rate math, not list price.
4. **Punchpass entrenchment in NZ yoga.** Don't fight it first; win pole/aerial/dance where no one is entrenched.
5. **AI parity treadmill.** Competitors ship AI faster than a co-op can. Mitigation: don't compete on AI feature count; compete on AI-included-at-no-extra-cost and owner trust (our AI works for the studio, not for an upsell funnel).
6. **Promise inflation.** Marketing surfaces promise group chat, AI website builder, branded apps — not built. Mitigation: reconcile claims before recruiting beyond Empire (Product Plan v2 §1 table).
7. **Co-op governance overhead before scale.** Formal governance with <10 members can consume founder time. Mitigation: provisional membership + lightweight founding-member agreement now; full governance machinery at 10+.
8. **Champion dependence.** The entire 2026 funnel routes through Emma. Mitigation: Body Electric as independent prospect #2; the Punchpass-using yoga studios as a later second wedge.

---

## 10. Decisions Needed From Rabble

1. **Pricing:** ~~decide model~~ → *Decided 2026-06-12: competitive flat pricing (Rabble: "this is cheap to run"). Working number NZD 69/mo ex GST — confirm the number, then converge all surfaces in one pass: web landing (add pricing section), marketing-site/index.html + docs/index.html ($99 AUD flat), pitch-deck/index.html, marketing-site/cooperative.html, docs/cooperative-formation.md ($99 AUD), research/studio-coop-marketing.md (USD tiers).*
2. **Entity:** NZ-first recommendation (§6) — confirm and start incorporation + bank + Stripe within 2 weeks.
3. **Emma:** ~~book the interview~~ → *Update 2026-06-11: Emma is ready to test (per Rabble). Pilot is GO — run the discovery interview as part of test onboarding; Gate 0's Emma item is effectively met early.*
4. **Product freeze:** approve "no new feature areas until Empire is live and paying."
5. **Reserve & patronage bands** (carried over from v1, still unratified): reserve target 3 vs 4 months; year-1 patronage rate band 40–50%.

## 11. Verification Notes

Competitive figures verified against official pricing pages June 11, 2026 (Momence, Punchpass, Arketa, TeamUp, Walla, WellnessLiving, Gymdesk, Heylo, fitDEGREE, GymMaster, Mindbody US/AU). Quote-gated vendors (Glofox, Mariana Tek, bsport, Momence Custom) use third-party 2025–26 estimates — mystery-shop before quoting in public materials. FX used: USD/NZD ≈ 0.60–0.61. Stripe NZ rate from stripe.com/nz/pricing. Consolidation facts: TechCrunch (Playlist–EGYM, Mar 31 2026), Clubessential press (Momence, Jan 2025), GitHub archives (OpenStudio, Costasiella).
