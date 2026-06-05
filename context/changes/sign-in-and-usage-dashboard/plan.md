# Sign-in and usage dashboard Implementation Plan

## Overview

Implement **S-01** from `context/foundation/roadmap.md`: replace the `/app` stub with a read-only usage dashboard that satisfies **FR-012** (plan tier, remaining generations and Check calls, period reset time) and surfaces **US-02** upgrade messaging when FREE limits are exhausted. Reuses F-02 schema reads and F-03 auth; does not call increment RPCs or add Stripe.

Also closes deferred F-03 security items **F1** (encoded-slash open redirect) and **F2** (middleware fail-open on `/app/*`).

## Current State Analysis

- **Auth works:** Google OAuth, session cookies, middleware gates `/app/*` → `/login` (`src/middleware.ts`, `src/pages/api/auth/*`).
- **`/app` is a stub:** `src/pages/app/index.astro` shows email/id and placeholder copy only.
- **Schema ready, app reads absent:** `profiles.plan_tier`, `usage_periods.generation_count` / `check_count`, increment RPCs exist in `supabase/migrations/`; no `src/` queries against these tables.
- **No read RPC yet:** `current_usage_period_bounds()` is internal-only (revoked from `authenticated`). S-01 adds a small read RPC so the dashboard can reuse DB-native period math instead of duplicating it in TypeScript.
- **Plan limits live in PRD only:** `src/components/landing/Plans.astro` hardcodes marketing copy; no shared constants module.
- **F-03 follow-ups open:** `context/changes/supabase-oauth-auth/follow-ups/review-fixes.md` — F1/F2 deferred "before S-01".

### Key Discoveries

- `handle_new_user` trigger creates `profiles` + `user_settings` on signup but **no** `usage_periods` row until first increment — dashboard must treat missing row as 0 used (`supabase/migrations/20260528194500_create_core_tables.sql:129-152`).
- Rolling period convention (UTC): `period_start` inclusive, `period_end` exclusive; anchor = `profiles.created_at` (`supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql:9-31`).
- `usage_periods` grants: `authenticated` has SELECT only; writes via RPC (`20260530120000_usage_rpcs_and_rls_hardening.sql:186-187`).
- Blog CTAs already target `/app` (`src/components/blog/BlogPostLayout.astro`) — dashboard is the first real signed-in destination.

## Desired End State

After this plan is complete:

1. Signed-in user landing on `/app` sees a minimal **app shell** (logo, identity, sign-out) and a **usage dashboard** with:
   - Current plan tier (FREE or PRO)
   - Remaining practice-set generations and Check calls for the current usage period
   - Localized reset datetime (with brief note that the billing period is UTC-anchored)
   - When FREE limits are exhausted: upgrade prompt linking to `/#plans`
2. Server-side reads use the user JWT via `createSupabaseServerClient` — no service role, no client-side Supabase for quota data.
3. F-03 security gaps F1 and F2 are fixed.
4. `npm run build` and `npm run astro -- check` pass.

### Verification commands

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0
- Manual: sign in on Preview; confirm dashboard values; confirm `/%2f%2fevil.com` `next` param does not redirect off-site after OAuth

## What We're NOT Doing

- JD paste or AI generation UI (S-02)
- Calling `increment_generation_usage()` / `increment_check_usage()` (S-02/S-04)
- Stripe checkout or webhooks (S-05)
- Theme toggle or persistence UI (S-06)
- New write-side usage RPCs beyond the read helper added in S-01
- React islands or shadcn components
- Blocking `plan_tier` self-updates at DB level (deferred to S-05 billing)
- PRO daily-cap enforcement or display (FR-020) — period totals + fair-use helper text only
- Automated test runner (not in repo)

## Implementation Approach

- Add `src/lib/plan/` module: shared limits + `getUsageSummary(supabase, userId)` server helper backed by a dedicated read RPC.
- Keep reads in Astro frontmatter on `app/index.astro` (SSR, RLS-enforced).
- Introduce `AppLayout.astro` + `UsageDashboard.astro` (or equivalent) for signed-in chrome and quota cards.
- Harden auth redirect validator and middleware before shipping real dashboard content.
- Reuse existing Tailwind tokens (`var(--text)`, `var(--surface)`, card radii from `login.astro` / blog CTAs).

