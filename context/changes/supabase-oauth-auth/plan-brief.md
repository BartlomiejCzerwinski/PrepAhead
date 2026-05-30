# Supabase OAuth Auth — Plan Brief

> Full plan: `context/changes/supabase-oauth-auth/plan.md`

## What & Why

Candidates must sign in before practice flows (FR-001, Access Control). F-03 delivers the identity foundation: Google OAuth via Supabase Auth, SSR session cookies, middleware-gated `/app/*` routes, and proof that the F-02 schema bootstrap (`handle_new_user`) and RLS isolation work with real user JWTs.

## Starting Point

F-01 (on-demand API routes, `src/lib/server/` helpers) and F-02 (Postgres schema, RLS, `handle_new_user` trigger) are complete. Env var names exist in `.env.example`; no Supabase SDK, middleware, auth routes, or login UI exist yet. Landing CTA is a disabled “Sign in coming soon” placeholder.

## Desired End State

A candidate can visit `/login`, sign in with Google, land on `/app` with a valid session, and see a minimal signed-in stub. Unauthenticated requests to `/app/*` redirect to `/login`. Sign-out clears the session. Manual verification confirms profile/settings rows are created on first sign-in and RLS blocks cross-user reads. S-01 replaces the stub with the usage dashboard.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| OAuth provider | Google only | Fastest path to FR-001; matches roadmap and archived shape notes | Plan |
| Route protection | Astro middleware + `/app/*` prefix | Single gate for all future practice routes | Plan |
| Sign-in UX | Dedicated `/login` page | Standard OAuth entry; blog CTAs can deep-link later | Plan |
| Post-auth redirect | `/app` with safe `?next=` | Matches protected prefix; supports return URLs without open redirects | Plan |
| Local OAuth dev | Hosted Supabase project | Real Google OAuth without local redirect URL drift | Plan |
| Server session access | Shared `@supabase/ssr` helper | Consistent cookies; user JWT for future RLS/RPC calls | Plan |
| Verification scope | OAuth E2E + RLS cross-user proof | Closes F-02 deferral; validates identity + isolation | Plan |

## Scope

**In scope:** `@supabase/ssr` + `@supabase/supabase-js`; server/browser client factories; `/api/auth/sign-in`, `callback`, `sign-out`; middleware; `/login`; `/app` stub (`prerender = false`); landing CTA wired; env/deploy docs for OAuth redirect URLs; manual OAuth + RLS verification.

**Out of scope:** Usage dashboard (S-01); practice/generation UI; additional OAuth providers; shadcn polish; automated test harness; blog CTA wiring (S-08); service-role reads for normal user ops.

## Architecture / Approach

Static marketing pages stay prerendered. Auth lifecycle runs in on-demand API routes (`prerender = false`) using `@supabase/ssr` cookie adapters. Middleware calls `getUser()` each request to refresh tokens and attach `Astro.locals.user`. Protected `/app/**` pages opt out of prerendering so middleware runs at request time. OAuth flow: `/login` → POST `/api/auth/sign-in` → Google → GET `/api/auth/callback` (code exchange) → redirect `/app`. DB writes use the user JWT (not service role); `handle_new_user` creates `profiles` + `user_settings` on first Auth insert.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dependencies & clients | Packages + shared Supabase client factories + `App.Locals` | Cookie adapter wiring must match across middleware and API routes |
| 2. Auth API routes | OAuth sign-in, callback, sign-out with safe `?next=` | Redirect URL mismatch with Supabase dashboard |
| 3. Middleware, routes & UI | Gate `/app/*`, `/login` page, landing CTA, stub + sign-out | Static output — middleware only runs on-demand unless pages are `prerender = false` |
| 4. Docs & verification | Env/deploy notes; OAuth E2E + RLS proof checklist | Preview deploy URL must be in Supabase allowlist |

**Prerequisites:** F-01 and F-02 complete; hosted Supabase project with Google provider enabled; Google Cloud OAuth client configured; Vercel env vars set for Preview/Production.

**Estimated effort:** ~2–3 focused sessions across 4 phases.

## Open Risks & Assumptions

- Supabase dashboard redirect URLs must include production, localhost, and Vercel Preview origins — misconfiguration is the #1 OAuth failure mode.
- Two Google test accounts (or Supabase Auth admin tooling) are needed for RLS cross-user proof.
- `PUBLIC_SITE_URL` must match the origin used in OAuth `redirectTo` (Preview vs Production).

## Success Criteria (Summary)

- Candidate completes Google sign-in and reaches `/app` with session cookies set.
- Unauthenticated `/app` access redirects to `/login`.
- First sign-in creates `profiles` + `user_settings` via existing trigger.
- Authenticated user A cannot read user B's rows under RLS.
