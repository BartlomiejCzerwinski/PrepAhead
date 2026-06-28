---
date: 2026-06-28T09:10:00+02:00
researcher: Cursor agent (Claude Opus 4.8)
git_commit: 52d1c46fbcb38e521a220aa97a0b50dd7e410a0a
branch: main
repository: PrepAhead
topic: "Phase 1 test rollout — Vitest bootstrap + critical gating coverage (Risk #1 plan/usage, Risk #2 authorization/IDOR)"
tags: [research, codebase, testing, vitest, plan-usage, gating, authorization, idor, rls, supabase]
status: complete
last_updated: 2026-06-28
last_updated_by: Cursor agent (Claude Opus 4.8)
---

# Research: Phase 1 test rollout — runner bootstrap + critical gating coverage

**Date**: 2026-06-28T09:10:00+02:00
**Researcher**: Cursor agent (Claude Opus 4.8)
**Git Commit**: 52d1c46fbcb38e521a220aa97a0b50dd7e410a0a
**Branch**: main
**Repository**: PrepAhead

## Research Question

Ground Phase 1 of `context/foundation/test-plan.md` ("Test runner + critical gating coverage") before planning. Phase 1 bootstraps the Vitest runner and covers:

- **Risk #1** — plan/usage gate bypass or miscount. Prove that at the FREE limit a generation/Check is blocked with `remaining = 0`; that usage increments only on success (never on failure, never double); and that PRO hard-stops at 300 / daily-caps at 10 above the soft limit.
- **Risk #2** — authorization / IDOR on practice-set `[id]` endpoints. Prove a request for another user's set is denied (404/403) and never serves or mutates their JD/CV/answers.

Per test-plan §1 principle #3, research is ground truth for *where* failures live (the risk map only cites evidence). What follows reflects the live codebase, with prior changes as supplementary history.

## Summary

The codebase is in good shape for two of the three Phase-1 goals, with one important deviation from the PRD that the plan must confront:

1. **Risk #2 (IDOR) is robustly defended today.** Every `[id]` endpoint and SSR page applies a *double* guard: an explicit code-level `.eq('user_id', user.id)` filter **and** a user-scoped anon-key Supabase client with RLS active (`user_id = auth.uid()` on every table). **No service-role client is instantiated anywhere**, so there is no RLS-bypass surface. Tests here are confirmation + regression locks, not bug-hunts — but the test plan explicitly demands them (challenge "logged-in == authorized").

2. **Risk #1 (gating) is asymmetric.** Generation is well-protected (atomic, idempotent, capped inside `finalize_generation_job`). Check is loose by design (pre-flight gate + non-atomic increment, no DB ceiling, accepted under-count-on-failure edge case). Tests must encode this asymmetry, not assume parity.

3. **The PRD's PRO fair-use tier is NOT implemented.** The soft threshold (100) is a dead type literal; the daily cap (10/day UTC) exists only as display text. Grep finds zero day-bucketing logic in DB or app. **The test-plan intent "PRO hard-stops at 300 / daily-caps at 10" cannot be asserted as-is** — only the hard cap (300 PRO / 1 FREE) is enforceable. The plan must decide: test only what exists (hard cap), or treat the missing daily cap as a finding to defer (it was explicitly deferred to S-05 in `supabase-data-schema`).

4. **Runner bootstrap is a clean slate.** No test deps, config, or path aliases exist. The `getViteConfig()`/Vitest-4 caveat is *live* (Astro 6.3.7 → Vite 7.3.3) but trivially avoidable: `getViteConfig` is imported nowhere, so use plain `defineConfig` from `vitest/config` and pin `vitest@^4.1`.

## Detailed Findings

### Area 1 — Risk #1: plan/usage gate evaluation & metering

**The gate.** `getUsageSummary()` is the single decision-maker (`src/lib/plan/get-usage-summary.ts:31`). It calls the Postgres read RPC `get_current_usage_summary` and derives `remaining` clamped to `>= 0`, returning exactly 0 at the limit, plus `isAtGenerationLimit` / `isAtCheckLimit`:

