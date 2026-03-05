# Lean-Operated Monthly Cost Ledger (March 2026)

Purpose: convert the `NZD 2,300` lean-operated baseline into line items with evidence and confidence.

## Evidence Snapshot (captured March 6, 2026)

1. Cloudflare zone `studio.coop` plan: `Free Website` (`USD 0`).
2. Cloudflare Workers usage mode for `studio-coop` and `studio-coop-api`: `standard`.
3. Cloudflare Workers requests (last 30 days):
- `studio-coop`: `11,059`
- `studio-coop-api`: `11,186`
- Combined: `22,245`
4. Supabase linked project `lomrjhkneodiowwarrzz` DB size: `12 MB` (via `inspect db db-stats`).

How this was collected:
1. `wrangler whoami` (auth and account context).
2. Cloudflare API `GET /zones?name=studio.coop` (zone plan).
3. Cloudflare GraphQL `workersInvocationsAdaptive` for `studio-coop` and `studio-coop-api`.
4. `supabase inspect db db-stats --linked`.

## Monthly Line Items (NZD)

| Line item | Monthly NZD | Status | Confidence | Notes |
|---|---:|---|---|---|
| Cloudflare zone plan (`studio.coop`) | 0.00 | API-confirmed | High | Zone plan is free. |
| Cloudflare Workers request overage | 0.00 | API-confirmed | High | Current request volume is very low. |
| Supabase usage overage (db/storage/egress) | 0.00 | API-confirmed usage, bill pending | Medium | DB size currently 12MB; no overage signal from CLI. |
| Supabase base plan fee | 0.00 (provisional) | Invoice-required | Low | Replace with invoice amount if on Pro/paid add-ons. |
| Resend plan fee | 0.00 (provisional) | Invoice-required | Low | Replace with current plan amount. |
| Sentry plan fee | 0.00 (provisional) | Invoice-required | Low | Replace with current plan amount. |
| Expo/EAS plan fee | 0.00 (provisional) | Auth-required | Low | EAS CLI not authenticated on this machine. |
| Apple Developer membership (amortized) | 13.70 | Market-price-derived | Medium | `USD 99/year` at `1 USD = 1.66 NZD`. |
| Lean support/onboarding/ops labor (residual) | 2,286.30 | Derived-from-baseline | Medium | Residual to align with selected lean baseline. |
| **Total (lean-operated baseline)** | **2,300.00** | Mixed | Medium | Baseline locked for planning. |

## What Must Be Replaced With True Invoice Values

1. Supabase base plan fee.
2. Resend plan fee.
3. Sentry plan fee.
4. Expo/EAS plan fee.

After replacing those values, reduce the labor residual line by the same delta to keep totals consistent, or re-approve a new `tmc_nzd`.

## Linked Planning Files

1. [pricing-model-calculator.csv](/Users/rabble/code/personal/studio-coop/research/pricing-model-calculator.csv)
2. [current-stack-cost-baseline-2026-03.md](/Users/rabble/code/personal/studio-coop/research/current-stack-cost-baseline-2026-03.md)
3. [lean-operated-execution-plan-2026-03.md](/Users/rabble/code/personal/studio-coop/research/lean-operated-execution-plan-2026-03.md)
