# ABCD practice and score summary Implementation Plan

## Overview

Implement **S-03** from `context/foundation/roadmap.md`: add an interactive ABCD practice loop on top of S-02's shipped generation. A signed-in user can start or continue practice on a generated set, answer 15 multiple-choice questions one at a time with immediate correct/incorrect feedback and explanation, persist progress in `practice_sets.content`, resume after leaving, and see a simple end-of-set score summary. Open-ended answering and Check remain **S-04** scope.

This slice completes the fast-feedback portion of **US-01** (FR-005 partial, FR-006, FR-007 partial, FR-009) without pulling Check, history, or billing work forward.

## Current State Analysis

- S-02 (`jd-gated-generation`, shipped 2026-06-07) delivers generation and a **read-only** overview at `/app/sets/[id]` showing all 20 questions grouped by type.
- `practice_sets.content` stores generation-only data: `version: 1`, `generatedAt`, and `questions[]` (15 `abcd` + 5 `open_ended`) validated by `src/lib/practice/contracts.ts`.
- ABCD questions already include `correctOptionId` and `explanation` server-side, but no answer fields (`selectedOptionId`, `answeredAt`) or `currentQuestionIndex` exist yet.
- `practice_sets.status` defaults to `in_progress` and supports `completed`, but nothing sets `completed` today.
- RLS allows authenticated users to update their own `practice_sets` rows; no answer API uses it yet.
- The blog interactive quiz (`src/lib/blog/quiz-practice-client.ts`, `src/lib/blog/score-quiz.ts`) demonstrates immediate grading UX and score math — client-only, index-based, no persistence.
- React islands are established in signed-in flows via `GeneratePracticeFlow.tsx`; API routes follow `createSupabaseServerClient` + `jsonResponse` patterns from `/api/practice-sets/*`.

## Desired End State

After this plan is complete:

1. Overview at `/app/sets/[id]` shows **Start practice** (no answers yet) or **Continue practice** (partial ABCD progress) when generation succeeded and content is valid.
2. `/app/sets/[id]/practice` renders a linear ABCD loop: one question at a time, progress indicator, immediate feedback on selection.
3. Selecting an option calls a server endpoint that grades, persists `selectedOptionId` + `answeredAt`, returns `isCorrect` + `explanation`, and advances `currentQuestionIndex`.
4. Answers are locked after first selection — no re-answer in v1.
5. Leaving and returning resumes at the first unanswered ABCD question with prior feedback visible for answered ones (FR-009).
6. After the 15th ABCD answer, the user sees a score summary: `X/15 correct`, percent, practice-drill disclaimer, and open-ended stub (`0/5 attempted — available after Check ships`).
7. `practice_sets.status` becomes `completed` when all 15 ABCD are answered.
8. Open-ended questions remain read-only on the overview; no text input or Check in S-03.

### Key Discoveries

- `src/pages/app/sets/[id].astro:104-107` explicitly defers practice progress to a later slice — S-03 replaces that copy with live status and CTAs.
- F-02 (`context/changes/supabase-data-schema/plan.md:81`) intended inline answer fields on question objects — S-03 should extend the **shipped** S-02 naming (`type`, `correctOptionId`) rather than reverting to F-02's `kind` / `correctOptionIndex`.
- Generation lifecycle must stay on `generation_jobs`; S-03 owns `practice_sets.status` + answer state only (`jd-gated-generation/plan.md:69`).
- `correctOptionId` must not reach the client before an answer is submitted — grading is server-authoritative.

## What We're NOT Doing

- Open-ended free-text input, Check feedback, or Check metering (S-04)
- Full practice-set history index or dashboard Continue link (S-09)
- Re-answer, back-navigation to change locked answers, or branching flows
- Regenerate-same-JD UX (FR-011)
- DOCX/OCR, generation pipeline changes, or new database tables/migrations
- Weighted or "readiness" scoring; numeric score covers ABCD only
- PRO billing, daily-cap enforcement, or usage-meter changes

