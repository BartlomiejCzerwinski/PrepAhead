<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Stripe PRO Subscription

- **Plan**: `context/changes/stripe-pro-subscription/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-30
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 1 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — Daily vs period limit errors indistinguishable

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Phase 4 — getUsageSummary + generate.ts
- **Detail**: Phase 4 promises distinct 403 codes but `getUsageSummary` only exposes `isAtGenerationLimit` boolean; `generate.ts` cannot branch without an additional signal.
- **Fix A ⭐ Recommended**: Add `generationLimitReason: 'none' | 'period' | 'daily'` to `UsageSummary`
- **Decision**: FIXED via Fix A

### F2 — Grace period expiry has no reliable trigger

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — webhook lifecycle
- **Detail**: Downgrade after grace relied on subsequent Stripe events that may never arrive.
- **Fix A ⭐ Recommended**: Evaluate `grace_ends_at <= now()` in `resolvePlanTierFromSubscription` on every tier-sync webhook
- **Decision**: FIXED via Fix A

### F3 — Webhook idempotency may block Stripe retries

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — webhook handler
- **Detail**: Insert-before-process loses Stripe retries on handler crash.
- **Fix**: Insert event row after successful processing; return 500 on failure for retry
- **Decision**: FIXED

### F4 — Email verification path underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — webhook handler
- **Detail**: Plan requires `auth.users.email` match but no step fetches email via admin API.
- **Fix**: Add `auth.admin.getUserById` before `validateCheckoutBinding`
- **Decision**: FIXED

### F5 — generate.test.ts upgradeUrl assertion not in plan scope

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3
- **Detail**: `generate.test.ts:57` asserts `/#plans`; Phase 3 changes API path without listing test update.
- **Fix**: Add Phase 3 step to update assertion to `/api/billing/checkout-redirect`
- **Decision**: FIXED

### F6 — fake-supabase RPC fixtures missing from plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1
- **Detail**: Extended RPC shape not reflected in `freeUserSummaryRow` / `proUserSummaryRow`.
- **Fix**: Add Phase 1 step for `daily_generation_count: 0` default in fixtures
- **Decision**: FIXED

### F7 — PRO dashboard may show mismatched remaining/limit

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 4 — UsageSummary display
- **Detail**: `generationRemaining` changes but `generationLimit` may still show 300 during daily-cap phase.
- **Fix**: Align display `generationLimit` to 10 (daily) or 100 (pre-soft) per `generationLimitReason`
- **Decision**: FIXED

### F8 — Subscription ID retrieval implicit for Payment Link

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — checkout.session.completed
- **Detail**: Plan doesn't specify reading `session.customer` and `session.subscription`.
- **Fix**: Add explicit fields to webhook handler contract
- **Decision**: FIXED
