# Stripe PRO Subscription Implementation Plan

## Overview

Implement **S-05** from `context/foundation/roadmap.md`: Stripe-backed PRO subscription at **$9/month**, billing integrity (webhook-driven `plan_tier`), Customer Portal for manage/cancel, and full PRO fair-use enforcement (FR-016, FR-020, FR-021). Reuses F-01 server-route patterns, F-02 schema/metering, and S-01 usage dashboard — closes the last MVP monetization gap.

## Current State Analysis

- **`profiles.plan_tier`** exists (`FREE` default) with permissive RLS — authenticated users can self-update (`supabase/migrations/20260528194500_create_core_tables.sql:31-36`).
- **Usage metering** reads via `get_current_usage_summary` RPC; generation increments atomically in `finalize_generation_job` with hard cap only (FREE 1 / PRO 300) — no soft threshold or daily cap (`supabase/migrations/20260607120000_enforce_generation_cap_on_finalize.sql:91-123`).
- **Upgrade CTAs** link to `/#plans` / `#get-started` — no checkout (`src/components/app/UsageDashboard.astro:66-71`, `src/components/landing/Plans.astro`).
- **Stripe stubs** in `src/lib/server/env.ts` and `.env.example`; no `stripe` package, no billing routes, `SUPABASE_SERVICE_ROLE_KEY` unused in app code.
- **Tests** cover hard caps only; PRO daily/soft deferred to S-05 per `context/changes/testing-runner-and-critical-gating/research.md`.

### Key Discoveries

- Generation gate decision point: `getUsageSummary()` → `generate.ts:117-141` pre-flight; authoritative increment in `finalize_generation_job`.
- `generationSoftThreshold: 100` is a type literal only — not read anywhere (`src/lib/plan/limits.ts:12`).
- Phase 1 test oracle discipline: assert PRD literals in tests, not values imported from `limits.ts`.

## Desired End State

A signed-in FREE user at generation or Check limit can upgrade to PRO ($9/mo), see tier flip to PRO on the dashboard, generate under fair-use rules, and manage/cancel via Stripe Customer Portal. PRO generation above 100/period respects 10/day UTC cap until 300/period hard stop. Webhooks are idempotent; `plan_tier` cannot be self-promoted. Verify via automated tests + manual Stripe test-mode checkout.

## What We're NOT Doing

- Annual billing or multiple Price IDs
- Custom in-app subscription management UI (cancel/update card)
- Check-cap enforcement inside SQL (`increment_check_usage` stays uncapped; API pre-flight sufficient)
- Observability/analytics for billing funnel
- Rewriting landing pricing layout beyond CTA wiring and copy fixes
- `usage_period_anchor` migration (keep signup `created_at` anchor)

## Implementation Approach

1. **Schema first** — Stripe IDs, webhook dedupe table, `usage_daily`, RLS hardening, billing RPC.
2. **Stripe server integration** — SDK, webhook with raw body, service-role Supabase client, lifecycle + grace rules.
3. **UX wiring** — auth-gated redirect to Payment Link; Portal session for PRO; replace dead-end upgrade links.
4. **Fair-use** — extend SQL finalize path + mirror in TS pre-flight; silent daily-limit messaging.
5. **Tests** — daily-cap gates, webhook tier transitions, IDOR on billing routes.

### Critical Implementation Details

**Webhook raw body on Vercel:** Stripe signature verification requires the unparsed request body. The webhook route must read `request.text()` (or Astro equivalent) before JSON parse — do not use middleware that consumes the body.

**Payment Link binding security:** Webhook handler must upgrade only when `checkout.session.completed` has `client_reference_id` matching a profile `id` **and** `customer_details.email` (case-insensitive) matches `auth.users.email` for that id. Reject mismatch — log event id only, not PII.

**Cancel at period end:** On `customer.subscription.updated` with `cancel_at_period_end: true`, keep `plan_tier = 'PRO'` until `current_period_end`. Downgrade on `customer.subscription.deleted` or when period end passes and status is `canceled`.