## Implementation Approach

Extend the existing content contract with optional progress fields, add a single authenticated answer endpoint, and build a React practice island on a new sub-route. The overview remains the post-generation landing page and gains Start/Continue CTAs only.

Flow:

1. User lands on overview after generation (unchanged redirect target).
2. User taps **Start practice** → `/app/sets/[id]/practice`.
3. SSR loads set, strips `correctOptionId` from client payload for unanswered questions, hydrates answered state with server-computed `isCorrect`.
4. User selects option → `POST /api/practice-sets/[id]/answer` → server grades, merges JSONB, returns feedback.
5. UI shows correct/incorrect styling + explanation, enables **Next** (or auto-advances after brief delay — implementer choice; must not skip persistence).
6. On return visit, resume at `currentQuestionIndex` (first unanswered ABCD).
7. After 15th answer, show summary screen; set `status = completed`.

## Critical Implementation Details

**Server-side grading is mandatory.** The answer API must compare `selectedOptionId` to stored `correctOptionId` and return `isCorrect` + `explanation`. Client bundles and SSR props for unanswered questions must omit `correctOptionId`. For already-answered questions, SSR may include `isCorrect` derived server-side.

**`currentQuestionIndex` tracks the ABCD sequence (0–14), not the full 20-question array.** Map to the nth ABCD question in `content.questions` order. On resume, if index points to an already-answered question (data drift), derive next unanswered from answer fields.

**Completion semantics:** `practice_sets.status = completed` when all 15 ABCD questions have `selectedOptionId`. Open-ended items do not block completion in S-03.

## Phase 1: Contracts and scoring helpers

### Overview

Extend the practice content contract to support optional answer/progress fields while keeping the S-02 generation validation path intact.

### Changes Required:

#### 1. Extended question and content schemas

**File**: `src/lib/practice/contracts.ts`

**Intent**: Allow optional answer state on ABCD questions and a root-level cursor without breaking generation-time validation of new sets.

**Contract**:

- ABCD question type gains optional `selectedOptionId?: string` and `answeredAt?: string` (ISO timestamp).
- Content root gains optional `currentQuestionIndex?: number` (0–14 ABCD cursor).
- Split or layer schemas so `normalizePracticeSetContent()` (generation path) still requires exactly 15 ABCD + 5 open-ended with no answer fields required.
- Add `parsePracticeSetWithProgress(raw)` (or extend normalize with a mode) for the practice/answer path that accepts and validates optional answer fields when present.
- Reject `selectedOptionId` values that do not match one of the question's option ids.

#### 2. Progress and scoring helpers

**File**: `src/lib/practice/contracts.ts` (or `src/lib/practice/score-abcd.ts` if the file grows large)

**Intent**: Centralize resume cursor, ABCD progress counts, and end-of-set score math.

**Contract**:

- `getAbcdQuestions(content)` — filter `content.questions` where `type === 'abcd'`, preserving array order; do not assume the first 15 array slots are ABCD (interleaved types are valid per schema)
- `getAbcdProgress(content)` → `{ answeredCount, total: 15, currentIndex, isComplete }`.
- `scoreAbcdPractice(content)` → `{ correct, total: 15, percent }` using `selectedOptionId` vs `correctOptionId`.
- `buildOpenEndedSummaryStub()` → `{ attempted: 0, total: 5, label: 'Not attempted' }` for S-03 summary UI.
- Helpers must not log question text or answers.

#### 3. Client-safe question projection

**File**: `src/lib/practice/client-payload.ts` (new)

**Intent**: Shape SSR/API responses so unanswered ABCD items never include `correctOptionId`.

**Contract**:

- Export a type for practice UI consumption: prompt, options, id, type, and for answered items: `selectedOptionId`, `isCorrect`, `explanation`, `answeredAt`.
- Strip `correctOptionId` and pre-answer `explanation` from unanswered questions in outbound payloads.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- Existing generation path still validates and persists content without answer fields
- A manually crafted content document with answer fields parses without error

