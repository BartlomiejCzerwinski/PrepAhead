# Stripe PRO subscription — Plan Brief

> Full plan: `context/changes/stripe-pro-subscription/plan.md`

## What & Why

PrepAhead's core practice flow is complete on FREE limits, but monetization is the last roadmap slice. **S-05** adds Stripe checkout at **$9/month**, syncs `plan_tier` via webhooks, lets PRO users manage billing in Stripe Customer Portal, and enforces the PRD's PRO fair-use rules (100 soft / 10 per UTC day / 300 hard) so usage display and gates reflect paid subscription state.

## Starting Point

Foundations and practice streams are shipped. `profiles.plan_tier` exists but is only readable in app code; users can self-update it via RLS. Upgrade CTAs dead-end at `/#plans`. `finalize_generation_job` enforces FREE 1 / PRO 300 hard cap only — no daily cap. Env stubs (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) exist; no `stripe` npm package or billing routes.

## Desired End State

A FREE user at limit clicks **Upgrade to PRO**, lands on Stripe Payment Link (bound to their account), completes checkout, and returns to `/app` showing **PRO** with 500 Checks and fair-use generation allowance. PRO users above 100 generations in the period are blocked after 10 generations on the current UTC day. Failed payments keep PRO for 3 days while Stripe retries; cancel keeps PRO until the Stripe billing period ends. Users cannot self-promote `plan_tier` without paying.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| PRO price | $9/month | Low-friction entry for junior candidates validating the wedge | Plan |
| Annual billing | Monthly only in v1 | Simplest Checkout + webhook surface; annual deferred per PRD OQ 2 | Plan |
| Cancel behavior | Keep PRO until Stripe period ends | Standard SaaS expectation; avoids refund disputes | Plan |
| Failed payment | 3-day grace, then downgrade | Balances recovery with abuse prevention | Plan |
| Soft-limit UX (OQ 4) | Silent daily-cap enforcement | Fastest UX; block with clear daily-limit message at 10/day | Plan |
| Checkout entry | Stripe Payment Link + auth redirect | Minimal code; append `client_reference_id` + email server-side | Plan |
| User binding | `client_reference_id` + email match in webhook | Prevents forged reference_id upgrades | Plan |
| Manage subscription | Stripe Customer Portal link on dashboard | Standard pattern; no custom cancel UI | Plan |
| Stripe data storage | IDs on `profiles` + `stripe_webhook_events` | Simple joins at solo-MVP scale; idempotent webhooks | Plan |
| `plan_tier` writes | Block user UPDATE + service-role RPC | Closes self-promote gap deferred since S-01 | Plan |
| Fair-use enforcement | SQL-primary (`usage_daily` + `finalize_generation_job`) | Atomic with generation metering; API pre-flight mirrors | Plan |
| Scope | Full S-05 in one change | Billing + fair-use together; satisfies FR-013–021 | Plan |

## Scope

**In scope:** Schema migration (Stripe columns, `usage_daily`, webhook events, RLS hardening), Stripe SDK + webhook handler, Payment Link redirect + Portal session routes, upgrade CTA wiring, PRO daily-cap enforcement, tests for new gates, env/docs updates.

**Out of scope:** Annual billing, custom in-app cancel UI, in-house billing, observability stack, CI workflows, check-cap SQL hardening (pre-flight sufficient for v1), JSON-LD / analytics.

## Architecture / Approach

Signed-in users hit `GET /api/billing/checkout-redirect` → redirect to Stripe Payment Link with `client_reference_id={userId}` and prefilled email. Stripe webhooks at `POST /api/webhooks/stripe` verify signature, dedupe via `stripe_webhook_events`, and call `set_plan_tier_from_billing()` via Supabase service role. Generation metering extends `finalize_generation_job` to increment `usage_daily` and block when PRO period count ≥ 100 and UTC-day count ≥ 10. `getUsageSummary` and `generate.ts` pre-flight mirror the same rules for fast 403s.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema & billing security | Stripe columns, `usage_daily`, webhook events, RLS + billing RPC | Migration ordering; breaking profile self-update |
| 2. Stripe integration | SDK, webhook handler, grace + lifecycle tier sync | Webhook idempotency; Vercel raw body for signature |
| 3. Checkout & portal UX | Payment Link redirect, Portal link, CTA wiring | Payment Link must be configured for $9/mo in Stripe Dashboard |
| 4. PRO fair-use enforcement | Daily cap in SQL + pre-flight + error copy | Gate math must match SQL atomically |
| 5. Tests & verification | Daily-cap unit/integration tests, webhook tests | Test oracle uses PRD literals not `limits.ts` imports |

**Prerequisites:** Stripe account with $9/mo Price + Payment Link + Customer Portal configured; Vercel env vars for prod/preview; `SUPABASE_SERVICE_ROLE_KEY` set.

**Estimated effort:** ~3–4 focused sessions across 5 phases.

## Open Risks & Assumptions

- Stripe Payment Link must allow `client_reference_id` query param passthrough (standard Stripe behavior).
- Google OAuth email must match Stripe checkout email — mismatch blocks upgrade (by design).
- Preview deployments need Stripe CLI or separate webhook endpoint for local/preview testing.
- `SUPABASE_SERVICE_ROLE_KEY` is required for the first time in app code — must stay server-only.

## Success Criteria (Summary)

- FREE at-limit user completes $9/mo checkout and sees PRO on `/app` within one webhook cycle.
- PRO user at 100+ period generations cannot exceed 10 generations on the same UTC day.
- Canceled subscription keeps PRO until `current_period_end`, then reverts to FREE.
- User cannot `UPDATE profiles.plan_tier` to PRO via authenticated client.