- `src/lib/plan/get-usage-summary.ts:64-80` — `Math.max(0, limit - used)` → `remaining === 0` flags.
- Limits come from `getPlanLimits()` (`src/lib/plan/limits.ts:18`). The gate uses the **hard cap** for generation (300 PRO / 1 FREE) — `get-usage-summary.ts:60-62`.

**Block points (consumers):**
- Generation: `src/pages/api/practice-sets/generate.ts:117` → 403 `generation_limit_reached` at `:129`.
- Check: `src/pages/api/practice-sets/[id]/check.ts:220` → 403 `check_limit_reached` at `:232`.
- Read-only display: `src/pages/app/generate.astro:22`, `src/pages/app/index.astro:19`, `src/pages/app/sets/[id]/open-ended.astro:103`.

**Generation increment — on SUCCESS, atomic, idempotent (robust).** The standalone `increment_generation_usage()` RPC exists but is **dead code** (`supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql:46`); the production path inlines the increment into `finalize_generation_job`, called only after the AI generation succeeds:

- `src/pages/api/practice-sets/generate-worker.ts:216` calls `finalize_generation_job`.
- `supabase/migrations/20260607120000_enforce_generation_cap_on_finalize.sql:104-126` — single-transaction persist + upsert increment + atomic cap check (`where up.generation_count < v_generation_limit`).
- Idempotency: guarded by `usage_incremented_at is null` (`:81`), set in-transaction (`:135`); job row locked `for update` (`:45`). Re-finalize cannot re-charge.
- Failure path: `mark_generation_job_failed` (`generate-worker.ts:194`) does **not** increment → no charge on failure.

**Check increment — on SUCCESS after persist, NON-atomic (loose, by design).** Order in `check.ts`: gate (`:232`) → AI call (`:248`) → persist feedback (`:342`) → increment (`:363`):

- `src/pages/api/practice-sets/[id]/check.ts:361-369` — `increment_check_usage()` only after persist; code comment explicitly accepts under-count if the RPC fails.
- `increment_check_usage()` is a plain atomic `+1` upsert with **no cap re-check** (`20260530120000_...sql:118`).
- TOCTOU window: gate (read) and meter (write) are not one transaction; concurrent distinct-question Checks can each pass the gate and exceed the limit. Same-question double-charge is blocked by `already_checked` guards (`check.ts:209` pre-call, `:310` post-call re-read).

**Period boundary — rolling monthly, UTC, anchored at signup.**
- `supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql:16-32` — `current_usage_period_bounds()`, `anchor + n * interval '1 month'`, `period_start` inclusive / `period_end` exclusive.
- Anchor = `profiles.created_at`. No reset job — period derived per call; a new `usage_periods` row is lazily upserted.
- Missing `usage_periods` row coalesces to 0 used (`handle_new_user` creates `profiles` + `user_settings` but no usage row until first increment).

**PRO daily cap (10) + soft threshold (100) — NOT IMPLEMENTED.**
- `generationSoftThreshold: 100` is a type literal only (`src/lib/plan/limits.ts:12,23`), read nowhere.
- "max 10 per calendar day (UTC)" is display text only (`get-usage-summary.ts:28-29`, `PRO_FAIR_USE_NOTE`).
- Grep of `supabase/` for `daily` / `date_trunc` / `current_date` / `interval '1 day'` → zero matches. No per-day counter, no soft throttle.

**Data model.**
- `public.usage_periods(user_id, period_start, period_end, generation_count, check_count, updated_at)`, PK `(user_id, period_start)` — `supabase/migrations/20260528194500_create_core_tables.sql:78-95`.
- `public.profiles.plan_tier` (`'FREE'|'PRO'`, default `'FREE'`) — `20260528194500_...sql:13`.
- `public.generation_jobs` with `idempotency_key`, `status`, `usage_incremented_at` — `20260606153000_generation_jobs.sql:1`.