**Implementation Note**: Pause after Phase 1 for confirmation that contract changes do not regress S-02 generation before building API/UI on top.

---

## Phase 2: Answer persistence API

### Overview

Add an authenticated endpoint that accepts one ABCD answer, grades server-side, merges into `content`, updates progress, and marks the set completed when appropriate.

### Changes Required:

#### 1. Answer submission route

**File**: `src/pages/api/practice-sets/[id]/answer.ts`

**Intent**: Persist one locked ABCD answer per request with server-side grading.

**Contract**:

- `export const prerender = false`
- `POST` only; auth via `createSupabaseServerClient` + `getUser()` — 401 if unauthenticated
- Path param `id` = `practice_set_id`; scoped to `user_id` + `deleted_at is null`
- Request body: `{ questionId: string, selectedOptionId: string }`
- Validate generation succeeded (optional: require `generation_jobs.status = succeeded` or non-empty validated content)
- **Load existing content with `parsePracticeSetWithProgress()` — never `normalizePracticeSetContent()` on this path.** The generation normalizer strips `selectedOptionId`, `answeredAt`, and `currentQuestionIndex`; using it before merge would wipe prior answers on every write.
- Reject if question is not `abcd`, ids invalid, or question already has `selectedOptionId` (409 / `already_answered`)
- Grade, set `answeredAt`, update `currentQuestionIndex` to next unanswered ABCD index
- If all 15 ABCD answered: set `practice_sets.status = 'completed'`
- Update `content` jsonb and `updated_at` in one write
- Concurrent tab writes are last-write-wins for v1; same-question duplicate submit returns 409
- Response `{ ok: true, isCorrect, explanation, progress: { answeredCount, total, currentQuestionIndex, isComplete }, summary?: score payload when complete }`
- User-safe error messages; never log JD/CV/answers

#### 2. Optional practice state GET

**File**: `src/pages/api/practice-sets/[id]/practice-state.ts` (new, if SSR alone is insufficient for client refresh)

**Intent**: Let the React island re-fetch progress after errors without full page reload.

**Contract**:

- Authenticated GET returning client-safe projected content + progress + set status
- Omit if SSR + answer POST responses provide enough state — implementer decides; prefer fewer endpoints if POST response is sufficient

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- Submitting a valid answer persists to DB and returns correct feedback
- Duplicate submit on same question is rejected
- Invalid `selectedOptionId` returns 400 without mutating content
- After 15 answers, `status` is `completed` in DB

**Implementation Note**: Pause after Phase 2 for API smoke testing (e.g. via browser devtools or curl with session cookie) before UI work.

---

## Phase 3: Practice route and React island

### Overview

Add the interactive practice surface: sequential ABCD display, immediate feedback, next-question navigation, and in-route resume.

### Changes Required:

#### 1. Practice Astro page

**File**: `src/pages/app/sets/[id]/practice.astro`

**Intent**: Authenticated shell page that loads set content and hydrates the practice island.

**Contract**:

- `export const prerender = false`
- Auth redirect to `/login` if unauthenticated; redirect to `/app` if set not found/not owned
- Redirect to overview if generation not succeeded or content invalid
- Parse content with `parsePracticeSetWithProgress()` (not `normalizePracticeSetContent()`) so resume state survives SSR
- If `status === completed` and all ABCD answered, render summary mode (or redirect to summary view on same route)
- Pass client-safe initial payload to React island: set id, title, abcd questions/progress, theme-compatible layout via `AppLayout`

#### 2. Practice React island

**File**: `src/components/app/PracticeFlow.tsx`

**Intent**: Own sequential ABCD UX — selection, immediate feedback, navigation, error recovery.

**Contract**:

