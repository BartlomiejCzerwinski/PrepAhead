<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Supabase OAuth Auth Implementation Plan

- **Plan**: context/changes/supabase-oauth-auth/plan.md
- **Scope**: Phases 1–4 of 4 (all completed)
- **Date**: 2026-05-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated verification

| Command | Result |
|---------|--------|
| `npm run build` | PASS (exit 0) |
| `npm run astro -- check` | PASS (0 errors, 0 warnings) |
| `package.json` lists `@supabase/ssr` + `@supabase/supabase-js` | PASS |

## Findings

### F1 — Encoded-slash open redirect in `safeAuthRedirectPath`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/server/auth-redirect.ts:32-46
- **Detail**: Validator rejects `//` and `://` on the raw string but accepts paths like `/%2f%2fevil.com`. Browsers decode `%2f` in `Location` headers, which can become a protocol-relative off-site redirect after OAuth. Plan Phase 4 manual criterion requires external `next` cannot redirect off-site; encoded variants bypass current checks. Affects callback, sign-in, middleware, and login hidden field paths.
- **Fix**: After trim, reject paths containing `%` (or decode once in try/catch and re-run the same rules). Reject backslashes and control characters. Add regression cases for `/%2f%2f…` and `//…`.
  - Strength: Closes the bypass without changing happy-path `/app` redirects.
  - Tradeoff: Slightly stricter — legitimate paths with `%` in query strings are already excluded (path-only validator).
  - Confidence: HIGH — standard open-redirect hardening pattern.
  - Blind spot: Exact browser `Location` normalization across Safari/Firefox/Chrome should be spot-checked once.
- **Decision**: PENDING

### F2 — Middleware fail-open when `getUser()` throws

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:59-69
- **Detail**: Only `MissingEnvError` on `/app/*` triggers login redirect. Other errors from `supabase.auth.getUser()` fall through to `next()` with `locals.user` still null, so `/app` may render without the auth gate. Low exposure today (stub page) but breaks the protection contract before S-01 adds real signed-in content.
- **Fix A ⭐ Recommended**: On `/app/*`, if `getUser()` throws for any reason, redirect to `/login?error=session` (generic code; no error body logging).
  - Strength: Preserves fail-closed gate aligned with plan middleware intent.
  - Tradeoff: Transient Supabase outages block `/app` entirely until recovery.
  - Confidence: HIGH — matches security expectation for protected routes.
  - Blind spot: None significant for MVP.
- **Fix B**: Render a dedicated 503 “auth unavailable” page for `/app` only
  - Strength: Distinguishes outage from “please sign in”.
  - Tradeoff: Extra route/copy; still must not render signed-in content.
  - Confidence: MEDIUM — better UX but more surface area.
  - Blind spot: Whether marketing should link to that page.
- **Decision**: PENDING

### F3 — `oauth_next` cookie survives failed code exchange

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/pages/api/auth/callback.ts:33-35
- **Detail**: On `exchange_failed`, `oauth_next` is not deleted (only cleared on success). A stale cookie could affect the next successful sign-in destination.
- **Fix**: Call `cookies.delete(OAUTH_NEXT_COOKIE, { path: '/' })` on all error return paths before redirecting to `/login`.
- **Decision**: PENDING

### F4 — Optional `locals.supabase` not typed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/env.d.ts:7-9
- **Detail**: Phase 1 contract lists optional `Astro.locals.supabase`; only `user` is declared. No runtime impact — middleware creates clients per request without exposing on locals.
- **Fix**: Add optional `supabase` to `App.Locals`, or note in plan that per-request factory without locals exposure was chosen.
- **Decision**: PENDING

## Prior review (2026-05-30, same day)

Earlier pass flagged middleware header forwarding, unplanned `astro.config.mjs` / `preview.mjs`, browser export naming, and `next` sanitization — all addressed in code and plan Phase 4 addendum §5. Not re-opened.
