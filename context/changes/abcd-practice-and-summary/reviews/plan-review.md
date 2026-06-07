<!-- PLAN-REVIEW-REPORT -->
# Plan Review: ABCD practice and score summary

- **Plan**: context/changes/abcd-practice-and-summary/plan.md
- **Mode**: Deep
- **Date**: 2026-06-07
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓, 4/4 symbols ✓, brief↔plan ✓ (optimistic phrasing fixed in brief)

## Findings

### F1 — Progress parser not mandated on read-merge paths

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Answer persistence API
- **Detail**: Phase 1 introduces `parsePracticeSetWithProgress`, but Phase 2 never required it on the answer API read-merge-write path. `normalizePracticeSetContent()` strips `selectedOptionId`, `answeredAt`, and `currentQuestionIndex` — using it before merge would wipe prior answers on every write.
- **Fix**: Explicitly require `parsePracticeSetWithProgress()` on answer API, practice.astro, and overview reads; keep `normalizePracticeSetContent()` on generation path only.
- **Decision**: FIXED — parser mandate added to Phase 2, Phase 3, Phase 4

### F2 — Phase 3 summary vs Phase 4 component split

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 3 / Phase 4 boundary
- **Detail**: Phase 3 requires summary transition after 15th answer but `PracticeSummary.tsx` is Phase 4 — Phase 3 pause gate was not testable end-to-end.
- **Fix A ⭐ Recommended**: Minimal inline summary stub in Phase 3; Phase 4 polishes.
- **Decision**: FIXED — Fix A applied

### F3 — ABCD order is filter-based, not fixed slots

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — getAbcdQuestions helper
- **Detail**: Schema enforces counts only; interleaved ABCD/open-ended arrays are valid. Implementers might assume `questions[0..14]` are all ABCD.
- **Fix**: Explicit note in `getAbcdQuestions` contract.
- **Decision**: FIXED

### F4 — plan-brief says "optimistic save" but plan is server-first

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: plan-brief.md — Architecture / Approach
- **Detail**: Brief said "optimistic save" but Phase 3 requires server-confirmed persistence before advancing.
- **Fix**: Changed brief to "server-confirmed save + error recovery".
- **Decision**: FIXED

### F5 — JSONB merge race on concurrent tabs

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Answer persistence API
- **Detail**: plan-brief acknowledged last-write-wins on concurrent tabs; Phase 2 was silent.
- **Fix**: One-line concurrency note in Phase 2 contract.
- **Decision**: FIXED
