<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: ABCD practice and score summary

- **Plan**: context/changes/abcd-practice-and-summary/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Client double-submit race on answer POST

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/app/PracticeFlow.tsx:112-118
- **Detail**: `isSaving` is React state; a second radio `onChange` before re-render can fire a duplicate POST. `GeneratePracticeFlow` uses ref-based synchronous guards for similar flows.
- **Fix**: Add a `submittingRef` mutex set synchronously before `fetch`; keep `isSaving` for UI.
- **Decision**: FIXED

### F2 — Supabase update success not verified by row count

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice-sets/[id]/answer.ts:228-247
- **Detail**: Update checks `error` only, not affected row count. Ownership/delete drift between read and write could return `ok: true` without persisting.
- **Fix**: Chain `.select('id')` on update; return 404/500 if zero rows returned.
- **Decision**: FIXED

### F3 — JSONB last-write-wins on concurrent tabs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/pages/api/practice-sets/[id]/answer.ts:228-236
- **Detail**: Read-merge-write replaces entire `content` jsonb. Two tabs answering different questions concurrently can drop one answer. Plan Phase 2 explicitly accepts LWW for v1.
- **Decision**: SKIPPED (accepted v1 LWW per plan)

### F4 — Parallel duplicate POST for same question

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/practice-sets/[id]/answer.ts:184-193
- **Detail**: Two in-flight POSTs for the same question can both pass the `already_answered` check before either write lands. Sequential retries correctly return 409.
- **Decision**: SKIPPED (accepted v1 per plan)

### F5 — Fetch credentials not explicit on practice POST

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/app/PracticeFlow.tsx:121-128
- **Detail**: `GeneratePracticeFlow` sets `credentials: 'same-origin'`; practice answer fetch omits it (browser default is usually fine).
- **Fix**: Add `credentials: 'same-origin'` for parity.
- **Decision**: FIXED

### F6 — Answer API accepts out-of-order questionId

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/api/practice-sets/[id]/answer.ts:161-204
- **Detail**: Server accepts any valid unanswered ABCD question; UI enforces linear flow only. Low stakes for solo practice.
- **Decision**: SKIPPED (intentional for solo practice)

## Plan drift (informational — no action required)

- Answer POST returns `correctOptionId` post-submit for reveal-correct UX (not in planned response shape; does not violate pre-answer secrecy rule).
- Generation prompt updated to vary `correctOptionId` across A–D (EXTRA, documented in verification.md).
- Optional `practice-state.ts` GET correctly omitted.
- Duplicate 409 API check deferred in verification.md (UI lock prevents re-test; implementation present).

## Commits reviewed

| Phase | SHA |
|-------|-----|
| 1 | 2c24318 |
| 2 | fa98c6a |
| 3 | d9aaefc |
| 4 | 475a607 |
| 5 | 6e2e499 |