## Critical Implementation Details

**The database owns rolling-period math.** S-01 should not duplicate `p_anchor + n * interval '1 month'` in TypeScript. Add a small authenticated read RPC that resolves the current period inside Postgres using the same logic as `current_usage_period_bounds()` and returns the active row (or zero counts when no row exists yet). This keeps month-end anchors and timestamptz equality in one place.

**PRO display (read-only):** Show tier badge and period counters against PRO limits (500 Checks; generations shown as used/limit with hard cap 300 and helper text that fair-use soft threshold is 100/month with daily cap above that — enforcement is S-05). No daily-cap counter in S-01.

## Phase 1: Plan limits and usage read layer

### Overview

Shared plan constants, a read RPC, and a server helper that returns everything the dashboard needs.

### Changes Required:

#### 1. Plan tier limits

**File**: `src/lib/plan/limits.ts` (new)

**Intent**: Single source of truth for FREE/PRO allowances referenced by dashboard (and later S-02/S-05).

**Contract**:

- Export `PlanTier` type: `'FREE' | 'PRO'`.
- Export per-tier limits aligned with PRD:
  - FREE: `generationLimit: 1`, `checkLimit: 1`
  - PRO: `generationHardCap: 300`, `generationSoftThreshold: 100`, `checkLimit: 500`
- Export `getPlanLimits(tier: PlanTier)` returning the display limits for that tier.

#### 2. Current usage read RPC

**File**: `supabase/migrations/<timestamp>_current_usage_read_rpc.sql` (new)

**Intent**: Expose current plan/usage state to authenticated users with the same DB-native period math already used by increment RPCs.

**Contract**:

- Add `public.get_current_usage_summary()` returning one row with at least: `plan_tier`, `period_start`, `period_end`, `generation_count`, `check_count`.
- Resolve `auth.uid()`, read `profiles.created_at`, derive current window using DB logic, and left-join / coalesce `usage_periods` so users with no row still get zero counts.
- Grant execute to `authenticated`; no service-role-only dependency.

#### 3. Usage summary reader

**File**: `src/lib/plan/get-usage-summary.ts` (new)

**Intent**: One call from `app/index.astro` to load dashboard data with typed success/error result.

**Contract**:

- Export `UsageSummary` type: `planTier`, `generationUsed`, `generationLimit`, `generationRemaining`, `checkUsed`, `checkLimit`, `checkRemaining`, `periodStart`, `periodEnd`, `isAtGenerationLimit`, `isAtCheckLimit`, optional `proFairUseNote` string for PRO tier.
- Export `getUsageSummary(supabase, userId): Promise<{ ok: true; data: UsageSummary } | { ok: false; error: 'profile_missing' | 'query_failed' }>`.
- Steps: call `get_current_usage_summary()` via Supabase RPC; apply limits via `getPlanLimits`; map DB fields into dashboard-friendly shape.

#### 4. Barrel export (optional)

**File**: `src/lib/plan/index.ts` (new)

**Intent**: Clean imports from pages.

**Contract**: Re-export public types and `getUsageSummary`.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- Import `getUsageSummary` in a temporary script or Preview `/app` smoke — FREE user with no `usage_periods` row shows 0 used, full remaining
- Read RPC returns the same period/count values as a direct SQL spot-check for one known test user

**Implementation Note**: Pause for human confirmation after manual spot-check before Phase 2.

---

## Phase 2: Auth hardening (F1 + F2)

### Overview

Close deferred F-03 security gaps before `/app` carries quota data.

### Changes Required:

#### 1. Encoded-slash redirect hardening (F1)

**File**: `src/lib/server/auth-redirect.ts`

**Intent**: Reject open-redirect bypass via `%2f` encoding in `next` paths.

**Contract**:

- In `safeAuthRedirectPath`, after trim, reject paths containing `%` (case-insensitive), `\`, or ASCII control characters.
- Existing rules remain: must start with `/`, reject `//` and `://`.
- Paths like `/%2f%2fevil.com` return `DEFAULT_AUTH_REDIRECT` (`/app`).

