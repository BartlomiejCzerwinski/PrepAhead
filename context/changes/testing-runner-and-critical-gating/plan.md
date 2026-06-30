# Test Runner + Critical Gating Coverage Implementation Plan

## Overview

Bootstrap the Vitest test runner (the project's first) and add unit + integration coverage for the two highest-priority risks in `context/foundation/test-plan.md`: **Risk #1** (plan/usage gate bypass or miscount) and **Risk #2** (authorization / IDOR on practice-set `[id]` endpoints). Tests run fully in-process — the Supabase client factory is mocked at its boundary, no Docker/DB required. We assert only behavior that is actually enforced in code and record the unimplemented PRO daily-cap/soft-threshold as a deferred gap.

## Current State Analysis

The repo has **zero test tooling**: no `vitest`/`vite`-test deps, no `vitest.config.*`, no `*.test.*`, no `__tests__/`, and no path aliases in `tsconfig.json` (relative imports throughout). The only local gate today is `npm run astro -- check` + `npm run build` (`package.json:8-14`).

Risk-relevant code, from `research.md`:

- **Gate**: `getUsageSummary(supabase, _userId)` (`src/lib/plan/get-usage-summary.ts:31`) calls RPC `get_current_usage_summary`, derives `remaining = Math.max(0, limit - used)` and `isAtGenerationLimit`/`isAtCheckLimit = remaining === 0`. For generation it uses the **hard cap** (300 PRO / 1 FREE); Check uses 5 FREE / 500 PRO (`limits.ts:18-33`). The `_userId` param is unused — identity is the JWT `auth.uid()` inside the RPC.
- **Generation metering**: increments on success **inside the DB RPC** `finalize_generation_job` (atomic cap + `usage_incremented_at` idempotency live in SQL). The route `generate.ts` does the pre-flight gate (403 at `:129`) + idempotency short-circuit (`:144-160`); `generate-worker.ts` calls `finalize_generation_job` only after a successful generation (`:216`) and `mark_generation_job_failed` on failure (no charge).
- **Check metering**: `check.ts` gates (`:232`), calls the AI (`:248`), re-reads + persists (`:342`), then calls `increment_check_usage()` **only after** persist (`:363`); on increment-RPC failure the user keeps feedback but is under-counted (accepted v1 edge, `:361-369`). `already_checked` guards at `:209` and `:310` prevent same-question double-charge.
- **IDOR**: every `[id]` route applies `getUser()` 401 + `.eq('user_id', user.id)` + `.is('deleted_at', null)` reads (404 on miss) and `.select('id')` row-count-verified writes. Routes: `check.ts`, `answer.ts`, `save-answer.ts`, `status.ts`. No service-role client exists anywhere.
- **Client construction**: `createSupabaseServerClient(request, cookies, responseHeaders?)` (`src/lib/supabase/server.ts:10`) — a per-request factory reading env lazily via `requireEnv`. Handlers are Astro `APIRoute`s destructuring `{ params, request, cookies }`.

Stack: Astro `^6.3.7` → Vite 7; Node `>=22.12`. The `getViteConfig()`/Vitest-4 crash is **live but avoidable** — `getViteConfig` is imported nowhere, so we use plain `defineConfig` from `vitest/config` and pin `vitest@^4.1`.

## Desired End State

`npm test` runs a green Vitest suite that proves, in-process:

- **Risk #1**: FREE blocks a generation/Check at `remaining = 0`; generation hard-caps at 300 / FREE at 1 and Check at 5/500 (asserted against PRD constants, never echoed from the increment code); generation metering is orchestrated correctly (finalize only on success, `mark_failed` on failure, idempotency short-circuit); Check increments exactly once on success, never on AI/persist failure, never double on `already_checked`, and degrades to under-count (not error) on increment-RPC failure.
- **Risk #2**: for all four `[id]` API routes, a non-owner request returns 404 and neither serves JD/CV/answers nor mutates the row; an unauthenticated request returns 401.

The unit+integration gate is documented as `required` in test-plan §5, cookbook §6.1–6.3 are filled with the actual patterns, and the unimplemented PRO daily-cap/soft-threshold is recorded as a deferred gap (ref S-05). `npm run astro -- check` and `npm run build` still pass.

### Key Discoveries:

- Mock the **factory**, not the network: `createSupabaseServerClient` is per-request (`src/lib/supabase/server.ts:10`) → `vi.mock` it to return a fake chainable client (MSW unnecessary). Research "Architecture Insights".
- Oracle discipline (test-plan §2): assert FREE 1/5 and PRO 300/500 against the PRD, not against `limits.ts`/increment values read back.
- The generation increment + atomic cap live in **SQL** (`finalize_generation_job`); the in-process layer can only assert the handler's call orchestration — the SQL cap/idempotency stay out-of-scope for this phase (documented).
- Check's under-count-on-increment-failure is **intended** behavior (`check.ts:361-369`) — assert it as contract, not a bug.
- `getUsageSummary`'s `_userId` arg is unused — tests must not assume it scopes the read (`get-usage-summary.ts:33`).

## What We're NOT Doing

- **Not implementing** the PRO daily-cap (10/day) or soft-threshold (100) — they don't exist in code (deferred to S-05). We record the gap; we do not add product behavior in a test phase.
- **Not running a real Supabase / Docker** and **not asserting RLS at the DB level** — chosen harness is in-process factory-mock. The SQL-internal atomic cap + idempotency in `finalize_generation_job` are therefore out-of-scope this phase.
- **Not refactoring** production handlers/gate into new pure modules to make them testable — we test them as-is via the mock.
- **Not covering** the SSR `/app/sets/[id]*` pages, generation contract correctness (Phase 2 of the test plan), auth-middleware/leakage (Phase 3), or AI-grounding (Phase 4).
- **Not adding** e2e or CI workflow files (test-plan §4/§5: e2e excluded for v1; no `.github/workflows` gate).

## Implementation Approach

Build the harness once (Phase 1) so every later test is short and uniform, then layer Risk #1 (Phase 2) and Risk #2 (Phase 3) on top, then wire the gate + cookbook docs (Phase 4). Integration tests `vi.mock('../../../lib/supabase/server')` (path relative to each test) so the route's `createSupabaseServerClient(...)` returns our seeded fake client; the route is then invoked by importing its `POST`/`GET` and passing a fake `APIContext`. Unit tests import pure modules directly.

## Critical Implementation Details

- **Mock boundary & module specifier.** `vi.mock` matches the *specifier the route imports*, not the test's path. All routes import `createSupabaseServerClient` from a relative `.../lib/supabase/server` path; the factory mock must return our fake client regardless of the `(request, cookies, authHeaders)` args, and the fake `.auth.getUser()` drives the 401-vs-authorized branch. Because routes also merge `authHeaders`, the fake factory must accept (and ignore) the third arg.
- **Chainable fake fidelity.** Supabase query builders are thenable and chain `.from().select().eq().eq().is().maybeSingle()/.single()` and `.update(...).eq(...).is(...).select('id')`, plus `.rpc(name)` (sometimes `.maybeSingle()`-chained, as in `get_current_usage_summary`). The fake must let each test seed: the `getUser` result, per-table row(s) returned by terminal calls, `.rpc` return/throw per RPC name, and capture `.update`/`.insert` payloads + row-count (`select('id')` length) so mutation assertions work. Terminal resolvers return `{ data, error }`.
- **Ordering the Check contract.** `check.ts` calls the gate *after* validating ownership + `already_checked` (`:209`) and *before* the AI call; the under-count edge requires the persist `.update().select('id')` to succeed (non-empty rows) and `increment_check_usage` to return `{ error }` — the response must still be `ok:true` with `checkRemaining` unchanged (`:372-374`). Seed those two terminals independently.
- **No raw user content in assertions/logs.** Per AGENTS.md, IDOR tests assert the *absence* of `job_description_text`/`cv_text` in non-owner responses using fixture markers; do not print real-looking JD/CV in failures.

## Phase 1: Runner Bootstrap + Reusable Harness

### Overview

Install and configure Vitest with a plain `defineConfig`, add scripts, and create the shared test-support module (fake Supabase client + fake `APIContext`) plus one trivial passing test proving the runner works and the build/typecheck still pass.

### Changes Required:

#### 1. Test dependencies

**File**: `package.json`

**Intent**: Add Vitest as the runner pinned to a version past the `getViteConfig`/Vite-7 regression, and add `test` / `test:watch` scripts.

**Contract**: `devDependencies` gains `vitest` at `^4.1` (the version §4 of the test plan requires). Scripts gain `"test": "vitest run"` and `"test:watch": "vitest"`. No `getViteConfig`, no jsdom (server-logic only). Node engine unchanged (`>=22.12`).

#### 2. Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Configure Vitest for a Node/server test environment without touching the Astro Vite pipeline (sidesteps the documented crash).

**Contract**: Plain `defineConfig` from `vitest/config` with `test.environment = 'node'`, `test.include = ['test/**/*.test.ts', 'src/**/*.test.ts']`, `test.globals = false` (import `describe/it/expect/vi` explicitly). No Tailwind/Astro plugins.

#### 3. Fake Supabase client helper

**File**: `test/support/fake-supabase.ts` (new)

**Intent**: A reusable factory returning a chainable fake Supabase client that tests seed with auth user, per-table terminal results, and per-RPC responses, and that records insert/update payloads for side-effect assertions. This is the backbone of every integration test and the cookbook §6.2/§6.3 pattern.

**Contract**: Export `createFakeSupabase(seed)` returning an object shaped like `SupabaseClient` for the surface the routes use: `auth.getUser()` → seeded `{ data: { user }, error }`; `from(table)` → chainable builder where `.select/.eq/.is/.order` return `this` and `.maybeSingle()/.single()` / direct `await` resolve to the seeded `{ data, error }` for that `(table, op)`; `.insert(payload)`/`.update(payload)` capture payload and return a chainable that resolves to seeded result (incl. `.select('id')` row arrays for row-count checks); `.rpc(name)` → seeded per-name `{ data, error }`, chainable `.maybeSingle()`. Also export a `calls` record (e.g. `rpc` names invoked, `update`/`insert` payloads, table+filter args) for assertions. Provide small builders: `freeUserSummaryRow(...)`, `proUserSummaryRow(...)`.

#### 4. Fake APIContext helper

**File**: `test/support/fake-context.ts` (new)

**Intent**: Build the minimal Astro `APIContext` an `APIRoute` handler reads, so tests can invoke `POST`/`GET` directly.

**Contract**: Export `makeApiContext({ params?, body?, cookies?, url? })` returning `{ params, request, cookies }` where `request` is a real `Request` (JSON body + cookie header) and `cookies` is a minimal `AstroCookies`-like stub (`get/set/delete` no-ops sufficient for `createServerClient`’s `setAll`). Typed loosely (`as unknown as APIContext`) to avoid pulling full Astro types.

#### 5. Smoke test

**File**: `test/support/smoke.test.ts` (new)

**Intent**: Prove the runner executes and the helpers import cleanly.

**Contract**: A trivial `expect(true).toBe(true)` plus instantiating `createFakeSupabase({})` and `makeApiContext({})` without throwing.

### Success Criteria:

#### Automated Verification:

- Dependencies install: `npm install`
- Test runner executes green: `npm test`
- Type checking passes: `npm run astro -- check`
- Build still passes: `npm run build`

#### Manual Verification:

- `npm run test:watch` starts and re-runs on file change
- No Astro/Tailwind plugin is loaded by the Vitest config (config review)

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 2.

---

## Phase 2: Risk #1 — Plan/Usage Gating & Metering

### Overview

Unit-test the gate math and limit constants against the PRD, then integration-test the generation and Check routes' gating + metering orchestration, including failure and edge branches.

### Changes Required:

#### 1. Plan limits unit tests

**File**: `src/lib/plan/limits.test.ts` (new)

**Intent**: Lock the PRD plan limits so a silent edit to a limit fails loudly.

**Contract**: Assert `getPlanLimits('FREE')` = `{ tier:'FREE', generationLimit:1, checkLimit:5 }` and `getPlanLimits('PRO')` = `{ tier:'PRO', generationHardCap:300, generationSoftThreshold:100, checkLimit:500 }` using **literal PRD numbers** in the test (oracle discipline — not imported from the module under test).

#### 2. Usage-summary gate unit tests

**File**: `src/lib/plan/get-usage-summary.test.ts` (new)

**Intent**: Prove the gate derives `remaining` and the at-limit flags correctly across FREE/PRO and the boundary, and maps RPC errors.

**Contract**: With a fake client whose `.rpc('get_current_usage_summary').maybeSingle()` returns seeded rows, assert: FREE at `generation_count=1` → `generationRemaining=0`, `isAtGenerationLimit=true`; FREE at `check_count=5` → `isAtCheckLimit=true`; PRO uses hard cap 300 (e.g. `generation_count=300` → at limit; `100` → not at limit, i.e. soft threshold is NOT a block); `remaining` clamps at 0 (never negative) when count > limit; error code `P0002` → `{ ok:false, error:'profile_missing' }`, other error → `query_failed`, null data → `profile_missing`. Treat any non-`'PRO'` tier as FREE.

#### 3. Generation route gating integration test

**File**: `src/pages/api/practice-sets/generate.test.ts` (new)

**Intent**: Prove the pre-flight gate blocks at the generation limit, idempotency short-circuits, and unauthenticated is rejected — without metering happening on the request path.

**Contract**: `vi.mock` the supabase server factory to return a seeded fake. Assert: no user → 401 `unauthorized`; user at generation limit (summary `isAtGenerationLimit=true`) → 403 `generation_limit_reached` with correct FREE/PRO message + `upgradeUrl`, and **no `practice_sets`/`generation_jobs` insert** captured; existing job for the idempotency key → 200 returning the existing `{ jobId, practiceSetId }` with no new insert; happy path (under limit, no existing job) → 202 with a created job and **no usage increment RPC called** on this route.

#### 4. Generation worker orchestration integration test

**File**: `src/pages/api/practice-sets/generate-worker.test.ts` (new)

**Intent**: Prove metering happens only on success and never on failure or twice (orchestration level; SQL cap/idempotency are DB-internal and out of scope).

**Contract**: With the AI generator mocked (`vi.mock` `src/lib/server/practice/generate-practice-set`): on a successful generation the worker calls `finalize_generation_job` (assert via `calls.rpc`) and **not** `mark_generation_job_failed`; on a generation failure it calls `mark_generation_job_failed` and **never** `finalize_generation_job`; a non-claimable/already-finalized job path does not double-call `finalize_generation_job`. Document in a test comment that the atomic cap + `usage_incremented_at` idempotency are enforced inside the SQL RPC and verified only when a real-Supabase layer is added.

#### 5. Check route full-contract integration test

**File**: `src/pages/api/practice-sets/[id]/check.test.ts` (new)

**Intent**: Encode the complete Check gating + metering contract, including the accepted under-count edge.

**Contract**: With the AI checker mocked (`vi.mock` `src/lib/server/practice/run-open-ended-check`), assert, per case: no user → 401; at Check limit → 403 `check_limit_reached` (`checkRemaining:0`) with **no AI call and no `increment_check_usage`**; success → AI called, persist `.update().select('id')` returns a row, `increment_check_usage` called exactly once, response `ok:true` with `checkRemaining` decremented by 1; AI failure → 502/500 with **no persist and no increment**; persist failure (update returns empty rows / error) → 500 with **no increment**; `already_checked` (pre-call `targetQuestion.checkedAt` set, or post-call fresh re-read set) → 409 with **no increment**; increment-RPC failure after successful persist → response still `ok:true`, `checkRemaining` unchanged (under-count edge), and feedback returned.

#### 6. Daily-cap gap record

**File**: `context/changes/testing-runner-and-critical-gating/research.md` (append a short "Deferred" note) and a test comment in `get-usage-summary.test.ts`.

**Intent**: Make the unimplemented PRO daily-cap/soft-threshold explicit so it isn't mistaken for tested behavior.

**Contract**: One-paragraph note: PRO soft-threshold (100) and daily-cap (10/day UTC) are not enforced in code (deferred to S-05); Phase-1 tests assert only the hard cap (300) and FREE cap (1). No assertion is written against the non-existent daily logic.

### Success Criteria:

#### Automated Verification:

- All Risk #1 tests pass: `npm test`
- Type checking passes: `npm run astro -- check`
- Build still passes: `npm run build`

#### Manual Verification:

- Limit literals in tests match `context/foundation/prd.md` FR-014..021 (FREE 1/5, PRO 100/10/300, 500)
- No test asserts a limit value by importing it from `limits.ts` (oracle review)
- The under-count edge case reads as intended behavior, not a failing assertion

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 3.

---

## Phase 3: Risk #2 — IDOR Across the Four `[id]` Routes

### Overview

Prove every practice-set `[id]` API route denies a non-owner (404) without serving or mutating their data, and rejects the unauthenticated caller (401), using a shared table-driven test.

### Changes Required:

#### 1. Shared IDOR test for read/serve denial

**File**: `src/pages/api/practice-sets/[id]/idor.test.ts` (new)

**Intent**: Table-drive the non-owner and unauthenticated cases across `check.ts`, `answer.ts`, `save-answer.ts`, `status.ts` so the whole ownership surface is locked in one place.

**Contract**: For each route, seed the fake client so the owner-scoped read (`.eq('user_id', user.id)...maybeSingle()`) returns `{ data: null }` (simulating "row exists but not owned by caller") and assert the handler returns **404** (`practice_set_not_found` for check/answer/save-answer; `job_not_found` for status) and that the response body contains **none** of the fixture JD/CV/answer markers. Authenticated caller present but non-owner ⇒ 404; `getUser()` returns no user ⇒ 401. Use `makeApiContext({ params:{ id }, body })` with valid-shaped bodies so the routes reach the ownership check rather than failing earlier on validation.

#### 2. IDOR mutation-safety assertions

**File**: same `idor.test.ts`

**Intent**: Prove a non-owner request never mutates the target row.

**Contract**: For the mutating routes (`answer.ts`, `save-answer.ts`, `check.ts`), after the 404 assert that **no `.update` payload was captured** in `calls` (the ownership read fails closed before any write) — and for `check.ts` additionally that the AI checker mock and `increment_check_usage` were **not** called.

### Success Criteria:

#### Automated Verification:

- IDOR tests pass for all four routes: `npm test`
- Type checking passes: `npm run astro -- check`
- Build still passes: `npm run build`

#### Manual Verification:

- Each of the four `[id]` routes appears in the table-driven cases (coverage review)
- No raw/real JD/CV strings appear in test fixtures or failure output (AGENTS.md privacy review)

**Implementation Note**: After automated verification passes, pause for human confirmation before Phase 4.

---

## Phase 4: Quality Gate + Cookbook Wiring

### Overview

Make the unit+integration gate official and turn the now-proven patterns into the test plan's cookbook, then update statuses.

### Changes Required:

#### 1. Test-plan cookbook + gate status

**File**: `context/foundation/test-plan.md`

**Intent**: Fill the Phase-1 cookbook sections with the real patterns and reflect that the gate is now enforced.

**Contract**: Replace §6.1 (unit), §6.2 (integration), §6.3 (new API endpoint) "TBD" stubs with concise patterns referencing `test/support/fake-supabase.ts`, `test/support/fake-context.ts`, the `vi.mock` factory-boundary approach, and oracle discipline. Append a §6.7 note for this phase. Update §3 Phase-1 Status to `complete` (or `implementing` until merged) and the §5 "unit + integration … required after §3 Phase 1" row to reflect it is now active. Note the deferred PRO daily-cap (S-05) under §7 or §2 Risk #1.

#### 2. README test instructions

**File**: `README.md`

**Intent**: Document how to run tests, per the user rule that README is the project source of truth.

**Contract**: Add a short "Testing" section: `npm test` / `npm run test:watch`, what's covered (plan/usage gating + practice-set IDOR), and the in-process (no-DB) nature.

### Success Criteria:

#### Automated Verification:

- Full suite passes: `npm test`
- Type checking passes: `npm run astro -- check`
- Build passes: `npm run build`

#### Manual Verification:

- test-plan §6.1–6.3 read as actionable patterns, not TBD
- test-plan §3 Phase-1 status and §5 gate row are updated and consistent
- README "Testing" section is accurate

**Implementation Note**: After automated verification passes, pause for final human confirmation.

---

## Testing Strategy

### Unit Tests:

- `limits.ts`: PRD plan-limit constants (oracle = literal PRD numbers).
- `get-usage-summary.ts`: `remaining` math, `isAt*Limit` flags, FREE/PRO/boundary, clamp-at-zero, RPC error mapping.

### Integration Tests (in-process, factory-mocked):

- `generate.ts`: 401, 403-at-limit (no insert), idempotency short-circuit, happy 202 (no increment on request path).
- `generate-worker.ts`: finalize-only-on-success, mark_failed-on-failure, no double-finalize.
- `check.ts`: 401, 403-at-limit (no AI/no increment), success (increment once, remaining−1), AI failure (no charge), persist failure (no charge), already_checked 409 (no charge), increment-failure under-count edge.
- `[id]/idor.test.ts`: non-owner 404 + no serve + no mutation, unauthenticated 401, across all four routes.

### Manual Testing Steps:

1. Run `npm test` — confirm all suites green.
2. Cross-check limit literals against `context/foundation/prd.md` FR-014..021.
3. Review that the under-count edge and the daily-cap gap are documented, not asserted as failures.

## Performance Considerations

Tests are pure in-process with mocked I/O — no network, DB, or AI calls — so the suite should run in well under a few seconds. No performance budget concerns.

## Migration Notes

No data or schema migration. Adds dev tooling and test files only; no production code paths change.

## References

- Research: `context/changes/testing-runner-and-critical-gating/research.md`
- Test strategy: `context/foundation/test-plan.md` (§2 Risk #1/#2, §4 stack, §5 gates, §6 cookbook)
- Gate: `src/lib/plan/get-usage-summary.ts:31`, `src/lib/plan/limits.ts:18`
- Routes: `src/pages/api/practice-sets/generate.ts:50`, `generate-worker.ts:216`, `[id]/check.ts:62`, `[id]/answer.ts`, `[id]/save-answer.ts`, `[id]/status.ts:19`
- Client factory: `src/lib/supabase/server.ts:10`
- Prior metering decisions: `context/changes/jd-gated-generation/reviews/impl-review.md:52-60`, `context/changes/open-ended-check-flow/plan.md:38-40,70`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner Bootstrap + Reusable Harness

#### Automated

- [x] 1.1 Dependencies install: `npm install` — 9e7afbe
- [x] 1.2 Test runner executes green: `npm test` — 9e7afbe
- [x] 1.3 Type checking passes: `npm run astro -- check` — 9e7afbe
- [x] 1.4 Build still passes: `npm run build` — 9e7afbe

#### Manual

- [x] 1.5 `npm run test:watch` starts and re-runs on file change — 9e7afbe
- [x] 1.6 No Astro/Tailwind plugin is loaded by the Vitest config — 9e7afbe

### Phase 2: Risk #1 — Plan/Usage Gating & Metering

#### Automated

- [x] 2.1 All Risk #1 tests pass: `npm test` — 67acb3e
- [x] 2.2 Type checking passes: `npm run astro -- check` — 67acb3e
- [x] 2.3 Build still passes: `npm run build` — 67acb3e

#### Manual

- [x] 2.4 Limit literals match PRD FR-014..021 — 67acb3e
- [x] 2.5 No test asserts a limit value imported from `limits.ts` (oracle review) — 67acb3e
- [x] 2.6 Under-count edge reads as intended behavior — 67acb3e

### Phase 3: Risk #2 — IDOR Across the Four `[id]` Routes

#### Automated

- [x] 3.1 IDOR tests pass for all four routes: `npm test` — 0a36510
- [x] 3.2 Type checking passes: `npm run astro -- check` — 0a36510
- [x] 3.3 Build still passes: `npm run build` — 0a36510

#### Manual

- [x] 3.4 All four `[id]` routes present in table-driven cases — 0a36510
- [x] 3.5 No raw/real JD/CV strings in fixtures or output — 0a36510

### Phase 4: Quality Gate + Cookbook Wiring

#### Automated

- [x] 4.1 Full suite passes: `npm test` — 34 passed (7 files)
- [x] 4.2 Type checking passes: `npm run astro -- check` — 0 errors
- [x] 4.3 Build passes: `npm run build` — complete

#### Manual

- [x] 4.4 test-plan §6.1–6.3 are actionable patterns
- [x] 4.5 test-plan §3 Phase-1 status and §5 gate row updated
- [x] 4.6 README "Testing" section accurate
