<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stripe PRO Subscription

- **Plan**: context/changes/stripe-pro-subscription/plan.md
- **Scope**: Phases 1–5
- **Date**: 2026-07-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  6 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Missing checkout success banner

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/app/index.astro
- **Detail**: Phase 3.5 requires a one-time success banner when `?checkout=success` is present. No query-param handling exists.
- **Fix**: Read `Astro.url.searchParams` in index.astro; pass prop to UsageDashboard; render dismissible banner.
- **Decision**: ACCEPTED — Stripe Payment Link shows its own success page; in-app banner not needed.

### F2 — Webhook idempotency race

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/webhooks/stripe.ts:43-52
- **Detail**: Read-then-process-then-insert allowed concurrent double-processing.
- **Fix A ⭐ Recommended**: Insert event.id first with ON CONFLICT DO NOTHING; only process when insert succeeds.
- **Decision**: FIXED via Fix A — `claimStripeEvent` + `releaseStripeEventClaim` on processing failure.

### F3 — PRO daily cap not atomically enforced

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260701120000_pro_daily_cap_on_finalize.sql:115-159
- **Detail**: Daily cap used read-then-unconditional-increment; concurrent finalizes could exceed 10/day.
- **Fix**: Guarded upsert before period increment; transaction rolls back on period failure.
- **Decision**: FIXED

### F4 — checkout.completed always grants PRO

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/billing/process-stripe-webhook.ts:225-231
- **Detail**: Handler hardcoded `planTier: 'PRO'` without subscription status check.
- **Fix**: Fetch subscription and derive tier via `resolvePlanTierFromSubscription`.
- **Decision**: FIXED

### F5 — invoice.paid unconditionally sets PRO

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/billing/process-stripe-webhook.ts:312-318
- **Detail**: Always set PRO and cleared grace without checking subscription status.
- **Fix**: Load subscription and derive tier with `resolvePlanTierFromSubscription`.
- **Decision**: FIXED

### F6 — Generation pre-flight vs finalize TOCTOU

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice-sets/generate.ts:117-231
- **Detail**: Parallel POSTs can pass pre-flight gate and incur AI cost before finalize rejects.
- **Fix A ⭐ Recommended**: Accept as v1 — authoritative cap at finalize; document/monitor cost exposure.
- **Fix B**: Reserve quota at job creation via RPC increment/slot lock.
- **Decision**: ACCEPTED via Fix A — no code change.

### F7 — Checkout binding rejection is silent (200, no retry)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/billing/process-stripe-webhook.ts:192-209
- **Detail**: Email mismatch logs and returns 200; Stripe won't retry.
- **Fix A ⭐ Recommended**: Document ops playbook in deploy-plan.md; monitor `checkout binding rejected` logs.
- **Decision**: FIXED via Fix A — ops playbook added to deploy-plan.md.

### F8 — Manual verification still pending

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/stripe-pro-subscription/plan.md
- **Detail**: Manual items 4.4, 4.5, 5.4 unchecked; 5.5 (landing copy) appears done in code.
- **Fix**: Complete manual Stripe test-mode verification before marking impl complete.
- **Decision**: SKIPPED