### Area 2 — Risk #2: practice-set `[id]` authorization / IDOR

**Every `[id]` path enforces ownership in code AND via RLS.** Pattern: `getUser()` → 401 if absent → query filtered by `id` + `user_id = user.id` + `deleted_at is null` → 404 on miss; mutations re-filtered and verified by `.select('id')` row count.

| Endpoint / page | Effect | Code ownership check | RLS table |
|---|---|---|---|
| `src/pages/api/practice-sets/[id]/answer.ts` | mutate ABCD answer | read `:115-128`, write `:235-244` | `practice_sets` |
| `src/pages/api/practice-sets/[id]/save-answer.ts` | save open-ended draft | read `:114-127`, write `:213-219` | `practice_sets` |
| `src/pages/api/practice-sets/[id]/check.ts` | read JD/CV + AI Check, mutate, consume usage | read incl. JD/CV `:139-152`, re-read `:272-278`, write `:342-348` | `practice_sets` + usage RPC |
| `src/pages/api/practice-sets/[id]/status.ts` | generation status | `generation_jobs` `:46-58`, `practice_sets` `:78-84` | both |
| `src/pages/app/sets/[id].astro` | render set incl. `cv_text` | `:37-47`, `:49-54` (redirect `/app`) | both |
| `src/pages/app/sets/[id]/practice.astro` | render | `:38-41`, `:50-53` | both |
| `src/pages/app/sets/[id]/open-ended.astro` | render | `:40-43`, `:52-55` | both |

**Note:** `status.ts` keys on `practice_set_id` in the URL (not the job id) — still owner-scoped via `.eq('user_id', user.id)`.

**RLS policies — `user_id = auth.uid()` on every table.**
- `practice_sets`: SELECT/INSERT/UPDATE own; **no DELETE** (soft-delete only) — `supabase/migrations/20260530110000_create_practice_sets.sql:29-55`. All practice-set data (questions/answers/JD/CV/Check results) lives in this one row (`content` jsonb + `job_description_text`/`cv_text`).
- `generation_jobs`: SELECT/INSERT/UPDATE own, no DELETE — `20260606153000_generation_jobs.sql:37-63`.
- `profiles` (`id = auth.uid()`), `user_settings`, `usage_periods` (SELECT-only for users; writes via RPC) — `20260528194500_create_core_tables.sql:25-104`.

**Client = anon key + user JWT, RLS active. No service-role client anywhere.**
- `src/lib/supabase/server.ts:10-41` — `createServerClient` with anon key + request cookies.
- `SUPABASE_SERVICE_ROLE_KEY` is declared (`src/lib/server/env.ts:6,26-27`, `.env.example:26`) but never used to construct a client. In SQL, `service_role` appears only in `revoke ... from service_role`.
- The one `security definer set row_security = off` function (`finalize_generation_job`, `20260607120000_...sql`) is internally bound to `auth.uid()`, takes only `p_job_id`, and has `service_role` execute revoked (`:156-159`) → not an IDOR surface.

**Middleware caveat (not a gap):** `src/middleware.ts:9-15` `needsSessionRefresh()` does NOT cover `/api/practice-sets/*`, but every endpoint independently re-derives the user via `getUser()` and 401s — the canonical "do not trust middleware for `/api/practice-sets/*`" pattern established in `jd-gated-generation`.

**Most sensitive single point:** `POST /api/practice-sets/[id]/check` — the only endpoint that reads `job_description_text` + `cv_text` and forwards them to the LLM *and* consumes paid usage. Top IDOR-test priority: a non-owner must get 404 with no JD/CV in the body and no usage consumed.

### Area 3 — Vitest bootstrap & testability

**Clean slate.** `package.json` has no vitest/vite-test/jsdom/MSW deps; no `vitest.config.*` / `*.test.*` / `__tests__/` exist; `tsconfig.json` has no path aliases (relative imports throughout → no alias resolution needed in test config).

