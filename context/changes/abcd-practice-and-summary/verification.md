# S-03 verification checklist

Roadmap slice **S-03**: ABCD practice loop, resume, and score summary (FR-005 partial, FR-006, FR-007 partial, FR-009).

## Automated (local)

- [x] `npm run build` — exit 0 (2026-06-07)
- [x] `npm run astro -- check` — exit 0, 0 errors (2026-06-07)

## Practice happy path

- [x] Signed-in user lands on overview after generation with **Start practice** CTA
- [x] Practice route (`/app/sets/[id]/practice`) shows one ABCD question at a time with progress indicator
- [x] Selecting an option returns immediate correct/incorrect feedback and explanation; options lock after selection
- [x] **Next question** advances the loop; after 15 answers, **View score** shows summary
- [x] Score summary displays `X/15 correct (Y%)`, practice-drill disclaimer, and open-ended stub (`0/5 attempted`)

## Resume and persistence (FR-009)

- [x] Partial ABCD progress survives browser refresh; practice resumes at next unanswered question
- [x] Overview shows **Continue practice** with answered count hint for partial sets
- [x] Overview shows **View score summary** and `completed` status when all 15 ABCD answered

## API (verified via UI during Phase 3–4)

- [x] Valid answer persists to `practice_sets.content` jsonb
- [x] `practice_sets.status` becomes `completed` after 15 ABCD answers
- [ ] Duplicate answer POST returns 409 — not re-tested via devtools in final pass (UI lock prevents re-select)

## Overview and regression

- [x] Open-ended questions remain read-only on overview (no text input / Check)
- [x] `/app/generate` generation flow unaffected (S-02 regression smoke)
- [x] Generation prompt updated to vary `correctOptionId` across A–D (fixes all-A bias in older sets)

## Commits (reference)

| Phase | SHA | Scope |
|-------|-----|-------|
| 1 | `2c24318` | Contracts, scoring helpers, client payload |
| 2 | `fa98c6a` | Answer persistence API |
| 3 | `d9aaefc` | Practice route, PracticeFlow, prompt fix |
| 4 | `475a607` | Overview CTAs, PracticeSummary |
