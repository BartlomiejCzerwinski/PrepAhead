# Test Runner + Critical Gating Coverage — Plan Brief

> Full plan: `context/changes/testing-runner-and-critical-gating/plan.md`
> Research: `context/changes/testing-runner-and-critical-gating/research.md`

## What & Why

Phase 1 of `context/foundation/test-plan.md`: bootstrap the project's first test runner (Vitest) and lock the two highest-priority risks — **plan/usage gating & metering** (Risk #1, the money/trust path) and **practice-set IDOR** (Risk #2, another user's JD/CV/answers). The builder's core worry is silent regression in a mostly-AI-coded app they don't know well; these tests make critical-path breakage fail loudly.

## Starting Point

Zero test tooling exists (no Vitest, config, or path aliases); the only gate is `astro check` + `build`. The gate logic (`getUsageSummary`), generation metering (DB RPC `finalize_generation_job`), Check metering (`check.ts` + `increment_check_usage`), and the four owner-scoped `[id]` routes are all in place and were mapped in research.

## Desired End State

`npm test` runs a green, in-process suite (no DB/Docker) proving: FREE blocks at `remaining=0`; generation hard-caps at 300 / FREE at 1; generation meters only on success (never on failure/double); Check honors its full success/failure contract including the accepted under-count edge; and every `[id]` route denies a non-owner with 404 — serving and mutating nothing — and an anonymous caller with 401. The unit+integration gate is documented as `required`, cookbook patterns are filled, and the unimplemented PRO daily-cap is recorded as a deferred gap.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Integration harness | Mock the Supabase factory in-process (no DB) | Fast, deterministic, no Docker — matches "mock at the client boundary" and prior Docker-skipping changes | Plan |
| Unimplemented daily-cap | Test only enforced caps; record gap (ref S-05) | Honest scope — assert real behavior, keep this a test phase not a feature phase | Research + Plan |
| Test double | One reusable chainable fake-client helper | Single place to maintain the Supabase surface; becomes the cookbook pattern | Plan |
| IDOR breadth | All four `[id]` API routes (check/answer/save-answer/status) | Locks the whole ownership surface cheaply once the helper exists | Plan |
| Generation metering | Assert handler/worker orchestration; SQL cap out-of-scope | The atomic cap/idempotency live in SQL, unreachable by the mock | Research + Plan |
| Check depth | Full success/failure contract incl. under-count edge | Encodes the real asymmetric contract so charging can't silently drift | Research + Plan |

## Scope

**In scope:** Vitest bootstrap + reusable harness; unit tests for `limits.ts` & `get-usage-summary.ts`; integration tests for `generate.ts`, `generate-worker.ts`, `check.ts`, and IDOR across the four `[id]` routes; cookbook + gate + README wiring.

**Out of scope:** Implementing the daily-cap/soft-threshold; real Supabase/Docker & DB-level RLS assertions; production refactors; SSR `[id]` pages; generation-contract (test-plan Phase 2), auth/leakage (Phase 3), AI-grounding (Phase 4); e2e/CI.

## Architecture / Approach

Plain `defineConfig` from `vitest/config` (Node env) to avoid the `getViteConfig`/Vite-7 crash; pin `vitest@^4.1`. A `test/support/` module exports `createFakeSupabase(seed)` (chainable, records insert/update/rpc calls) and `makeApiContext(...)`. Integration tests `vi.mock` the `createSupabaseServerClient` factory so each route's handler runs against the seeded fake client; unit tests import pure modules directly. Limits are asserted against literal PRD numbers (oracle discipline), never echoed from the code under test.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bootstrap + harness | Vitest config, scripts, fake-client + fake-context helpers, smoke test | Chainable fake must faithfully mirror the Supabase builder surface |
| 2. Risk #1 gating/metering | Unit gate math + integration generate/worker/check contracts | Over-asserting SQL-internal behavior the mock can't see |
| 3. Risk #2 IDOR | Table-driven non-owner 404 + no serve/mutate across 4 routes | Reaching the ownership check past per-route body validation |
| 4. Gate + cookbook | `required` gate, cookbook §6.1–6.3, README, statuses | Doc drift vs actual test patterns |

**Prerequisites:** None beyond the existing repo + `npm install`.
**Estimated effort:** ~2–3 sessions across 4 phases (Phase 1 + the harness is the bulk).

## Open Risks & Assumptions

- The in-process harness does **not** verify real RLS or the SQL-internal atomic cap/idempotency — these stay unproven until a future real-Supabase layer; documented in-plan.
- The PRO daily-cap (10/day) and soft-threshold (100) don't exist in code; the test-plan's literal "daily-caps at 10" intent is consciously deferred (S-05), not delivered here.
- Fake-client fidelity is the main maintenance risk; mitigated by centralizing it in one helper.

## Success Criteria (Summary)

- `npm test` is green and runs with no DB/network/AI; `astro check` + `build` still pass.
- A silent change to a plan limit, the increment-on-success rule, or an ownership filter now fails a test.
- Cookbook §6.1–6.3 and the README document how to add the next test; the daily-cap gap is on record.
