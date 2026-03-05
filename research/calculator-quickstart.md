# Calculator Quickstart (Owner-Friendly)

These two files are linked:

1. [pricing-model-calculator.csv](/Users/rabble/code/personal/studio-coop/research/pricing-model-calculator.csv)
2. [patronage-allocation-calculator.csv](/Users/rabble/code/personal/studio-coop/research/patronage-allocation-calculator.csv)
3. [current-stack-cost-baseline-2026-03.md](/Users/rabble/code/personal/studio-coop/research/current-stack-cost-baseline-2026-03.md)
4. [lean-operated-monthly-cost-ledger-2026-03.md](/Users/rabble/code/personal/studio-coop/research/lean-operated-monthly-cost-ledger-2026-03.md)
5. [lean-operated-monthly-cost-ledger-2026-03.csv](/Users/rabble/code/personal/studio-coop/research/lean-operated-monthly-cost-ledger-2026-03.csv)

Use them in Google Sheets or Excel.

## Step 1: Test Pricing Viability

Open `pricing-model-calculator.csv`.

Fast start with prefilled rows:

1. `Current_stack_tech_only_2026_03` (infrastructure floor only).
2. `Current_stack_lean_operated_2026_03` (recommended planning baseline).
3. `Lean_operated_segment_pole_aerial_2026_03` (benchmark `NZD 180`).
4. `Lean_operated_segment_dance_2026_03` (benchmark `NZD 200`).
5. `Lean_operated_segment_yoga_2026_03` (benchmark `NZD 240`).
6. `Lean_operated_segment_mixed_fitness_2026_03` (benchmark `NZD 280`).
7. `Regional_LATAM_affordable_local_payments_2026_03` (affordable regional pricing + local rails).
8. `Regional_LATAM_no_local_payments_risk_2026_03` (risk case: affordability without local rails).

Default choice for business planning: `Current_stack_lean_operated_2026_03`.

Edit only the `Template` row inputs:

- `tmc_nzd` (monthly total cash costs)
- `active_studios`
- `resilience_factor` (start with `0.25`)
- `starter_price_nzd`
- `growth_price_nzd`
- `coop_price_nzd`
- `starter_mix`, `growth_mix`, `coop_mix` (must sum to `1.0`)
- `reserve_months_target` (start with `3`)
- `patronage_rate` (start with `0.5`)
- `day90_retention_target` (start with `0.85`)
- `referral_intro_to_activation_target` (start with `0.25`)
- `incumbent_benchmark_nzd` (start with `220` from current benchmark scan)
- `undercut_target_pct` (start with `0.15` for 15%)

Check these outputs:

1. `floor_coverage_pass` should be `TRUE`.
2. `mix_pass` should be `TRUE`.
3. `monthly_margin_nzd` should be positive.
4. `annual_surplus_after_reserve_nzd` should be positive before patronage.
5. `undercut_pass` should be `TRUE` (list price undercuts benchmark by target).
6. `coop_member_value_pass` should be `TRUE` (financially safe + patronage + undercut).

If one fails:

1. Increase prices, or
2. Improve tier mix toward higher plans, or
3. Reduce monthly cost base.
4. If `undercut_pass` fails, raise benchmark evidence quality or tune tier prices.

## Step 1B: Show "By and For Studios" in Numbers

Use these calculator fields to explain the coop story clearly:

1. `undercut_pct_vs_benchmark`:
- How much cheaper your list pricing is versus incumbent benchmark.

2. `est_patronage_rebate_per_studio_monthly_nzd`:
- Estimated monthly value returned to member studios from patronage.

3. `est_net_effective_price_nzd`:
- Effective monthly price after estimated patronage rebate.

4. `net_effective_undercut_pct`:
- Real undercut level after value return, not just list price.

Example from `Current_stack_lean_operated_2026_03` with benchmark `NZD 220`:

1. List weighted ARPS: `NZD 132` (`40%` below benchmark).
2. Estimated patronage rebate: `NZD 6.80/studio/month`.
3. Net effective price: `NZD 125.20`.
4. Net effective undercut: about `43%`.

Segment example using same lean-operated pricing:

1. Pole/Aerial benchmark `NZD 180` -> list undercut about `27%`.
2. Dance benchmark `NZD 200` -> list undercut `34%`.
3. Yoga benchmark `NZD 240` -> list undercut `45%`.
4. Mixed benchmark `NZD 280` -> list undercut about `53%`.

LATAM example:

1. `Regional_LATAM_affordable_local_payments_2026_03` shows a viable pattern:
- lower regional pricing (`69/99/139`) plus local rails and adequate studio count can still pass floor coverage.
2. `Regional_LATAM_no_local_payments_risk_2026_03` shows the failure mode:
- even with low pricing, adoption/retention scale can stay too low and fail `floor_coverage_pass`.

## Step 2: Allocate Patronage Fairly

Open `patronage-allocation-calculator.csv`.

Edit only:

1. Config row (`row 2`):
- `subscription_unit_weight` (`H2`) default `1`
- `usage_unit_weight` (`I2`) default `0`
- `referral_unit_weight` (`J2`) default `0`
- `patronage_pool_nzd` (`P2`) set from pricing calculator output

2. Studio rows (`rows 3+`):
- `studio_name`
- `segment`
- `monthly_subscription_nzd`
- `usage_events`
- `referral_activations`

Do not edit formula columns.

Read outputs:

1. `participation_share` = studio share of total participation.
2. `estimated_rebate_nzd` = expected patronage payout.
3. `net_contribution_nzd` = annual fee paid minus rebate.

## Recommended Default Policy (v1)

Start simple:

1. Weight only subscription fees (`H2 = 1`, `I2 = 0`, `J2 = 0`) for first year.
2. Add referral weight only after validating anti-spam guardrails.
3. Keep reserve at 3 months before paying patronage.
4. Keep patronage rate at 40-50% until stability is proven.

## Governance Checklist

Before publishing externally, member studios should ratify:

1. Resilience factor range.
2. Reserve months target.
3. Patronage rate range.
4. Participation unit method and weights.
5. Referral anti-spam policy.
