<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test Runner + Critical Gating Coverage

- **Plan**: context/changes/testing-runner-and-critical-gating/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-06-28
- **Verdict**: NEEDS ATTENTION
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

Success Criteria evidence: `npm test` 34/34 passed (7 files); `npm run astro -- check` 0 errors (1 pre-existing unrelated hint); `npm run build` complete. All 13 planned items verified MATCH; test relocations to `test/integration/**` are documented; `test/support/fixtures.ts` is benign supporting harness.

## Findings

### F1 — IDOR tests don't actually verify the ownership predicate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: test/support/fake-supabase.ts:92-94, test/integration/api/practice-sets/idor.test.ts:37-45
- **Detail**: `FakeQueryBuilder.eq()` is a no-op. `nonOwnerSeed()` simulates "not owned" by seeding the read as `{ data: null }`. Consequences: (1) the "no JD/CV/answer leak" assertions (idor.test.ts:110-112) are tautological — no marker-bearing row is ever seeded; (2) if a route dropped its `.eq('user_id', user.id)` filter, these tests would still pass. The suite proves "null read → 404 + no mutation", not "a non-owner is filtered out". Inherent to the chosen in-process harness, but the `user_id` predicate is application-level (wider than the plan's "not asserting RLS" guardrail).
- **Fix A ⭐ Recommended**: Record filter args in the fake (eq/is push `{column,value}` into `calls.filters`) and assert each route called `.eq('user_id', 'attacker')` + `.is('deleted_at', null)` on the scoped table.
  - Strength: Closes the dropped-predicate blind spot with the existing harness pattern; ~15 lines + one assertion per case.
  - Tradeoff: Asserts the filter is requested, not DB-enforced (needs real-Supabase layer).
  - Confidence: HIGH — mirrors how inserts/updates are already recorded.
  - Blind spot: No RLS-level enforcement (out of scope by design).
- **Fix B**: Document the limitation in idor.test.ts + test-plan §6.7; defer real enforcement coverage to the real-Supabase phase.
  - Strength: Honest about what green means; zero code risk.
  - Tradeoff: Dropped-predicate regression undetectable until real-DB phase.
  - Confidence: HIGH — pure documentation.
  - Blind spot: Relies on a future phase being built.
- **Decision**: FIXED via Fix A — `eq`/`is` now record `{table,column,value}` into `calls.filters` (fake-supabase.ts); idor.test.ts asserts each route applied `.eq('user_id','attacker')` on its scoped table (+ `.is('deleted_at',null)` for the three practice_sets routes). Suite green 34/34.

### F2 — Idempotency short-circuit test doesn't exercise key matching

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: test/integration/api/practice-sets/generate.test.ts
- **Detail**: The "existing job → 200, no new insert" case seeds the job directly; the no-op `.eq()` means the idempotency-key lookup isn't asserted. Same root cause as F1.
- **Fix**: After F1's filter-recording, assert the idempotency key was looked up.
- **Decision**: FIXED — generate.test.ts idempotency case now asserts the lookup filtered `generation_jobs` by `user_id='u1'` and `idempotency_key='key-1'`. Suite green 34/34.

### F3 — check.ts post-AI concurrency 409 branch is uncovered

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; narrowly scoped
- **Dimension**: Success Criteria
- **Location**: test/integration/api/practice-sets/check.test.ts
- **Detail**: check.ts has two already_checked guards: pre-AI (:209) and a post-AI fresh re-read (:310). The fake returns one fixed seed per (table, op), so only the pre-AI guard is exercised; the concurrency re-read at :310 is untested.
- **Fix**: Allow the fake to return a sequence of results per (table, op) so a re-read can differ, then add a post-AI already_checked case. Acceptable to defer.
- **Decision**: SKIPPED — accepted v1 coverage gap; revisit when the concurrency path matters.

### F4 — Smoke test assertion is tautological

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: test/support/smoke.test.ts
- **Detail**: `expect(true).toBe(true)` is a deliberate runner sanity check; the file also instantiates both helpers (the real value). No action needed.
- **Fix**: Optional — drop the trivial line.
- **Decision**: SKIPPED — intentional runner sanity check; left as-is.
