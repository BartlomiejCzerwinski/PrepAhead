# ABCD practice and score summary — Plan Brief

> Full plan: `context/changes/abcd-practice-and-summary/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-03)
> PRD: `context/foundation/prd.md` (FR-005, FR-006, FR-007, FR-009, US-01)

## What & Why

S-03 completes the fast-feedback loop that makes generated practice sets useful: a signed-in user can answer ABCD questions one at a time, see immediate correct/incorrect feedback with a short explanation, resume where they left off, and finish with a simple practice-drill score summary. Generation (S-02) already lands users on a read-only overview — this slice turns that set into an interactive drill without pulling open-ended Check forward from S-04.

## Starting Point

S-02 ships validated 20-question content in `practice_sets.content` (`version: 1`, `generatedAt`, `questions[]` with 15 ABCD + 5 open-ended), a read-only overview at `/app/sets/[id]`, and generation APIs only. The database already has `practice_sets.status` (`in_progress` / `completed`), `content jsonb`, RLS update policy, and `updated_at`. There are no answer APIs, no progress fields in content, and no practice UI. The blog interactive quiz provides a client-only reference for immediate grading styling.

## Desired End State

After this plan, a signed-in user opens a generated set overview, taps **Start practice** or **Continue practice**, and enters `/app/sets/[id]/practice` for a linear ABCD loop (15 questions, one at a time). Selecting an option immediately grades, persists the answer, shows explanation, and locks the choice. Leaving and returning resumes at the first unanswered ABCD question with prior answers intact. After question 15, the user sees a score summary (`X/15` + practice-drill disclaimer, open-ended stub as not attempted). `practice_sets.status` becomes `completed` when all ABCD items are answered.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Practice surface | Dedicated `/app/sets/[id]/practice` sub-route | Keeps S-02 read-only overview intact while adding interactive practice. | Plan |
| Navigation | One ABCD question at a time, linear | Focused flow with natural resume via `currentQuestionIndex`. | Plan |
| Submit UX | Grade + persist immediately on option select | Matches FR-006 and blog-quiz immediacy with one interaction. | Plan |
| Answer storage | Inline `selectedOptionId` + `answeredAt` on question objects | Single JSONB document; aligns with F-02 intent and S-02 naming. | Plan |
| Re-answer policy | Lock after first selection | Simplest state model; matches blog quiz behavior. | Plan |
| Score summary | ABCD score + open-ended stub (0/5 not attempted) | Delivers FR-007 ABCD portion while foreshadowing S-04 without building Check. | Plan |
| Open-ended in flow | ABCD-only practice route; open-ended stay on overview | Clean S-03/S-04 boundary; no dead-end UX without Check. | Plan |
| Resume entry | Start/Continue CTA on overview only | Minimal FR-009 scope; full dashboard history waits for S-09. | Plan |
| Grading authority | Server-side only; never expose `correctOptionId` pre-answer | Prevents client-side cheating; explanation returned after submit. | Plan |

## Scope

**In scope:** Extended content contract with progress fields; authenticated answer API; `/app/sets/[id]/practice` React island; immediate ABCD feedback UI; persistence + resume (FR-009); end-of-set ABCD score summary (FR-007 partial); overview Start/Continue CTA; `practice_sets.status → completed` when ABCD loop finishes.

**Out of scope:** Open-ended free-text input and Check (S-04); practice-set history list (S-09); regenerate same JD (FR-011); dashboard Continue for latest in-progress set; re-answer / review mode; PRO billing changes.

## Architecture / Approach

Extend `src/lib/practice/contracts.ts` with optional answer fields and scoring helpers. Add `POST /api/practice-sets/[id]/answer` to validate ownership, grade server-side, merge into `content` JSONB, bump `updated_at`, and flip `status` when all 15 ABCD are answered. An Astro page at `/app/sets/[id]/practice.astro` SSR-loads the set and hydrates a React island (`PracticeFlow`) for sequential question display, server-confirmed save + error recovery, and the final summary screen. Overview at `/app/sets/[id]` gains Start/Continue links only — generation lifecycle stays on `generation_jobs`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contracts & scoring | Extended Zod schema, progress helpers, ABCD score function | Must not break S-02 generation validation path |
| 2. Answer persistence API | Authenticated POST answer endpoint with server-side grading | JSONB merge races if user opens two tabs |
| 3. Practice route & UI | `/practice` page, React island, immediate feedback UX | First signed-in practice island — state + resume edge cases |
| 4. Overview & summary | Start/Continue CTA, completion summary, status display | Copy must label score as practice drill, not readiness |
| 5. Verification | Build/check smoke + manual verification log | No automated test runner in repo yet |

**Prerequisites:** S-02 shipped; user can generate a valid 20-question set; Supabase RLS update policy on `practice_sets` working.

**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- Two browser tabs on the same set could race on JSONB writes — acceptable for v1; API rejects re-answer on already-answered questions.
- `practice_sets.status = completed` when ABCD loop finishes even though open-ended items are untouched — intentional until S-04 extends completion semantics.
- Open-ended summary aggregation beyond "not attempted" stub is deferred to S-04 / PRD open question #5.

## Success Criteria (Summary)

- Signed-in user can complete all 15 ABCD questions with immediate feedback and explanation per answer.
- Leaving mid-set and returning resumes with prior answers intact (FR-009).
- End-of-set summary shows objective ABCD counts with practice-drill disclaimer (FR-007 partial).
- Overview links to practice; generation and Check flows remain unaffected.