#### 2. Middleware fail-closed on `/app/*` (F2)

**File**: `src/middleware.ts`

**Intent**: Any `getUser()` failure on protected routes redirects to login instead of rendering with `user = null`.

**Contract**:

- In the `catch` block: if `pathname.startsWith('/app')`, redirect to `/login?error=session` (merge auth response headers).
- Keep existing `MissingEnvError` → `?error=configuration` behavior.
- `/login` and `/api/auth` paths may still fail-open or use narrower handling — only `/app/*` must fail-closed.

#### 3. Login error copy for session failures

**File**: `src/pages/login.astro`

**Intent**: User-facing message when redirected with `?error=session`.

**Contract**:

- Add `session` key to `errorMessages`: e.g. "Your session could not be verified. Please sign in again."

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- OAuth flow with valid `next=/app` still lands on dashboard after sign-in
- `next=/%2f%2fexample.com` (or similar) does not redirect off-site after callback
- Simulated `getUser()` failure on `/app` (e.g. invalid Supabase URL locally) redirects to `/login?error=session`

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: App shell and dashboard UI

### Overview

Replace the stub with app chrome and usage cards wired to `getUsageSummary`.

### Changes Required:

#### 1. App layout shell

**File**: `src/components/app/AppLayout.astro` (new)

**Intent**: Minimal signed-in chrome distinct from marketing Header/Footer.

**Contract**:

- Props: `title`, `userEmail` (or display string), optional `children` via slot.
- Top bar: PrepAhead logo link to `/`, user identity text, sign-out form POST to `/api/auth/sign-out`.
- Wraps content in `Layout.astro` with appropriate `title` / `description`.
- Uses existing CSS variables and rounded card patterns from `login.astro`.

#### 2. Usage dashboard component

**File**: `src/components/app/UsageDashboard.astro` (new)

**Intent**: Present plan and quota data; handle at-limit upgrade CTA.

**Contract**:

- Props: `summary: UsageSummary` (success path) or `error: true` (degraded path).
- **Success:** Plan tier badge; two metric cards (generations remaining, Checks remaining) showing `remaining / limit` or used+remaining; reset line using `Intl.DateTimeFormat` with visitor locale for `periodEnd`.
- Short helper: "Usage period resets on … (rolling monthly cycle, UTC anchor)."
- When `isAtGenerationLimit` or `isAtCheckLimit` on FREE: alert/banner with link to `/#plans` ("Upgrade to PRO").
- **PRO tier:** Show PRO limits; optional `proFairUseNote` about soft threshold / daily cap (informational only).
- **Error path:** Banner "Could not load usage — try refreshing" without fake numbers; sign-out still available via layout.

#### 3. Wire `/app` page

**File**: `src/pages/app/index.astro`

**Intent**: Replace stub with live dashboard.

**Contract**:

- Keep `export const prerender = false`.
- Read `Astro.locals.user` — middleware guarantees presence; still guard for null → redirect `/login`.
- `createSupabaseServerClient(Astro.request, Astro.cookies)` → `getUsageSummary(supabase, user.id)`.
- Render `AppLayout` wrapping `UsageDashboard`.
- Remove placeholder "arrives in S-01" copy.
- Page title/description updated for dashboard context.

#### 4. Align landing plan copy (optional touch)

**File**: `src/components/landing/Plans.astro`

**Intent**: Ensure marketing numbers match `src/lib/plan/limits.ts` (import constants or add comment referencing shared module). Minimal change — only if drift is found.

**Contract**: FREE "1 generation / 1 Check" and PRO "500 Check" strings stay consistent with limits module.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- Signed-in FREE user sees plan FREE, 1 remaining generation and 1 remaining Check (if unused)
- User whose `generation_count` was updated directly in Supabase for the current period sees reduced remaining
- At-limit FREE user sees upgrade link to `/#plans` on landing
- Dashboard renders on mobile without horizontal scroll
- Signed-out user hitting `/app` still redirects to `/login`

**Implementation Note**: Pause for human confirmation before closing change.

---