**3-day grace:** On `invoice.payment_failed` for an active PRO subscription, set `subscription_grace_ends_at = now() + interval '3 days'` on profile (new column). Keep PRO while `now() < grace_ends_at`. Clear grace on `invoice.paid`. Downgrade to FREE when grace expires: `resolvePlanTierFromSubscription` must return FREE when `grace_ends_at <= now()` and subscription status is `past_due` or `unpaid` — evaluate on **every** webhook that syncs tier (not only on subsequent `invoice.payment_failed`).

## Phase 1: Schema & billing security

### Overview

Add Stripe persistence, daily usage tracking, webhook idempotency, and close the `plan_tier` self-promote gap.

### Changes Required

#### 1. Profiles billing columns

**File**: `supabase/migrations/<timestamp>_stripe_billing_schema.sql`

**Intent**: Store Stripe customer/subscription identifiers and grace-period state on the existing profile row.

**Contract**: Add nullable columns to `profiles`: `stripe_customer_id text unique`, `stripe_subscription_id text unique`, `subscription_grace_ends_at timestamptz null`. Index `stripe_customer_id` for webhook lookups.

#### 2. Webhook idempotency table

**File**: same migration

**Intent**: Prevent duplicate webhook processing.

**Contract**: `stripe_webhook_events (event_id text primary key, event_type text not null, processed_at timestamptz not null default now())`. No RLS — service role only.

#### 3. Daily generation counter

**File**: same migration

**Intent**: Track PRO fair-use daily cap (FR-020) per UTC calendar day.

**Contract**: `usage_daily (user_id uuid references profiles, usage_date date not null, generation_count integer not null default 0, primary key (user_id, usage_date))`. `usage_date` is UTC date (`(now() at time zone 'utc')::date`). RLS: select own row only; inserts/updates via security definer functions only.

#### 4. RLS hardening

**File**: same migration

**Intent**: Users must not change `plan_tier` or Stripe columns.

**Contract**: Drop `profiles_update_own`. Replace with narrow policy allowing authenticated update of non-billing columns only if needed — **prefer no authenticated UPDATE on profiles at all** (theme lives in `user_settings`). Authenticated retains SELECT own.

#### 5. Billing tier RPC

**File**: same migration

**Intent**: Server-only path for webhooks to set tier and Stripe IDs.

**Contract**: `set_plan_tier_from_billing(p_user_id uuid, p_plan_tier text, p_stripe_customer_id text, p_stripe_subscription_id text, p_grace_ends_at timestamptz)` — `security definer`, `search_path = public`, validates `p_plan_tier in ('FREE','PRO')`. Grant execute to `service_role` only.

#### 6. Extend usage read RPC

**File**: same migration

**Intent**: Expose daily count for gate math and dashboard.

**Contract**: Extend `get_current_usage_summary()` return shape with `daily_generation_count integer` (0 if no row for today UTC) and `period_generation_count` (alias existing `generation_count` if needed for clarity). Keep backward-compatible column names where possible; update `RpcRow` in `get-usage-summary.ts` accordingly.

#### 7. Test fixture alignment

**File**: `test/support/fake-supabase.ts`

**Intent**: Keep mocked RPC rows compatible with extended `get_current_usage_summary` shape.

**Contract**: Add `daily_generation_count: 0` default to `freeUserSummaryRow` and `proUserSummaryRow`.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `supabase db push` or project migration workflow
- `npm run build` passes
- `npm run astro -- check` passes

#### Manual Verification

- Authenticated Supabase client cannot `UPDATE profiles SET plan_tier = 'PRO'`
- `set_plan_tier_from_billing` callable with service role in SQL editor

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Stripe server integration

### Overview

Install Stripe SDK, add service-role Supabase client, implement signed webhook handler with lifecycle rules.

### Changes Required

#### 1. Dependencies & env

