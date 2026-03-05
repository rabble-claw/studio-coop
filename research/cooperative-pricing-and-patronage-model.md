# Cooperative Pricing and Patronage Model (v1)

Purpose: run studio.coop sustainably while ensuring value flows back to member studios, not extracted from them.

## 1) Non-Extractive Principles

1. Transparent pricing and published cost categories.
2. Flat platform fees, not percentage-of-revenue rent.
3. Payment processing passed through at cost (no hidden markup).
4. Core features in base plans (no forced add-on traps).
5. Open data export and migration-out support.
6. Surplus returned to members via patronage.
7. Governance: one studio, one vote on major pricing changes.

## 2) Cost Structure (Monthly)

Use this simple model each month:

- `Infra`: hosting, storage, monitoring, push/email infrastructure
- `Support`: customer support, onboarding, migration labor
- `Product/Ops`: ongoing maintenance, bug fixes, compliance overhead
- `Shared overhead`: tools, accounting, legal/admin

Define:

- `TMC` = Total Monthly Cash Cost
- `AS` = Active studios paying this month
- `RF` = Resilience factor (target 20-30%)
- `CPF` = Cost Per Studio = `TMC / AS`
- `Price floor` = `CPF * (1 + RF)`

## 3) Pricing Rule (Cost-Plus)

Set list prices so weighted average revenue per studio is above price floor.

- `Starter`: low-friction adoption tier
- `Growth`: default tier for most studios
- `Co-op`: higher-support and advanced analytics tier

Pricing guardrail:

- `Weighted ARPS >= Price floor`
- where `Weighted ARPS = (Total platform subscription revenue) / AS`

## 3A) Competitive Fairness Rule (Undercut Without Extraction)

To show "by and for studios" in pricing, anchor against real market benchmarks.

Define:

- `IB` = Incumbent benchmark monthly software spend (per studio)
- `List undercut % = 1 - (Weighted ARPS / IB)`
- `Patronage rebate per studio per month = Patronage pool / AS / 12`
- `Net effective price = Weighted ARPS - Patronage rebate per studio per month`
- `Net effective undercut % = 1 - (Net effective price / IB)`

Suggested guardrails:

1. `List undercut % >= 15%`
2. `Floor coverage ratio >= 1.05`
3. `Net effective undercut % >= 15%`
4. No undercutting below sustainable floor just to win logos.

## 3B) Regional Pricing Rule (Affordability + Local Rails)

Use regional pricing to improve access, but keep a uniform policy framework.

Define per region:

- `RB` = regional incumbent benchmark (local market monthly spend)
- `RCF` = regional cost factor (support, compliance, infra share for that region)
- `RPF` = regional price floor (`regional CPF * (1 + RF)`)

Policy:

1. Set prices in local currency for each region (do not just FX-convert NZ pricing).
2. Keep one formula globally: pass floor coverage, then target regional undercut.
3. Require local payment rails before full rollout (cards + high-usage local methods).
4. If local rails are missing, run as pilot-only and do not declare full market launch.
5. Keep governance rights equal across regions (`one studio, one vote`).

LATAM-specific implication:

1. Lower local list prices are necessary for adoption.
2. Without local payment support, affordability alone usually fails conversion and retention.

## 4) Worked Example (NZD)

Illustrative month:

- `TMC = NZD 8,400`
- `AS = 80`
- `RF = 25%`

Then:

- `CPF = 8,400 / 80 = NZD 105`
- `Price floor = 105 * 1.25 = NZD 131.25`

Possible tier setup to satisfy floor:

- `Starter = NZD 99`
- `Growth = NZD 139`
- `Co-op = NZD 189`

If mix is 20% Starter, 60% Growth, 20% Co-op:

- `Weighted ARPS = (0.2*99) + (0.6*139) + (0.2*189) = NZD 141`
- Margin above floor = `141 - 131.25 = NZD 9.75` per studio

## 5) Surplus and Patronage Formula

At fiscal year end:

- `Annual surplus = total revenue - total costs - required reserve contribution`
- `Patronage pool = Annual surplus * Patronage rate`
- Suggested starting `Patronage rate = 40-70%` while early-stage

Distribute by participation, not capital:

- `Studio patronage share = Studio participation units / Total participation units`
- `Studio rebate = Patronage pool * Studio patronage share`

Practical participation units (pick one and keep consistent):

1. Subscription-fee based units (simple to administer).
2. Composite units (subscription + usage + referrals), if governance approves.

## 6) Reserve and Safety Policy

Before patronage payouts, fund reserves:

1. Operating reserve target: 3-6 months of core cash costs.
2. Reliability reserve: incidents, migrations, security events.
3. Growth reserve: bounded experiments approved by members.

Rule:

- No patronage distribution if reserve target is below minimum floor.

## 7) Referral Incentive That Avoids Extraction

Design referral rewards as member value transfer, not coercive sales.

Baseline:

1. Warm intros only (no cold outbound scraping/cadence spam).
2. Referred studio receives onboarding benefit (for example, first month credit).
3. Referring studio receives fee credit or patronage units.
4. Referral reward unlocks only after activation milestone (prevents low-quality churn referrals).

Anti-abuse limits:

1. Cap rewards per studio per quarter in pilot phase.
2. Require explicit opt-in from referred studio.
3. Track complaint rate; pause program if threshold breached.

## 8) KPI Dashboard for This Model

Track monthly:

1. `AS` active studios.
2. `TMC`, `CPF`, and `Price floor`.
3. `Weighted ARPS` and floor coverage ratio (`Weighted ARPS / Price floor`).
4. Gross margin percentage.
5. Support hours per studio.
6. Activation rate at day 14.
7. Day-30 and day-90 studio retention.
8. Intro-to-activation conversion rate from referrals.
9. Incumbent benchmark (`IB`) by segment.
10. List undercut % and net effective undercut %.
11. Patronage rebate per studio per month.

Suggested early thresholds:

1. Floor coverage ratio `>= 1.05`.
2. Day-90 retention `>= 85%`.
3. Referral intro-to-activation `>= 25%`.
4. List undercut `% >= 15%` while maintaining floor coverage.

## 9) Governance Decisions to Ratify

Put these to member vote early:

1. Target resilience factor (`RF`) band.
2. Reserve floor and payout policy.
3. Patronage rate band.
4. Participation unit method.
5. Referral anti-spam policy and enforcement.

## 10) 90-Day Implementation Plan

### Week 1-2

1. Finalize cost categories and monthly reporting template.
2. Set provisional tier prices and RF.
3. Publish non-extractive pricing principles.

### Week 3-6

1. Run pilot pricing with 3-5 studios.
2. Track support load and real CPF.
3. Adjust tier limits, not just prices.

### Week 7-10

1. Validate referral incentive with warm-intro champions.
2. Measure intro quality, activation, and complaint rate.

### Week 11-12

1. Propose governance package (reserves, patronage, referral rules).
2. Ratify v1 policy and publish member-facing summary.

## 11) Open Items for Discovery Calls

Use Emma/Daniela + next owner interviews to answer:

1. Which incentive feels fair: fee credit, patronage units, or mixed?
2. What onboarding burden can champion studios realistically carry?
3. What pricing band feels fair for value delivered in NZ/AU?
4. What activation milestone is perceived as "real success" by owners?
