# Sign-in and usage dashboard — Plan Brief

> Full plan: `context/changes/sign-in-and-usage-dashboard/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-01)
> PRD: `context/foundation/prd.md` (FR-001, FR-012, US-02)

## What & Why

Signed-in candidates need to see their plan and remaining allowance before they paste a job description. **S-01** replaces the `/app` placeholder with a thin usage dashboard that satisfies **FR-012** and sets up **US-02** upgrade messaging — without building generation, Check, or Stripe yet.

## Starting Point

**F-03** ships Google OAuth, middleware on `/app/*`, and a stub page showing email only. **F-02** ships `profiles.plan_tier`, `usage_periods` counters, and increment RPCs — but no read path in app code and no current-usage read RPC yet. Blog CTAs already route to `/app`.

## Desired End State

After sign-in, `/app` shows a minimal app shell with plan badge (FREE or PRO), remaining practice-set generations and Check calls for the current rolling usage period, localized reset datetime, and an upgrade link to `/#plans` when FREE limits are exhausted. F-03 security gaps (encoded-slash redirect, middleware fail-open) are closed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| App chrome | New minimal `AppLayout` | Clear signed-in boundary; room for S-02 practice UI | Plan |
| Usage read path | Authenticated read RPC + server helper | Keeps rolling-period math in Postgres and avoids JS/Postgres drift | Plan |
| PRO display | Both tiers read-only | FR-012 covers FREE and PRO; ready when S-05 flips tier | Plan |
| At-limit CTA | Link to `/#plans` | US-02 upgrade path without Stripe in S-01 | Plan |
| Security fixes | Include F1 + F2 from F-03 follow-ups | Real dashboard raises stakes; deferred explicitly "before S-01" | Plan |
| DB read failure | Graceful partial page + retry banner | User stays signed in; no misleading quota data | Plan |
| Reset display | User-local formatted date/time | FR-012 readability; UTC anchor noted in helper text | Plan |

## Scope

**In scope:** Plan limit constants module; authenticated current-usage read RPC; `getUsageSummary()` server helper; `AppLayout` + dashboard UI on `/app`; F1/F2 auth hardening; login error copy for `session`; `npm run build` + `astro check`; manual RLS smoke.

**Out of scope:** Generation UI (S-02), increment RPC calls (S-02/S-04), Stripe checkout (S-05), theme toggle (S-06), React islands, new write-side usage RPCs beyond the read helper, `plan_tier` write protection (server-only updates land in S-05), automated test runner.

## Architecture / Approach

`app/index.astro` (`prerender = false`) calls `createSupabaseServerClient` and then a `getUsageSummary()` helper backed by a small authenticated read RPC. The shared `src/lib/plan/` module holds FREE/PRO limits while Postgres remains the source of truth for rolling-period math. `AppLayout` wraps dashboard cards; upgrade CTA links to landing pricing. Middleware and `safeAuthRedirectPath` are hardened per F-03 impl-review.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Plan + usage read layer | Constants + read RPC + `getUsageSummary()` | Migration adds a new DB contract for a read-only slice |
| 2. Auth hardening | F1 encoded-slash + F2 fail-closed `/app` | Transient Supabase outage blocks `/app` entirely |
| 3. App shell + dashboard UI | `AppLayout`, usage cards, upgrade CTA | PRO fair-use copy complexity |
| 4. Verification | Build/check + manual smoke | RLS proof needs two test accounts |

**Prerequisites:** F-01, F-02, F-03 complete; `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` set.

**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Users can still `UPDATE profiles.plan_tier` via direct Supabase client until S-05 adds server-only tier writes — acceptable for MVP (no PRO users yet).
- The new read RPC becomes a small contract surface that later slices should reuse instead of re-reading `profiles` + `usage_periods` independently.
- PRO daily-cap (FR-020) is not displayed in S-01 — only period totals and fair-use helper text.

## Success Criteria (Summary)

- Signed-in FREE user sees plan, 1/1 remaining allowances (or less if used), and reset time.
- User with no `usage_periods` row sees full allowance (0 used).
- At-limit FREE user sees upgrade link to `/#plans`.
- Second account never sees first account's plan or usage in the UI after a separate sign-in session.