**File**: `package.json`, `.env.example`, `src/lib/server/env.ts`

**Intent**: Add Stripe SDK and configuration keys.

**Contract**: Add `stripe` npm dependency. Extend `EnvKey` with `STRIPE_PAYMENT_LINK_URL`. Document in `.env.example`: Payment Link URL, webhook secret, secret key, and note that Price ($9/mo) is configured in Stripe Dashboard on the Payment Link.

#### 2. Service-role Supabase client

**File**: `src/lib/supabase/admin.ts` (new)

**Intent**: Server-only client bypassing RLS for webhook writes.

**Contract**: `createSupabaseAdminClient()` using `requireEnv('SUPABASE_SERVICE_ROLE_KEY')` + `PUBLIC_SUPABASE_URL`. Never import from client bundles.

#### 3. Stripe client helper

**File**: `src/lib/billing/stripe.ts` (new)

**Intent**: Centralize Stripe SDK instantiation.

**Contract**: `getStripeClient()` returns configured `Stripe` instance with `requireEnv('STRIPE_SECRET_KEY')` and pinned API version.

#### 4. Webhook handler

**File**: `src/pages/api/webhooks/stripe.ts`

**Intent**: Process Stripe events idempotently and sync `plan_tier`.

**Contract**: `POST` only, `prerender = false`. Verify `Stripe-Signature` with raw body + `STRIPE_WEBHOOK_SECRET`. For `checkout.session.completed`, fetch the Supabase auth user email via `createSupabaseAdminClient().auth.admin.getUserById(client_reference_id)` before calling `validateCheckoutBinding`. Handle at minimum:

| Event | Action |
|---|---|
| `checkout.session.completed` | Validate `client_reference_id` + email; read `session.customer` and `session.subscription`; call `set_plan_tier_from_billing(..., 'PRO', ...)`; store customer/subscription ids |
| `customer.subscription.updated` | Sync tier: PRO if `active` or (`past_due` and within grace); FREE if `canceled`/`unpaid` after period end |
| `customer.subscription.deleted` | Downgrade to FREE; clear subscription id |
| `invoice.payment_failed` | Set grace `now()+3 days`; keep PRO |
| `invoice.paid` | Clear grace |

Insert `event.id` into `stripe_webhook_events` **after** successful processing. On duplicate `event.id` (unique violation), return 200 without re-processing. Return 200 for handled events; 400 on signature failure; 500 on processing failure so Stripe retries.

#### 5. Billing logic module

**File**: `src/lib/billing/sync-subscription.ts` (new)

**Intent**: Pure functions for tier decisions from Stripe subscription objects — testable without HTTP.

**Contract**: `resolvePlanTierFromSubscription(subscription, graceEndsAt): 'FREE' | 'PRO'`, `validateCheckoutBinding(userId, sessionEmail, profileEmail): boolean`. `resolvePlanTierFromSubscription` returns FREE when `graceEndsAt <= now()` and subscription status is `past_due` or `unpaid`, regardless of other active signals.

### Success Criteria

#### Automated Verification

- `npm run test` passes (new unit tests for `sync-subscription.ts`)
- `npm run build` passes

#### Manual Verification

- Stripe CLI `stripe listen --forward-to localhost:4321/api/webhooks/stripe` processes test `checkout.session.completed`
- Duplicate event id does not double-upgrade
- Email mismatch does not upgrade tier

**Implementation Note**: Pause for manual webhook smoke before Phase 3.

---

## Phase 3: Checkout & portal UX

### Overview

Wire upgrade paths to Stripe Payment Link (auth-bound) and add Customer Portal for PRO users.

### Changes Required

#### 1. Payment Link redirect route

**File**: `src/pages/api/billing/checkout-redirect.ts`

**Intent**: Signed-in users get a server-built Payment Link URL with binding params.

**Contract**: `GET`, auth required (`getUser()`). Redirect 302 to `{STRIPE_PAYMENT_LINK_URL}?client_reference_id={user.id}&prefilled_email={encodeURIComponent(user.email)}`. 401 if unauthenticated.