**Stack / caveat.** Node ≥22.12; Astro 6.3.7 → Vite 7.3.3 (the `getViteConfig()`+Vitest-4 crash range applies). `getViteConfig` is imported nowhere → use plain `defineConfig` from `vitest/config` and pin `vitest@^4.1`. The repo's existing local gate is `npm run astro -- check` + `npm run build` (no test runner) — exactly the gap this phase fills.

**Unit-testable as-is (pure / DI'd):**
- `src/lib/plan/limits.ts` — pure limit values (assert against PRD, never echo them).
- `src/lib/plan/get-usage-summary.ts` — takes the Supabase client as a parameter (the gate math is unit-testable with a stub client). Note: its `userId` param is unused — identity comes from JWT `auth.uid()` in the RPC.
- `src/lib/practice/contracts.ts` — contract parsing (more relevant to Phase 2).

**Integration-only (logic inlined in `POST` handlers):** the actual gate + increment + ownership logic lives inside the route handlers of `generate.ts`, `generate-worker.ts`, `[id]/answer.ts`, `[id]/save-answer.ts`, `[id]/check.ts`, `[id]/status.ts`. These need handler invocation with a fake `APIContext` (request, cookies, `locals`), not pure unit calls.

**Mock strategy: at the client boundary.** Supabase is a per-request factory (`createSupabaseServerClient`), not a module singleton — stub the factory / the returned client (MSW unnecessary). Env is read lazily inside functions (not at module top level via static `import.meta.env.<KEY>`), so imports won't crash on missing env vars. `requireEnv` must use static key access (Vercel returns `undefined` for dynamic `import.meta.env[name]`).

## Code References

- `src/lib/plan/get-usage-summary.ts:31,60-80` — gate function, remaining/flags derivation.
- `src/lib/plan/limits.ts:12,18,23` — plan limits; dead `generationSoftThreshold`.
- `src/pages/api/practice-sets/generate.ts:117-142,144-160,164-199` — generation gate + idempotency + draft/job creation (no increment here).
- `src/pages/api/practice-sets/generate-worker.ts:129-142,187-224` — claim job, run AI, fail (no charge) vs finalize (meter).
- `src/pages/api/practice-sets/[id]/check.ts:139-152,220-246,342-369` — owner read incl. JD/CV, gate, persist, non-atomic increment.
- `src/pages/api/practice-sets/[id]/answer.ts:62-79,115-128,235-244` — auth, owner read, owner write + row-count verify.
- `src/pages/api/practice-sets/[id]/save-answer.ts:48-68,114-127,213-219` — same pattern, open-ended draft.
- `src/pages/api/practice-sets/[id]/status.ts:30-58,78-84` — owner-scoped job + content read.
- `src/pages/app/sets/[id].astro:37-54` (+ `practice.astro`, `open-ended.astro`) — owner-scoped SSR with `/app` redirect.
- `src/lib/supabase/server.ts:10-41` — anon-key + user-JWT client (RLS active).
- `src/middleware.ts:9-15,34-54` — session refresh scope + `/app/*` fail-closed redirect.
- `supabase/migrations/20260528194500_create_core_tables.sql:13,78-104` — profiles/plan_tier, usage_periods, RLS.
- `supabase/migrations/20260530110000_create_practice_sets.sql:29-55` — practice_sets RLS (no DELETE).
- `supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql:16-32,46,118,183-187` — period bounds, increment RPCs, service_role revokes.
- `supabase/migrations/20260606153000_generation_jobs.sql:1,37-63` — job ledger + RLS.
- `supabase/migrations/20260607120000_enforce_generation_cap_on_finalize.sql:40-73,81-135,156-159` — atomic finalize: cap, idempotency, auth.uid() binding, service_role revoke.

## Architecture Insights

- **Defense-in-depth for ownership:** code filter (`user_id = user.id`) + RLS (`user_id = auth.uid()`) + `.select('id')` row-count verification on mutations + inline `getUser()` (never trust middleware for `/api/practice-sets/*`). A good Risk #2 suite tests at *two* layers so a future regression localizes to app filter vs RLS.
- **Generation vs Check asymmetry is intentional:** generation has a DB-side atomic cap + idempotency; Check has app-side pre-flight only with an accepted concurrent-over-limit and under-count edge case. Tests must assert each path's real contract, not a symmetric ideal.
- **DB owns the metering math** via `auth.uid()`-bound `SECURITY DEFINER` RPCs; `service_role` is deliberately revoked from them. Usage cannot be incremented for another user via PostgREST.
- **Oracle discipline (test-plan §2):** assert FREE 1/5 and PRO 300/500 against the PRD, not against numbers read from the increment code or `limits.ts`.

## Historical Context (from prior changes)

- `context/changes/supabase-data-schema/plan.md:77,281-292` — rolling-period UTC convention; increment RPCs keyed by `auth.uid()`, **not granted to service role**; FR-020 daily cap explicitly OUT (deferred to S-05).
- `context/changes/sign-in-and-usage-dashboard/plan.md:86-90,100-113` — limits module + `get_current_usage_summary` read RPC; `reviews/impl-review.md:34-52` — non-PRO silently treated as FREE; `userId` param unused.
- `context/changes/jd-gated-generation/reviews/impl-review.md:52-60` — F3 added the **atomic generation cap inside `finalize_generation_job`** (the racy pre-flight-only check was the original bug). `verification.md:27-29` — malformed-output no-charge, FREE-limit-block, idempotency were **left unverified** (exactly this phase's targets). F7 — `status.ts` keyed by `practice_set_id`.
- `context/changes/abcd-practice-and-summary/reviews/impl-review.md:34-41` — F2 introduced the `.select('id')` row-count ownership-verify pattern; F3/F4 — JSONB last-write-wins accepted v1.
- `context/changes/open-ended-check-flow/plan.md:38-40,70` — **no SQL cap on Check** (accepted concurrent over-limit); persist-then-increment ordering + accepted under-count; **FREE `checkLimit` bumped 1 → 5** (stale "1 Check" references). `reviews/impl-review.md:23-32` — stale-content clobber window fixed by post-AI re-fetch + 409.
- `context/changes/server-api-foundation/plan.md:58,113-117` — every `api/*.ts` needs `prerender = false`; shared `jsonResponse()`; no body logging; static `import.meta.env.<KEY>` only.
- `context/changes/supabase-oauth-auth/plan.md:60,107,397-403` — per-request server-client factory, no service-role for user reads/writes; the two-account RLS cross-user denial proof method to replicate in tests.

## Open Questions

1. **Daily cap / soft threshold (test-plan intent vs reality).** The intent says "PRO daily-caps at 10" and "soft limit," but neither is implemented (deferred to S-05). Does Phase 1 (a) test only the enforced hard cap (300 PRO / 1 FREE) and record the daily-cap as a known gap, or (b) widen scope to *also* assert the absence is intentional? Recommendation: (a) — test what exists; log the missing daily cap as a deferred finding referencing `supabase-data-schema` S-05. (Decision for `/10x-plan`.)
2. **Integration harness shape.** Direct handler invocation with a hand-built `APIContext` + stubbed Supabase factory, vs spinning a real local Supabase (Docker) for true RLS assertions. The two-layer ownership model argues for at least one path that exercises real RLS, but prior changes note local Docker was often skipped (validation via prod). Plan must pick: stubbed-client integration only, or stubbed + an optional RLS-level check.
3. **Check TOCTOU / over-limit concurrency.** Is the accepted concurrent-Check over-limit behavior in-scope to *assert* (document the limit-is-soft contract) or out-of-scope (it's a known accepted v1 risk)? Likely document-only.
4. **Mock fidelity for the gate.** `getUsageSummary` is unit-testable with a stub client, but the production gate value depends on the `get_current_usage_summary` RPC's period math. Decide how much of that math the unit layer mocks vs defers to an integration test against real SQL.