- Props: initial client-safe state from SSR
- Show progress (`answeredCount / 15`) and current question prompt + radio options
- On option select: disable options, POST answer, apply correct/incorrect styling (reuse blog CSS class patterns or Tailwind equivalents), show explanation
- Lock options after selection (no re-answer)
- **Next** advances to next unanswered question; on last answer, transition to summary view
- **Minimal summary stub (Phase 3):** after the 15th answer, show inline `X/15 correct (Y%)` with a short practice-drill label — enough to pass Phase 3 manual verification; Phase 4 replaces this with the full `PracticeSummary` panel (disclaimer, open-ended stub, nav links)
- Loading/error states for POST failures; do not advance cursor on failed save
- Resume: initialize from SSR at `currentQuestionIndex` with answered questions showing locked feedback

#### 3. Practice feedback styles

**File**: `src/styles/global.css` (or co-located module)

**Intent**: Visual feedback for correct/incorrect/reveal-correct states consistent with blog quiz and theme tokens.

**Contract**:

- Classes for correct, incorrect, and reveal-correct option states readable in light and dark mode
- Match existing `--brand`, `--text`, `--surface-*` tokens

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- User can answer questions sequentially with immediate feedback
- Mis-click is final (locked) per product decision
- Network error on save shows error and does not falsely advance progress
- Refresh mid-set resumes at correct question with prior answers visible

**Implementation Note**: Pause after Phase 3 for hands-on practice flow testing before overview/summary polish.

---

## Phase 4: Overview integration and score summary

### Overview

Wire overview CTAs, completion summary UI, and updated status copy on the set overview page.

### Changes Required:

#### 1. Overview Start/Continue CTAs

**File**: `src/pages/app/sets/[id].astro`

**Intent**: Give users a clear entry to practice without auto-redirecting away from read-only inspection.

**Contract**:

- Parse content with `parsePracticeSetWithProgress()` (not `normalizePracticeSetContent()`) so answered counts and CTAs reflect persisted progress
- When content ready and generation succeeded:
  - No ABCD answers → primary **Start practice** → `/app/sets/[id]/practice`
  - Partial ABCD progress → **Continue practice** with answered count hint
  - All ABCD complete → **View score summary** → practice route in summary mode (or anchor)
- Replace placeholder copy at lines 104–107 and 123–124 with live progress/status
- Keep read-only question preview sections intact

#### 2. Score summary panel

**File**: `src/components/app/PracticeSummary.tsx` (new, or section within `PracticeFlow.tsx`)

**Intent**: Replace Phase 3's inline summary stub with the full end-of-set summary per FR-007 partial.

**Contract**:

- Extract or replace the Phase 3 inline stub with a dedicated summary view

- Display `X/15 correct (Y%)` with label **Practice drill score** — not interview readiness
- Open-ended stub: `0/5 attempted` with short note that Check flow comes in a later update
- Link back to overview and to `/app/generate`
- Shown when ABCD loop completes (in practice route) and when reopening a completed set's practice URL

#### 3. Status display on overview

**File**: `src/pages/app/sets/[id].astro`

**Intent**: Reflect `practice_sets.status` and ABCD progress accurately.

**Contract**:

- Show `in_progress` vs `completed` with answered ABCD count
- Do not conflate with `generation_jobs.status`

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- Overview CTAs match set state (fresh, partial, complete)
- Summary copy includes practice-drill disclaimer
- Open-ended questions still visible read-only on overview
- `/app/generate` and generation flow unaffected

**Implementation Note**: Pause after Phase 4 for full end-to-end walkthrough from generation → practice → summary → overview.

---

## Phase 5: Verification and change hygiene

### Overview

Capture verification outcomes and leave the change ready for `/10x-implement` review.

### Changes Required:

#### 1. Verification log

**File**: `context/changes/abcd-practice-and-summary/verification.md`

**Intent**: Record build/check/manual outcomes for this slice.

**Contract**: Include checks for:

- build and `astro check`
- happy path: 15 ABCD answers with feedback
- resume after leave/return (FR-009)
- locked re-answer rejection
- score summary content and disclaimer
- overview CTA states
- no regression on generation flow

#### 2. Change status