#### 2. Customer Portal session route

**File**: `src/pages/api/billing/portal.ts`

**Intent**: PRO users open Stripe Portal to cancel or update card.

**Contract**: `GET`, auth required. Require `profiles.stripe_customer_id`; if missing, 404 with friendly message. Create `stripe.billingPortal.sessions.create({ customer, return_url: PUBLIC_SITE_URL + '/app' })`; redirect to portal URL.

#### 3. Upgrade CTA wiring

**Files**:
- `src/components/app/UsageDashboard.astro`
- `src/components/app/GeneratePracticeFlow.tsx`
- `src/components/app/OpenEndedFlow.tsx`
- `src/components/landing/Plans.astro`

**Intent**: Replace `/#plans` dead-ends with checkout redirect for FREE upgrade paths.

**Contract**: FREE upgrade links → `/api/billing/checkout-redirect`. Landing PRO CTA: signed-out → `#get-started` / sign-in; document that post-sign-in upgrade uses checkout redirect. PRO dashboard: add "Manage subscription" link → `/api/billing/portal`.

#### 4. API error payload upgrade URLs

**Files**: `src/pages/api/practice-sets/generate.ts`, `src/pages/api/practice-sets/[id]/check.ts`

**Intent**: FREE 403 responses point to checkout, not `/#plans`.

**Contract**: `upgradeUrl: '/api/billing/checkout-redirect'` when `planTier === 'FREE'`.

#### 5. Success return handling

**File**: `src/pages/app/index.astro` (or dedicated `/app/billing/success` page)

**Intent**: After Payment Link success redirect, user sees refreshed tier.

**Contract**: Configure Payment Link success URL to `{PUBLIC_SITE_URL}/app?checkout=success`. Dashboard shows one-time success banner when `checkout=success` query present (no sensitive data in URL).

#### 6. Update integration test oracle

**File**: `test/integration/api/practice-sets/generate.test.ts`

**Intent**: Keep test oracle aligned with new checkout redirect path.

**Contract**: Change `upgradeUrl` assertion from `'/#plans'` to `'/api/billing/checkout-redirect'`.

### Success Criteria

#### Automated Verification

- `npm run build` passes
- Integration test: unauthenticated `GET /api/billing/checkout-redirect` → 401
- Integration test: unauthenticated `GET /api/billing/portal` → 401

#### Manual Verification

- FREE user clicks Upgrade → Stripe Payment Link with correct email prefilled
- After test checkout, `/app` shows PRO within webhook latency
- PRO user opens Manage subscription → Stripe Portal

**Implementation Note**: Pause for manual checkout smoke before Phase 4.

---

## Phase 4: PRO fair-use enforcement

### Overview

Enforce FR-020 daily cap (10/day UTC when period count > 100) in SQL and API pre-flight; align error messages with silent-enforcement UX decision.

### Changes Required

#### 1. Extend finalize_generation_job

**File**: `supabase/migrations/<timestamp>_pro_daily_cap_on_finalize.sql`

**Intent**: Atomically enforce daily cap alongside period hard cap.

**Contract**: After resolving `v_plan_tier` and period count, when PRO and period count ≥ 100 (before increment):

- Read/increment `usage_daily` for `(user_id, utc_today)`
- Block with `raise exception 'Daily generation limit reached'` if daily count ≥ 10
- On successful period increment, also increment `usage_daily.generation_count`

When period count < 100, skip daily check (normal pace). Hard cap 300 unchanged.

#### 2. Gate math in getUsageSummary

**File**: `src/lib/plan/get-usage-summary.ts`

**Intent**: Pre-flight matches SQL rules for fast 403s.

**Contract**: Extend `UsageSummary` with `generationLimitReason: 'none' | 'period' | 'daily'`. For PRO:

- `isAtGenerationLimit` true if period remaining = 0 **or** (period used ≥ 100 and daily used ≥ 10)
- `generationLimitReason`: `'daily'` when period used ≥ 100 and daily used ≥ 10; `'period'` when at hard cap (300) or FREE at limit; `'none'` otherwise
- `generationRemaining` for display: when period used < 100, `min(100 - used, 300 - used)` for UX hint; when ≥ 100, `max(0, 10 - dailyUsed)` capped by period hard remaining
- `generationLimit` for display: when `generationLimitReason === 'daily'`, use `10`; when period used < 100 on PRO, use `100` (soft threshold hint); otherwise use hard cap (300) or FREE limit

Keep `proFairUseNote` or replace with shorter copy only if needed for silent UX.

#### 3. Generate API pre-flight messages

**File**: `src/pages/api/practice-sets/generate.ts`

**Intent**: Distinguish hard period cap vs daily cap in 403 responses.

**Contract**: Branch on `usageSummary.data.generationLimitReason`:

- `'daily'` → 403 `daily_generation_limit_reached` — "You have reached today's generation limit. Try again tomorrow (UTC)."
- `'period'` → 403 `generation_limit_reached` — period hard cap (300) or FREE limit

#### 4. Generate worker error surfacing

**File**: `src/pages/api/practice-sets/generate-worker.ts`

**Intent**: Map SQL daily-cap exception to job failure code client can display.

**Contract**: On `finalize_generation_job` failure containing daily limit, set `failure_code: 'daily_generation_limit_reached'`.

### Success Criteria

#### Automated Verification

- Unit tests: `get-usage-summary.test.ts` covers PRO at period 100 with daily 10 → `isAtGenerationLimit`
- Integration test: `generate.test.ts` returns 403 `daily_generation_limit_reached` when RPC row simulates PRO above soft with daily exhausted
- `npm run test` passes

#### Manual Verification

- PRO test user with period count 100+ cannot generate 11th set same UTC day
- PRO test user can generate again next UTC day (with period < 300)

**Implementation Note**: Pause for manual fair-use verification before Phase 5.

---

## Phase 5: Tests, copy fixes & verification

### Overview

Close test-plan deferred gaps for PRO daily cap; add webhook tests; fix landing copy drift; document Stripe Dashboard setup.

### Changes Required

#### 1. Webhook integration tests

**File**: `test/integration/api/webhooks/stripe.test.ts`

**Intent**: Lock tier sync behavior without live Stripe.

**Contract**: Mock Stripe signature verification helper; invoke handler with fixture payloads for checkout complete (happy + email mismatch), subscription deleted, payment failed (grace set). Assert `set_plan_tier_from_billing` called via mocked admin client.

#### 2. Billing route tests

**File**: `test/integration/api/billing/checkout-redirect.test.ts`, `portal.test.ts`

**Intent**: Auth boundary on billing routes.

**Contract**: 401 unauthenticated; 302 authenticated with redirect URL containing `client_reference_id`.

#### 3. Landing copy fix

**File**: `src/components/landing/Plans.astro`

**Intent**: Align FREE Check limit with PRD (5, not 1).

**Contract**: Update marketing copy to "5 Checks per usage period".

#### 4. Deploy / setup notes

**File**: `context/deployment/deploy-plan.md` (addendum section only)

**Intent**: Document Stripe Payment Link, webhook endpoint URL, Portal config, and Vercel env vars for prod/preview.

**Contract**: Webhook URL `https://prepahead.dev/api/webhooks/stripe`; note Stripe CLI for local dev.

### Success Criteria

#### Automated Verification

- `npm run test` passes
- `npm run build` passes
- `npm run astro -- check` passes

#### Manual Verification

- Full E2E in Stripe test mode: FREE → checkout → PRO → generate → cancel in Portal → FREE at period end
- Preview deployment webhook receives test event (or CLI forward documented)

---

## Testing Strategy

### Unit Tests