## Phase 4: Verification and change hygiene

### Overview

End-to-end smoke and update change metadata.

### Changes Required:

#### 1. Verification log

**File**: `context/changes/sign-in-and-usage-dashboard/verification.md` (new)

**Intent**: Track automated and Preview smoke results (mirror S-08 pattern).

**Contract**:

- Checklist: build, astro check, signed-in dashboard, at-limit CTA, two-account UI isolation check, F1 redirect test.

#### 2. Change status

**File**: `context/changes/sign-in-and-usage-dashboard/change.md`

**Intent**: Mark ready for implementation.

**Contract**: `status: planned` until `/10x-implement` completes; `updated` reflects plan write date.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- Preview deployment: complete sign-in → dashboard flow
- Two test Google accounts: account B never sees account A plan/usage in the UI after separate sign-in sessions
- Blog CTA from `/blog/*` → `/app` shows dashboard (or login → dashboard)

---

## Testing Strategy

### Unit Tests:

- Not in repo scope for MVP. Read-RPC parity and `safeAuthRedirectPath` cases are validated via manual spot-check and build-time TypeScript.

### Integration Tests:

- Manual Preview smoke only (see Phase 4).

### Manual Testing Steps:

1. Sign in as new FREE user → dashboard shows 1/1 remaining, reset date in future.
2. Update `generation_count` for the test user's current `usage_periods` row in Supabase directly → dashboard reflects 0 remaining generations.
3. At 0 generations → upgrade banner with `/#plans` link works from `/app`.
4. Set `plan_tier = 'PRO'` in SQL for test user → dashboard shows PRO limits (500 Checks, generation cap messaging).
5. Sign in as account A and account B in separate browser sessions/windows → each sees only its own plan/usage state in the UI.
6. Break Supabase URL temporarily → `/app` shows error banner, not fake quotas; or redirects to login with `session` if auth breaks (F2).
7. Attempt `login?next=/%2f%2fevil.com` → post-auth stays on-site.

## Performance Considerations

- Single page load with one authenticated read RPC — negligible for MVP scale.
- No client hydration required; SSR-only dashboard.

## Migration Notes

- One Supabase migration adds the authenticated read RPC for current usage.
- Existing users without `usage_periods` rows display correctly (0 used).

## References

- Roadmap S-01: `context/foundation/roadmap.md`
- PRD FR-012, US-02: `context/foundation/prd.md`
- F-02 schema plan: `context/changes/supabase-data-schema/plan.md`
- F-03 auth plan + follow-ups: `context/changes/supabase-oauth-auth/plan.md`, `follow-ups/review-fixes.md`
- Current stub: `src/pages/app/index.astro`
- Period SQL: `supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql:16-31`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Plan limits and usage read layer

#### Automated

- [x] 1.1 `npm run build` — exit 0
- [x] 1.2 `npm run astro -- check` — exit 0

#### Manual

- [x] 1.3 FREE user with no `usage_periods` row shows 0 used, full remaining
- [x] 1.4 Read RPC matches direct SQL spot-check for one test user

### Phase 2: Auth hardening (F1 + F2)

#### Automated

- [ ] 2.1 `npm run build` — exit 0
- [ ] 2.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 2.3 Valid OAuth `next=/app` still works
- [ ] 2.4 Encoded-slash `next` cannot redirect off-site
- [ ] 2.5 `/app` redirects to `/login?error=session` on auth verification failure

### Phase 3: App shell and dashboard UI

#### Automated

- [ ] 3.1 `npm run build` — exit 0
- [ ] 3.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 3.3 Signed-in FREE user sees correct plan and remaining counts
- [ ] 3.4 At-limit FREE user sees upgrade link to `/#plans`
- [ ] 3.5 Mobile layout readable
- [ ] 3.6 Unsigned `/app` still redirects to `/login`

### Phase 4: Verification and change hygiene

#### Automated

- [ ] 4.1 `npm run build` — exit 0
- [ ] 4.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 4.3 Preview sign-in → dashboard smoke
- [ ] 4.4 RLS two-account isolation check
- [ ] 4.5 Blog CTA → `/app` dashboard path