**File**: `context/changes/abcd-practice-and-summary/change.md`

**Intent**: Keep metadata aligned with implementation progress.

**Contract**: `status: planned` until implementation completes; update `updated:` when status changes.

### Success Criteria:

#### Automated Verification:

- `npm run build` — exit 0
- `npm run astro -- check` — exit 0

#### Manual Verification:

- Signed-in user completes full S-03 path from overview → practice → summary
- Partial progress survives browser refresh and new session
- Generation (S-02) smoke still passes

---

## Testing Strategy

### Unit Tests:

- No new test runner in repo. Prefer small pure functions for `scoreAbcdPractice` and `getAbcdProgress` that are easy to spot-check manually.
- Automated gate remains `npm run build` and `npm run astro -- check`.

### Integration Tests:

- Manual only:
  - answer happy path
  - resume mid-set
  - duplicate answer rejection
  - completed set summary reopen
  - overview CTA states
  - generation regression smoke

### Manual Testing Steps:

1. Generate a new practice set (S-02 path) and land on overview.
2. Tap **Start practice**; answer Q1 — verify immediate feedback and DB persistence.
3. Refresh browser; verify **Continue** resumes at Q2 with Q1 feedback visible.
4. Complete all 15 ABCD; verify summary shows `X/15`, disclaimer, open-ended stub.
5. Return to overview; verify status `completed` and **View score summary** link.
6. Attempt to POST duplicate answer — verify rejection.
7. Generate another set; confirm generation still works and overview read-only preview intact.

## Performance Considerations

- One POST per ABCD answer (15 max per set) — acceptable at MVP scale.
- JSONB merge writes are single-row updates under RLS; no N+1 queries.
- Avoid sending full 20-question document with `correctOptionId` to client — project client-safe subset only.

## Migration Notes

- No database migration required — answer state lives in existing `content` jsonb.
- Sets generated before S-03 have no answer fields; `currentQuestionIndex` defaults to 0 / first unanswered.
- No backfill needed.

## References

- Roadmap S-03: `context/foundation/roadmap.md`
- PRD FR-005–007, FR-009, US-01: `context/foundation/prd.md`
- S-02 plan and deferrals: `context/changes/jd-gated-generation/plan.md`
- F-02 content intent: `context/changes/supabase-data-schema/plan.md`
- Content contract: `src/lib/practice/contracts.ts`
- Set overview: `src/pages/app/sets/[id].astro`
- Blog quiz reference: `src/lib/blog/quiz-practice-client.ts`, `src/lib/blog/score-quiz.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Contracts and scoring helpers

#### Automated

- [x] 1.1 `npm run build` — exit 0
- [x] 1.2 `npm run astro -- check` — exit 0

#### Manual

- [x] 1.3 Generation path still validates content without answer fields
- [x] 1.4 Content with answer fields parses successfully

### Phase 2: Answer persistence API

#### Automated

- [ ] 2.1 `npm run build` — exit 0
- [ ] 2.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 2.3 Valid answer persists and returns feedback
- [ ] 2.4 Duplicate answer rejected; invalid option rejected
- [ ] 2.5 After 15 answers, `status` is `completed`

### Phase 3: Practice route and React island

#### Automated

- [ ] 3.1 `npm run build` — exit 0
- [ ] 3.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 3.3 Sequential answer flow with immediate feedback works
- [ ] 3.4 Refresh mid-set resumes correctly

### Phase 4: Overview integration and score summary

#### Automated

- [ ] 4.1 `npm run build` — exit 0
- [ ] 4.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 4.3 Overview CTAs match fresh/partial/complete states
- [ ] 4.4 Summary shows ABCD score, disclaimer, and open-ended stub

### Phase 5: Verification and change hygiene

#### Automated

- [ ] 5.1 `npm run build` — exit 0
- [ ] 5.2 `npm run astro -- check` — exit 0

#### Manual

- [ ] 5.3 Full S-03 path verified; S-02 generation regression smoke passes