- `resolvePlanTierFromSubscription` — active, past_due within/outside grace, canceled
- `validateCheckoutBinding` — email match/mismatch
- `getUsageSummary` — PRO daily cap gate at soft threshold boundary (99/100/101 period counts)

### Integration Tests

- Billing routes auth (401)
- Generate 403 daily cap (mocked RPC row)
- Webhook idempotency and tier transitions (mocked Stripe + admin client)

### Manual Testing Steps

1. Sign in as FREE user at generation limit → Upgrade → complete Stripe test checkout → verify PRO on dashboard.
2. Set PRO user period count to 100 via SQL → generate 10 sets same UTC day → 11th blocked with daily message.
3. Cancel subscription in Portal → verify PRO until period end → verify FREE after `subscription.deleted` webhook.
4. Simulate `invoice.payment_failed` → PRO retained → after 3 days without `invoice.paid` → FREE.
5. Attempt `UPDATE profiles SET plan_tier = 'PRO'` via browser Supabase client → denied.

## Performance Considerations

Webhook handler must respond within Stripe's timeout (~20s); keep DB work to single RPC per event. Daily counter upsert is O(1) per finalize. No hot-path Stripe API calls during generation — tier read from `profiles` only.

## Migration Notes

- Existing users: `stripe_customer_id` null until first checkout; remain FREE.
- No backfill required for `usage_daily` — lazy creation on first post-soft generation.
- Manual PRO users in dev (SQL `plan_tier = 'PRO'`) continue to work without Stripe ids; Portal link shows not-available state.

## References

- Roadmap S-05: `context/foundation/roadmap.md`
- PRD billing: `context/foundation/prd.md` (FR-013, FR-016, FR-020, FR-021, US-02)
- Deferred daily cap research: `context/changes/testing-runner-and-critical-gating/research.md`
- Generation metering pattern: `supabase/migrations/20260607120000_enforce_generation_cap_on_finalize.sql`
- Server API pattern: `context/changes/server-api-foundation/plan-brief.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Schema & billing security

#### Automated

- [ ] 1.1 Migration applies cleanly
- [ ] 1.2 `npm run build` passes
- [ ] 1.3 `npm run astro -- check` passes

#### Manual

- [ ] 1.4 Authenticated client cannot self-update `plan_tier`
- [ ] 1.5 `set_plan_tier_from_billing` works via service role

### Phase 2: Stripe server integration

#### Automated

- [ ] 2.1 `npm run test` passes (sync-subscription unit tests)
- [ ] 2.2 `npm run build` passes

#### Manual

- [ ] 2.3 Stripe CLI webhook smoke — checkout.session.completed
- [ ] 2.4 Duplicate event id skipped
- [ ] 2.5 Email mismatch rejected

### Phase 3: Checkout & portal UX

#### Automated

- [ ] 3.1 `npm run build` passes
- [ ] 3.2 Checkout redirect 401 when unauthenticated
- [ ] 3.3 Portal route 401 when unauthenticated

#### Manual

- [ ] 3.4 FREE upgrade → Payment Link with prefilled email
- [ ] 3.5 Post-checkout dashboard shows PRO
- [ ] 3.6 PRO Manage subscription opens Portal

### Phase 4: PRO fair-use enforcement

#### Automated

- [ ] 4.1 Daily-cap unit tests in get-usage-summary.test.ts
- [ ] 4.2 Generate integration test for daily_generation_limit_reached
- [ ] 4.3 `npm run test` passes

#### Manual

- [ ] 4.4 PRO 11th generation same UTC day blocked
- [ ] 4.5 Generation allowed next UTC day (period < 300)

### Phase 5: Tests, copy fixes & verification

#### Automated

- [ ] 5.1 `npm run test` passes
- [ ] 5.2 `npm run build` passes
- [ ] 5.3 `npm run astro -- check` passes

#### Manual

- [ ] 5.4 Stripe test-mode E2E checkout → cancel lifecycle
- [ ] 5.5 Landing FREE Check copy shows 5
