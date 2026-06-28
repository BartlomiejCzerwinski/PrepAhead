<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Delete Practice Data (S-07)

- **Plan**: context/changes/delete-practice-data/plan.md
- **Scope**: All 3 phases
- **Date**: 2026-06-28
- **Verdict**: NEEDS ATTENTION (resolved during triage)
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (automated; manual pending) |

Automated success criteria verified: `npm test` 38/38, `npm run astro -- check` 0 errors (1 pre-existing hint in GeneratePracticeFlow.tsx), `npm run build` complete. Manual items 1.3 / 2.3 / 2.4 remain pending (unchecked, not rubber-stamped). Note: change is not yet committed (new files + [id].astro edit untracked/modified) despite change.md status `implemented`.

## Findings

### F1 — UI promises to remove JD/CV, but soft-delete leaves them in the row

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (data-safety / trust)
- **Location**: src/pages/app/sets/[id].astro:337; src/components/app/DeletePracticeSetButton.tsx:86
- **Detail**: Copy claimed the action removes the set "and its job description and CV context from your account" / "permanently removes it", but the implementation is a soft-delete that only stamps `deleted_at`; the JD/CV text columns physically remain in the row. The plan deliberately excluded scrubbing, so the work matched the plan but the copy overstated the privacy guarantee for sensitive data (AGENTS.md flags JD/CV as sensitive; FR-010 is the trust signal).
- **Fix A ⭐ Recommended**: Reword the copy to match soft-delete reality (no scope change).
  - Strength: Honest with zero scope expansion; keeps the plan's "no scrubbing" decision intact.
  - Tradeoff: Slightly weaker-sounding privacy promise.
  - Confidence: HIGH — pure copy change.
  - Blind spot: None significant.
- **Fix B**: Null out jd_text/cv_text in the same UPDATE to honor the copy.
  - Strength: Delivers the stronger privacy guarantee the copy implied.
  - Tradeoff: Expands scope beyond the plan; needs confirmed column names + update grant + test.
  - Confidence: MEDIUM — schema/grant details unverified.
  - Blind spot: JD/CV column names and update grant coverage not confirmed.
- **Decision**: FIXED via Fix A — reworded both copy locations to "Remove this set from your account. You won't be able to access it again." / "Delete this set? You won't be able to access it again."

### F2 — Delete control placed in its own card, not the action row

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/app/sets/[id].astro:334-340
- **Detail**: Plan said render within/after the action row; impl uses a dedicated card outside the `contentReady` block. Benign — arguably an improvement, and satisfies the plan's explicit "show even when content isn't ready" requirement.
- **Decision**: ACCEPTED as-is (benign improvement).
