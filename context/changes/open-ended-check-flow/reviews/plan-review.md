<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Open-ended Check flow

- **Plan**: context/changes/open-ended-check-flow/plan.md
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: REVISE
- **Findings**: 1 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 paths ✓, 4/4 symbols ✓ (`buildOpenEndedSummaryStub`, `increment_check_usage`, `getUsageSummary`, `checkLimit`), brief↔plan ✓

## Findings

### F1 — Wrong practice_sets column name for JD context

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Check API (line 199)
- **Detail**: Plan says load `job_description` from `practice_sets`. Schema and existing code use `job_description_text` (`supabase/migrations/20260530110000_create_practice_sets.sql:12`, `generate-worker.ts:165`). Check API would fail at runtime with a non-existent column.
- **Fix**: Change Phase 2 check.ts contract to select `job_description_text` + `cv_text`; pass as `jobDescription` param to `runOpenEndedCheck()`.
- **Decision**: FIXED — use `job_description_text` + `cv_text`

### F2 — Check usage increment ordering contradicts Critical Details

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details (line 69) vs Phase 2 Check API (line 201)
- **Detail**: Critical Details say increment only after feedback is persisted. Phase 2 contract says `increment_check_usage()` then merge into content. If increment succeeds and `.update()` fails (S-03 pattern at `answer.ts:239-247`), user loses a Check without saved feedback. Generation uses persist-then-increment inside `finalize_generation_job` SQL — not increment-then-persist.
- **Fix A ⭐ Recommended**: Unify on OpenAI → merge content → `.update()` with row-count check → `increment_check_usage()` only after update succeeds. Document under-count edge case if increment fails after persist (user keeps feedback, not charged).
  - Strength: Matches Critical Details and generation finalize ordering; avoids over-charging.
  - Tradeoff: Rare case where feedback persists but increment fails leaves user under-counted.
  - Confidence: HIGH — mirrors `finalize_generation_job` pattern.
  - Blind spot: No atomic SQL wrapper for check persist+increment yet.
- **Fix B**: Add `finalize_check` SQL RPC (persist + cap check + increment in one transaction).
  - Strength: Atomic; eliminates increment/update race and concurrent over-limit.
  - Tradeoff: New migration; more scope than S-04 needs for MVP.
  - Confidence: MEDIUM — correct long-term but heavier than mirroring answer.ts LWW.
  - Blind spot: Migration review not done.
- **Decision**: FIXED via Fix A — persist-then-increment ordering

### F3 — Overview status label wrong between Phase 2 and Phase 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 §4 + Phase 4 §1; `[id].astro:75-78`
- **Detail**: After Phase 2 stops writing `completed` on ABCD-only finish, `[id].astro` still shows status label `completed` when `abcdProgress.isComplete` is true — even if open-ended unchecked. Phase 4 fixes the label, but Phases 2–3 ship with misleading "completed" copy on overview.
- **Fix A ⭐ Recommended**: Move overview status-label update into Phase 2 (minimal edit to `[id].astro` alongside `answer.ts` completion change).
  - Strength: No interim wrong UX between phases.
  - Tradeoff: Phase 2 touches a UI file early.
  - Confidence: HIGH — single expression change.
  - Blind spot: None significant.
- **Fix B**: Accept interim mismatch; verify only in Phase 4 manual steps.
  - Strength: Keeps Phase 2 server-only.
  - Tradeoff: Manual testing mid-build shows incorrect status.
  - Confidence: HIGH — known gap.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — status-label update moved to Phase 2

### F4 — No SQL cap on `increment_check_usage()` — concurrent over-limit possible

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Check API; `supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql:156-169`
- **Detail**: Plan correctly notes app pre-flight via `isAtCheckLimit`, but `increment_check_usage()` unconditionally increments (unlike `finalize_generation_job` generation cap). Two concurrent Check POSTs can both pass pre-flight and exceed FREE/PRO limits.
- **Fix A ⭐ Recommended**: Document as accepted v1 risk (same class as JSONB LWW); rely on app pre-flight + UI disable.
  - Strength: No migration; matches S-03 pragmatic scope.
  - Tradeoff: Edge-case over-limit under concurrency.
  - Confidence: HIGH — plan href MVP per S-03 impl-review precedent.
  - Blind spot: None for MVP.
- **Fix B**: Add SQL cap to `increment_check_usage()` or wrap in `finalize_check` RPC.
  - Strength: Hard limit enforcement.
  - Tradeoff: Migration + error handling in check API.
  - Confidence: MEDIUM — correct but scope expansion.
  - Blind spot: PRO 500-cap behavior under race unverified.
- **Decision**: ACCEPTED — documented as v1 risk (Fix A)

### F5 — PRD delta (FREE 1→5 Checks) has no phase task

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Overview (line 9); Phase 1 limits bump only
- **Detail**: Plan notes PRD says FREE 1 Check (`prd.md:247-258`) but code change is only in Phase 1 `limits.ts`. No phase updates `context/foundation/prd.md` plan rules — risk of doc/code drift at merge.
- **Fix**: Add Phase 1 (or Phase 4) task: update PRD plan rules FREE Check 1→5 and note in Open Questions if needed.
- **Decision**: FIXED — PRD sync task added to Phase 1

### F6 — Phase 1 lint success criterion is unactionable

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Success Criteria
- **Detail**: "Linting passes if configured in project scripts" — `package.json` has no lint script. Criterion has no matching Progress checkbox.
- **Fix**: Remove lint bullet from Phase 1 success criteria (or add lint script in separate change).
- **Decision**: FIXED — removed unactionable lint criterion

### F7 — Open-ended end-of-flow summary underspecified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — OpenEndedFlow (line 275)
- **Detail**: Desired End State #7 promises score summary counts; OpenEndedFlow only says "link to overview/summary or inline completion message" when all 5 checked. No explicit reuse of `PracticeSummary` on `/open-ended` when full set completes (ABCD + open-ended).
- **Fix**: Specify: when `isPracticeSetFullyComplete`, render `PracticeSummary` inline on open-ended route (mirror `PracticeFlow` after ABCD complete).
- **Decision**: FIXED — inline PracticeSummary on full-set complete
