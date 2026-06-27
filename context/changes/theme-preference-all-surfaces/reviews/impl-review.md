<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Theme preference on all surfaces

- **Plan**: context/changes/theme-preference-all-surfaces/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-06-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria (re-run)

- `npm run build` — PASS (build complete, all static routes prerendered).
- `npm run astro -- check` — PASS (0 errors, 0 warnings; 1 pre-existing hint in `src/components/app/GeneratePracticeFlow.tsx`, outside this change).
- "Lint passes" — N/A: no `lint` script exists in `package.json`. No backing command.

## Git scope

Commits `7cfa638` (p1), `6bb89c0` (p2), `d0b0b49` (p3), `c4e0e72` (epilogue). Changed source files exactly match the plan's file list — no unplanned files, no scope creep.

## Findings

### F1 — Best-effort theme read can log a user out

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/middleware.ts:71-81
- **Detail**: The cross-device theme restore query sat inside the auth `try` block. A transport-level throw on that optional `user_settings` select would hit the `catch` and redirect a signed-in `/app` user to `/login?error=session` — logging them out over a purely cosmetic read. `callback.ts` already isolates its reconcile; middleware did not.
- **Fix**: Wrap the theme read in its own best-effort try/catch so a failed read never affects auth/redirect.
- **Decision**: FIXED (Fix now) — isolated the read in a dedicated try/catch.

### O1 — Inline anti-FOUC script precedes <meta charset>

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/layouts/Layout.astro:25-40
- **Detail**: The `is:inline` theme script sat before `<meta charset="UTF-8">`. Functionally fine, but charset-first is conventional.
- **Fix**: Move `<meta charset>` (and viewport) above the inline script. The script still runs pre-paint before any stylesheet/body content.
- **Decision**: FIXED (Fix now).

### O2 — Duplicated constants

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason
- **Dimension**: Pattern Consistency
- **Location**: src/middleware.ts:8-12, src/pages/api/auth/callback.ts (THEME_COOKIE_OPTIONS); src/styles/global.css (dark tokens duplicated in :root.dark and the media fallback)
- **Detail**: `THEME_COOKIE_OPTIONS` was defined in two server files. (The CSS dark-token duplication is inherent to keeping a no-JS fallback and was left as-is.)
- **Fix**: Extract `THEME_COOKIE_OPTIONS` into a shared module and import it in both files.
- **Decision**: FIXED (Fix now) — created `src/lib/theme/server.ts`; middleware.ts and callback.ts now import it. CSS duplication intentionally left.

### O3 — Redundant getUser() in sign-in reconcile

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/pages/api/auth/callback.ts (reconcileThemePreference)
- **Detail**: `reconcileThemePreference` calls `getUser()` again after `exchangeCodeForSession` already established the session — one extra round-trip on the callback path.
- **Fix**: Pass the user from `exchangeCodeForSession` into reconcile.
- **Decision**: SKIPPED — `getUser()` is server-validated, callback-only, and the cost is negligible. Kept as-is.
