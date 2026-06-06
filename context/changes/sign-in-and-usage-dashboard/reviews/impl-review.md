<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sign-in and usage dashboard

- **Plan**: context/changes/sign-in-and-usage-dashboard/plan.md
- **Scope**: All 4 phases
- **Date**: 2026-06-06
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification (re-run 2026-06-06)

| Command | Result |
|---------|--------|
| `npm run build` | PASS — exit 0 |
| `npm run astro -- check` | PASS — 0 errors, 0 warnings |

## Manual verification

All 17 Progress manual items marked `[x]` with commit SHAs. User confirmed Preview smoke ("all working good") during implementation.

## Findings

### F1 — Silent FREE fallback for unknown `plan_tier`

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/plan/get-usage-summary.ts:54
- **Detail**: Any `plan_tier` value other than exactly `'PRO'` is treated as FREE. The DB `CHECK` constraint mitigates this in normal operation, but schema drift or an RPC bug would under-display PRO limits rather than surface an error.
- **Fix**: Validate tier explicitly — if not `FREE` or `PRO`, return `{ ok: false, error: 'query_failed' }` instead of silently downgrading.
- **Decision**: PENDING

### F2 — Unused `userId` parameter in `getUsageSummary`

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/plan/get-usage-summary.ts:31-33
- **Detail**: `getUsageSummary(supabase, _userId)` accepts `userId` but never uses it. Identity comes from the Supabase JWT session via RPC `auth.uid()`. Future callers might assume the param scopes the read.
- **Fix**: Drop the unused parameter and update the call site in `src/pages/app/index.astro`, or add a one-line comment that identity is session-scoped only.
- **Decision**: PENDING

### F3 — RPC period-resolution failure lacks stable errcode

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260605120000_current_usage_read_rpc.sql:40-42
- **Detail**: Period-resolution failure raises a generic exception without a stable `errcode` (unlike `28000` / `P0002` elsewhere). TypeScript maps this to generic `query_failed`, same as transient network errors.
- **Fix**: Add `using errcode = 'P0001'` (or similar) on the period-resolution exception so the app can distinguish deterministic failures from transient errors if finer UX is needed later.
- **Decision**: PENDING

### F4 — Authenticated `/login?next=…` always redirects to `/app`

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/middleware.ts:54-57
- **Detail**: Signed-in user visiting `/login?next=/some-path` is always redirected to `/app`, ignoring `next`. OAuth post-sign-in flow is verified; this edge case for already-authenticated deep links is not handled.
- **Fix**: Read and sanitize `next` from query params before redirecting signed-in users away from `/login`, matching callback behavior — or document as intentional for MVP.
- **Decision**: PENDING
