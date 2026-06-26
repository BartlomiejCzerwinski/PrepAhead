<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Open-ended Check flow

- **Plan**: context/changes/open-ended-check-flow/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-06-26
- **Verdict**: NEEDS ATTENTION (all findings triaged and resolved)
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (astro check passes; `npm run build` deferred — dev server running) |

## Findings

### F1 — Check overwrites set with stale content after multi-second AI call

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice-sets/[id]/check.ts:176, 250-256, 273, 293
- **Detail**: `content` was read before the 3–15s OpenAI call, then the merge used that stale snapshot and wrote the whole JSONB document back. A concurrent draft save on a different open-ended question (another tab) during the AI call would be clobbered. The plan accepted JSONB LWW for concurrent tabs, but the AI call widens the race window from milliseconds to many seconds.
- **Fix**: After a successful Check, re-fetch current content, re-validate the target isn't already checked (409 if so, before charging usage), re-merge feedback into the fresh content, then update. Narrows the clobber window back to the S-03-accepted range.
- **Decision**: FIXED

### F2 — Summary still falls back to retired stub with stale "later update" copy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/app/PracticeSummary.tsx:1, 32, 69-74
- **Detail**: Plan said to accept `openEndedSummary` as a prop and remove `buildOpenEndedSummaryStub()`. The component still imported/called the stub as a fallback rendering "Check feedback ... ships in a later update" — false since Check shipped.
- **Fix**: Made `openEndedSummary` a required prop, removed the stub import/fallback, and deleted `buildOpenEndedSummaryStub` + `OpenEndedSummaryStub` from score-abcd.ts and the contracts.ts re-export. PracticeFlow now always passes a value.
- **Decision**: FIXED

### F3 — MIN/MAX_ANSWER_CHARS duplicated across three files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: check.ts:20-21, save-answer.ts:15, OpenEndedFlow.tsx:6
- **Detail**: The 20/8000-char bounds were redefined in each file and could drift between client hint and server gate.
- **Fix**: Hoisted to `src/lib/practice/answer-limits.ts` and imported in all three.
- **Decision**: FIXED

### F4 — Save draft lacks the submittingRef mutex

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/components/app/OpenEndedFlow.tsx (handleSaveDraft)
- **Detail**: `handleSaveDraft` checked `submittingRef` but never set it, so rapid double-save could fire redundant writes (harmless — no usage consumed, LWW).
- **Fix**: Set `submittingRef.current = true` after the guard and reset it in `finally`, matching handleCheck.
- **Decision**: FIXED

### F5 — Three unrelated files re-encoded (CRLF) in the feature commit

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/landing/Footer.astro, src/components/landing/Header.astro, src/layouts/Layout.astro
- **Detail**: Pure LF→CRLF re-encoding (no substantive change) bundled into the open-ended commits — history noise.
- **Fix**: Optional `.gitattributes` line-ending normalization repo-wide.
- **Decision**: SKIPPED
