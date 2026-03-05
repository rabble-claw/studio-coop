# Current Stack Cost Baseline (March 2026)

This is a working baseline for `studio.coop` operating costs using your current live stack, available account telemetry, and sourced list prices. It is designed to feed the calculator and then be tightened with invoices.

## Stack Confirmed In Repo

1. Supabase hosted database/auth/storage.
2. Cloudflare Workers for web and API.
3. Expo/EAS for native app builds.
4. Stripe for payments.
5. Resend for email.
6. Sentry for monitoring.

## Live Telemetry Captured (March 6, 2026)

1. Cloudflare zone plan for `studio.coop`: `Free Website` (`USD 0`).
2. Cloudflare Workers requests (last 30 days): `22,245` combined (`studio-coop` + `studio-coop-api`).
3. Supabase linked project DB size: `12 MB`.

Reference files:
1. [DEPLOYMENT.md](/Users/rabble/code/personal/studio-coop/DEPLOYMENT.md)
2. [apps/web/wrangler.jsonc](/Users/rabble/code/personal/studio-coop/apps/web/wrangler.jsonc)
3. [packages/api/wrangler.toml](/Users/rabble/code/personal/studio-coop/packages/api/wrangler.toml)
4. [apps/mobile/eas.json](/Users/rabble/code/personal/studio-coop/apps/mobile/eas.json)

## External Price Inputs (checked March 6, 2026)

1. Cloudflare Workers Paid plan minimum: `$5/month`.
2. Expo Starter plan: `$19/month + usage`.
3. Resend Pro plan starts at `$20/month`; free tier available.
4. Sentry Team starts at `$26/month`; free tier available.
5. Apple Developer Program: `$99/year`.
6. Supabase docs show Pro plan invoice line at `$25` in billing examples.

Links:
1. https://developers.cloudflare.com/workers/platform/pricing/
2. https://expo.dev/pricing
3. https://resend.com/pricing
4. https://sentry.io/pricing/
5. https://developer.apple.com/programs/whats-included/
6. https://supabase.com/docs/guides/platform/billing/on-demand-pricing
7. https://supabase.com/docs/guides/platform/manage-your-usage/compute-and-disk

## Market Benchmark References

For public vendor pricing examples and owner-reported spend samples used to sanity-check studio software assumptions, see:

1. [studio-software-pricing-examples-2026-03.md](/Users/rabble/code/personal/studio-coop/research/studio-software-pricing-examples-2026-03.md)

## Modeling Assumptions

1. FX planning assumption: `1 USD = 1.66 NZD` (replace with your current rate when reviewing).
2. Stripe processing remains pass-through at cost (excluded from platform TMC).
3. Domain renewal, legal, and accounting are intentionally not hardcoded from web prices; set from your invoices.

## Prefilled Scenarios in Pricing Calculator

These were added to [pricing-model-calculator.csv](/Users/rabble/code/personal/studio-coop/research/pricing-model-calculator.csv):

1. `Current_stack_tech_only_2026_03`
- `tmc_nzd = 150`
- Purpose: infrastructure vendor floor only (no labor).

2. `Current_stack_lean_operated_2026_03`
- `tmc_nzd = 2300`
- Purpose: infrastructure plus lean support/ops overhead to protect owner experience.

Line-item breakdown for this baseline:
1. [lean-operated-monthly-cost-ledger-2026-03.md](/Users/rabble/code/personal/studio-coop/research/lean-operated-monthly-cost-ledger-2026-03.md)

## How to Tighten This Baseline in 30 Minutes

1. Replace `tmc_nzd` with your real monthly paid invoices for Supabase/Cloudflare/Expo/Sentry/Resend.
2. Add fixed non-tech overhead (accounting, compliance, bookkeeping).
3. Keep labor explicit as either:
- owner labor not paid (temporary), or
- part-time support/ops line item (recommended for realistic planning).
4. Re-check `floor_coverage_pass` and `monthly_margin_nzd` after each change.
