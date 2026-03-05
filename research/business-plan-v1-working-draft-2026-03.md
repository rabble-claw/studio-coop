# Business Plan v1 Working Draft (March 2026)

Audience: founder team + first studio-owner champions.

Goal: run a non-extractive platform co-op that is financially stable and understandable to small business owners.

## Decision Lock (March 6, 2026)

1. Planning baseline selected: `Current_stack_lean_operated_2026_03`.
2. This is now the default model for pricing, growth, and 90-day execution decisions.

## 1) Model Summary

1. Flat monthly SaaS pricing (no platform take-rate on studio revenue).
2. Payment processing passed through at cost.
3. Cost-plus pricing discipline with a resilience buffer.
4. Surplus returned via patronage after reserve requirements are met.

## 2) Proposed v1 Pricing

1. Starter: `NZD 99/month`
2. Growth: `NZD 139/month`
3. Co-op: `NZD 189/month`

Target tier mix for planning: `30% Starter / 60% Growth / 10% Co-op`.

Implied weighted ARPS: `NZD 132/month`.

## 2A) By-and-For-Studio Price Positioning

Reference benchmark: `NZD 220/month` per studio (from current public pricing scan and owner-reported examples).

Using `Current_stack_lean_operated_2026_03`:

1. List undercut vs benchmark: `1 - (132 / 220) = 40%`.
2. Annual surplus after reserve: `NZD 5,100`.
3. Patronage pool at 40% rate: `NZD 2,040`.
4. Estimated patronage rebate per studio per month at 25 studios: `NZD 6.80`.
5. Net effective monthly price: `132 - 6.80 = NZD 125.20`.
6. Net effective undercut vs benchmark: about `43%`.

Segment-sensitive benchmark rows are also preloaded in the calculator:

1. Pole/Aerial benchmark: `NZD 180`
2. Dance benchmark: `NZD 200`
3. Yoga benchmark: `NZD 240`
4. Mixed fitness benchmark: `NZD 280`

Regional expansion rows are also preloaded:

1. `Regional_LATAM_affordable_local_payments_2026_03`
2. `Regional_LATAM_no_local_payments_risk_2026_03`

Positioning statement:

1. We undercut incumbent software pricing at list price.
2. We return part of surplus to member studios, lowering effective net cost further.
3. We only do this while keeping floor coverage and reserve policy intact.

Regional expansion rule:

1. Regional affordability pricing is allowed and encouraged.
2. Full launch requires local payment rails, not just lower list pricing.
3. We do not subsidize indefinitely below floor coverage to force growth.

## 3) Cost Scenarios (from calculator)

Reference: [pricing-model-calculator.csv](/Users/rabble/code/personal/studio-coop/research/pricing-model-calculator.csv)

1. `Current_stack_tech_only_2026_03`
- `tmc_nzd = 150`
- Includes only core platform vendor stack.

2. `Current_stack_lean_operated_2026_03`
- `tmc_nzd = 2300`
- Includes vendor stack plus lean owner-facing support/ops overhead.

## 4) Break-Even Targets

Using resilience factor `25%` and ARPS `NZD 132`:

1. Tech-only break-even studios:
- `(150 * 1.25) / 132 = 1.42`
- Rounded target: `2 active studios`

2. Lean-operated break-even studios:
- `(2300 * 1.25) / 132 = 21.78`
- Rounded target: `22 active studios`

Interpretation:

1. Infra is not the hard part.
2. Service quality and onboarding support drive real viability.
3. Growth strategy should optimize for reaching `22+ active studios` with high retention.

## 5) Growth Strategy v1 (Non-Spam)

1. Champion-led warm intros only.
2. No cold outbound cadence campaigns.
3. Referral reward paid only after activation milestone.
4. Activation definition: first paid class booking live within 14 days.

Core loop:

1. Champion owner intro.
2. Concierge onboarding + migration.
3. 30-day success proof.
4. Champion asks for 2 additional intros.

## 6) Non-Extractive Guardrails

1. No hidden add-ons for core features.
2. Publish pricing logic and reserve policy.
3. Full data export and migration-out support.
4. One-studio-one-vote for major pricing/patronage changes.
5. Patronage paid only when reserve floor is met.

## 7) 90-Day Targets

1. `5` pilot studios active in first wave.
2. `22` active studios by end of early scale phase.
3. `>=85%` day-90 studio retention.
4. `>=25%` intro-to-activation conversion.

## 8) Immediate Decisions Needed

1. What labor is included in `tmc_nzd` for the next 90 days?
2. What reserve months target do members accept (3 vs 4)?
3. What patronage rate band is acceptable in year 1 (40-50% recommended)?
4. Which studios are the first 5 in pilot beyond Empire?

## 9) Source and Assumption Notes

Use this doc to keep assumptions transparent:

1. [current-stack-cost-baseline-2026-03.md](/Users/rabble/code/personal/studio-coop/research/current-stack-cost-baseline-2026-03.md)
2. [calculator-quickstart.md](/Users/rabble/code/personal/studio-coop/research/calculator-quickstart.md)
3. [studio-software-pricing-examples-2026-03.md](/Users/rabble/code/personal/studio-coop/research/studio-software-pricing-examples-2026-03.md)
