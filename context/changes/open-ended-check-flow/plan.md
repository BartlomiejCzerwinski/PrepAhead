# Open-ended Check flow Implementation Plan

## Overview

Implement **S-04** from `context/foundation/roadmap.md`: add open-ended free-text answering and critical AI **Check** feedback on top of S-03's shipped ABCD practice. A signed-in user can save draft answers, tap Check on each of the 5 open-ended questions (one at a time on a dedicated route), receive critical feedback within plan Check limits, and see attempted/checked counts on the score summary. Full set completion requires all 15 ABCD answered and all 5 open-ended Checked.

This slice completes **US-01** (open-ended portion) and **US-03** (FR-017, FR-018, FR-019), plus FR-005 (enter free-text) and FR-007 (summary partial).

**Planning decision — PRD delta:** FREE tier `checkLimit` changes from **1 → 5** in this slice so FREE users can Check all 5 open-ended questions per set. Update PRD plan rules or Open Questions when merging.

## Current State Analysis

- S-03 (`abcd-practice-and-summary`, shipped 2026-06-07) delivers ABCD practice at `/app/sets/[id]/practice`, `POST /api/practice-sets/[id]/answer`, and sets `practice_sets.status = completed` when all 15 ABCD are answered.
- `practice_sets.content` stores 15 `abcd` + 5 `open_ended` questions. Open-ended schema is `{ id, type, prompt, guidance }` only — no answer or Check fields (`src/lib/practice/contracts.ts:44-49`).
- Overview at `/app/sets/[id]` shows open-ended read-only with copy deferring Check (`src/pages/app/sets/[id].astro:219-237`).
- `PracticeSummary` uses `buildOpenEndedSummaryStub()` → hardcoded `0/5 attempted` (`src/components/app/PracticeSummary.tsx:24-58`).
- `answer.ts` rejects open-ended with `error: 'not_abcd'` (`src/pages/api/practice-sets/[id]/answer.ts:167-175`).
- DB: `increment_check_usage()` RPC exists; `getUsageSummary()` returns `isAtCheckLimit` — **never called from a Check action**.
- Generation AI pattern in `src/lib/server/practice/generate-practice-set.ts` — OpenAI chat completions, `gpt-4.1-mini`, timeout, structured error codes.
- FREE `checkLimit: 1` in `src/lib/plan/limits.ts:6` — insufficient for all-5-Checked completion.

## Desired End State

After this plan is complete:

1. Overview shows **Answer open-ended** / **Continue open-ended** CTA (available as soon as generation succeeds, independent of ABCD progress) plus open-ended progress hint.
2. `/app/sets/[id]/open-ended` renders a linear open-ended loop: one question at a time, textarea, **Save draft**, **Check**, progress indicator.
3. **Save draft** persists `answerText` without consuming a Check call; resume restores saved text (FR-009).
4. **Check** (min ~20 chars) calls server → critical AI feedback → persists `checkFeedback` + `checkedAt` → increments Check usage → locks answer (no edit/re-Check).
5. At Check limit: drafts still save; Check button disabled with remaining count + upgrade link (FR-018).
6. Overview open-ended section shows saved answers and Check feedback read-only when present.
7. Score summary shows `X/5 attempted, Y/5 checked` — no numeric open-ended grade (FR-007).
8. `practice_sets.status = completed` only when all 15 ABCD answered **and** all 5 open-ended Checked. ABCD-only finish no longer marks completed (S-03 sets already `completed` are grandfathered).

### Key Discoveries

- F-02 plan (`context/changes/supabase-data-schema/plan.md:81`) documented `answerText`, `checkFeedback`, `checkedAt` on open-ended questions — S-04 implements against S-02 naming (`type: 'open_ended'`, not F-02's `kind`).
- `increment_check_usage()` has no SQL cap enforcement (unlike generation finalize) — app must pre-flight `isAtCheckLimit` before calling OpenAI.
- S-03 impl-review accepted JSONB LWW for concurrent tabs — same applies to save/check merges.
- `increment_check_usage()` has no SQL cap (unlike generation finalize) — concurrent Check POSTs can theoretically exceed plan limits if both pass pre-flight; accepted v1 risk (app pre-flight + UI disable).
- `generate-practice-set.ts` grounding rule ("Never mention experience unless present in inputs") must carry into Check prompts.

## What We're NOT Doing

- Re-Check or edit after first Check (locked like ABCD)
- Combined `/practice` route for ABCD + open-ended
- Separate `OPENAI_CHECK_MODEL` env var (use `gpt-4.1-mini`)
- PRO billing / Stripe checkout (S-05)
- Practice-set history index (S-09)
- Blog Check or anonymous Check
- New database tables or migrations
- Numeric open-ended score or pass/fail grade
- Logging raw JD, CV, or user answer text

## Implementation Approach

Extend the content contract with open-ended progress fields, add two authenticated API routes (save + check), build a Check server module following the generation OpenAI pattern, and mount a new React island on `/open-ended`. Update overview, summary, and completion logic. Bump FREE `checkLimit` to 5.

Flow:

1. User lands on overview → taps **Answer open-ended** → `/app/sets/[id]/open-ended`.
2. SSR loads set, projects client-safe open-ended payload, passes usage summary for limit-aware UI.
3. User types answer → **Save draft** → `POST .../save-answer` → merges `answerText`.
4. User taps **Check** (≥20 chars, not at limit, not already checked) → `POST .../check` → pre-flight limit → OpenAI → increment usage → merge feedback → evaluate completion.
5. On return, resume at first unchecked question (or first without draft — implementer picks consistent rule; recommend first unchecked, else first without draft).
6. Summary and overview reflect live attempted/checked counts.

## Critical Implementation Details

**Check usage increment ordering:** OpenAI → merge feedback into content → `.update()` with `.select('id')` row-count verification → `increment_check_usage()` only after update succeeds. If update fails, return 500 without incrementing (user not charged). If increment fails after a successful update, user keeps feedback but may be under-counted — log error and still return success with feedback (rare edge case; acceptable for v1).

**Completion transition:** When the 5th open-ended Check succeeds, evaluate `getAbcdProgress().isComplete && getOpenEndedProgress().isCheckedComplete` before setting `status = completed`. Update `answer.ts` so ABCD completion sets `in_progress` (not `completed`) under the new rule — unless open-ended is already fully checked.

**Grandfathering:** Do not backfill or downgrade existing `completed` sets that finished under S-03 ABCD-only semantics.

## Phase 1: Contracts, scoring helpers & plan limits

### Overview

Extend the practice content contract for open-ended progress fields, add scoring/progress helpers, bump FREE Check limit, and add client-safe projection — without breaking S-02 generation or S-03 ABCD paths.

### Changes Required:

#### 1. Open-ended progress schema

**File**: `src/lib/practice/contracts.ts`

**Intent**: Allow optional answer and Check state on open-ended questions while keeping generation-time validation unchanged.

**Contract**:

- Add `openEndedQuestionWithProgressSchema` extending base open-ended with optional `answerText?: string`, `checkFeedback?: string`, `checkedAt?: string`, `savedAt?: string` (ISO timestamp for last draft save).
- Update `practiceQuestionWithProgressSchema` discriminated union to use the extended open-ended schema.
- Extend `normalizeQuestionWithProgress()` to read and validate optional open-ended progress fields when present.
- Keep `normalizePracticeSetContent()` / generation path on base schema (no answer fields required).
- Optional root field `openEndedCurrentIndex?: number` (0–4 cursor) alongside existing `currentQuestionIndex` (ABCD).

#### 2. Open-ended progress and summary helpers

**File**: `src/lib/practice/score-open-ended.ts` (new; re-export from `contracts.ts` like `score-abcd.ts`)

**Intent**: Centralize open-ended resume cursor, attempted/checked counts, and summary aggregation.

**Contract**:

- `getOpenEndedQuestions(content)` — filter `type === 'open_ended'`, preserve order.
- `getOpenEndedProgress(content)` → `{ attemptedCount, checkedCount, total: 5, currentIndex, isCheckedComplete }`. Attempted = has non-empty `answerText`; checked = has `checkedAt`.
- `summarizeOpenEndedPractice(content)` → `{ attempted, checked, total: 5 }` for summary UI.
- `isPracticeSetFullyComplete(content)` → ABCD complete AND open-ended checked complete.
- Replace `buildOpenEndedSummaryStub()` usage sites with `summarizeOpenEndedPractice()` (keep stub export temporarily if needed for type migration, then remove).
- Helpers must not log question text or answers.

#### 3. Client-safe open-ended projection

**File**: `src/lib/practice/client-payload.ts`

**Intent**: Shape SSR/API responses for open-ended UI — expose prompt, guidance, saved answer, feedback when checked; never expose server-only context.

**Contract**:

- Export `ClientOpenEndedQuestion` type and `projectClientOpenEndedQuestion()` / `projectClientOpenEndedQuestions()`.
- Include `answerText`, `checkFeedback`, `checkedAt`, `isChecked` (derived) when present.
- `guidance` may remain visible (same as overview today).

#### 4. FREE Check limit bump

**File**: `src/lib/plan/limits.ts`

**Intent**: Align FREE tier with all-5-Checked completion semantics.

**Contract**: Change `FreePlanLimits.checkLimit` from `1` to `5`. Update any hardcoded test fixtures or dashboard copy that reference "1 Check" for FREE if present.

#### 5. PRD plan rules sync

**File**: `context/foundation/prd.md`

**Intent**: Keep product docs aligned with the FREE checkLimit change — avoid code/doc drift at merge.

**Contract**:

- Update plan rules: FREE Check calls **1 → 5** per usage period (`prd.md` plan rules section and FREE limits bullet).
- Add brief note in PRD Open Questions or changelog that S-04 expanded FREE Check allowance to match per-set open-ended count (5 questions).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Astro check passes: `npm run astro -- check`

#### Manual Verification:

- Existing S-02 generation and S-03 ABCD practice still load sets without contract errors
- Helpers return correct counts on a fixture with mixed attempted/checked states

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Check server pipeline

### Overview

Add OpenAI Check module and two authenticated API routes: save draft answers and run Check with usage metering.

### Changes Required:

#### 1. Open-ended Check AI module

**File**: `src/lib/server/practice/run-open-ended-check.ts` (new)

**Intent**: Call OpenAI to produce critical, structured feedback on a user's open-text answer grounded in the question and JD/CV context.

**Contract**:

- Export `runOpenEndedCheck(params)` returning `{ ok: true, feedback: string } | { ok: false, code, message }`.
- Params: `questionPrompt`, `guidance`, `answerText`, `jobDescription`, optional `cvText` (load from practice set row — do not log).
- Model: `gpt-4.1-mini`; reuse `requireEnv('OPENAI_API_KEY')`, timeout (~45s), and error code pattern from `generate-practice-set.ts`.
- System prompt: critical feedback (strengths, gaps, suggestions); no single "correct" key; no invented candidate history when CV absent; feedback specific to submitted text.
- Response: plain-text feedback string (or JSON with single `feedback` field — implementer choice; plain text is sufficient).
- Never log `answerText`, JD, or CV.

#### 2. Save draft answer API

**File**: `src/pages/api/practice-sets/[id]/save-answer.ts` (new)

**Intent**: Persist `answerText` on an open-ended question without consuming Check or calling AI.

**Contract**:

- `POST` body: `{ questionId: string, answerText: string }`.
- Auth + ownership pattern identical to `answer.ts` (inline `getUser()`, user-scoped select, generation `succeeded` guard).
- Reject if question not open-ended, already checked (`checkedAt` present), or question not found.
- Merge `answerText` + `savedAt` into content JSONB via read-merge-write; validate with `parsePracticeSetWithProgress`.
- Do **not** increment Check usage; do **not** change `status` to `completed`.
- Return `{ ok: true, progress: openEndedProgress }`.
- Error codes: `unauthorized`, `practice_set_not_found`, `not_open_ended`, `already_checked`, `invalid_content`, `update_failed`.

#### 3. Check API

**File**: `src/pages/api/practice-sets/[id]/check.ts` (new)

**Intent**: Run Check on an open-ended answer: enforce limits, call AI, increment usage, persist feedback, evaluate full-set completion.

**Contract**:

- `POST` body: `{ questionId: string, answerText: string }` (accept answer text in body so Check can validate min length server-side; merge same text as save).
- Pre-flight: `getUsageSummary()` → if `isAtCheckLimit`, return 403 `{ error: 'check_limit_reached', checkRemaining: 0, ... }` with upgrade hint (FR-018).
- Reject if already checked (409 `already_checked`), empty/whitespace-only, or under min length (~20 chars server-side).
- Load `job_description_text` + `cv_text` from `practice_sets` for AI context (columns from S-02 migration — not `job_description`).
- Call `runOpenEndedCheck()`; on AI failure return 502/503 without incrementing usage.
- On AI success: merge `answerText`, `checkFeedback`, `checkedAt` into question object; set `openEndedCurrentIndex` to next unchecked index; set `status` via `isPracticeSetFullyComplete(content)`.
- `.update({ content, status })` with `.select('id')` row-count verification (S-03 impl-review pattern); on zero rows return 500 without incrementing.
- Only after update succeeds: `supabase.rpc('increment_check_usage')`. If RPC fails after update, return feedback to client anyway (under-count edge case per Critical Details).
- Return `{ ok: true, feedback, progress, checkRemaining, summary? }`. Include full summary when set newly completes.
- Never log answer text or JD/CV.

#### 4. ABCD answer completion semantics update

**File**: `src/pages/api/practice-sets/[id]/answer.ts`

**Intent**: Stop marking set `completed` on ABCD-only finish; defer to full-set rule.

**Contract**:

- Replace `newStatus = progress.isComplete ? 'completed' : 'in_progress'` with logic using `isPracticeSetFullyComplete(updatedContent)` — ABCD complete alone yields `in_progress` unless open-ended already fully checked.
- When ABCD completes, return real open-ended summary via `summarizeOpenEndedPractice()` instead of stub (if stub still referenced).

#### 5. Overview status label (early fix)

**File**: `src/pages/app/sets/[id].astro`

**Intent**: Avoid misleading "completed" label after Phase 2 changes completion semantics — do not wait for Phase 4.

**Contract**:

- Replace `practiceStatusLabel` logic (`status === 'completed' || abcdProgress.isComplete`) with full-set rule: show `completed` only when `practiceSet.status === 'completed'` (DB authority) or when `isPracticeSetFullyComplete(content)` is true; otherwise `in_progress`.
- Add open-ended progress counts to status line if helpers exist after Phase 1 (minimal: `X/5 checked`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Astro check passes: `npm run astro -- check`

#### Manual Verification:

- Save draft persists text; reload shows restored answer
- Check returns feedback and increments dashboard Check count
- Check at limit returns 403 without AI call or increment
- Already-checked question returns 409
- Fifth Check on a fully ABCD-answered set sets `status = completed`
- ABCD-only finish leaves `status = in_progress`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Open-ended practice UI

### Overview

Build the interactive open-ended practice route and React island with save, Check, limit-aware controls, and resume.

### Changes Required:

#### 1. Open-ended practice page

**File**: `src/pages/app/sets/[id]/open-ended.astro` (new)

**Intent**: SSR entry point for open-ended practice — load set, usage summary, project client payload, mount React island.

**Contract**:

- Mirror auth/ownership guards from `practice.astro`.
- Redirect to overview if generation not succeeded or content invalid.
- Load usage summary via `getUsageSummary()` for `checkRemaining`, `isAtCheckLimit`, `planTier`.
- Pass to island: `practiceSetId`, `title`, `overviewUrl`, `initialQuestions`, `initialProgress`, `initialUsage`, `initialAbcdScore` + `initialOpenEndedSummary` when fully complete (for inline `PracticeSummary`).

#### 2. OpenEndedFlow React island

**File**: `src/components/app/OpenEndedFlow.tsx` (new)

**Intent**: One-question-at-a-time open-ended loop with save, Check, feedback display, and navigation.

**Contract**:

- Props mirror PracticeFlow pattern: initial state from SSR, `fetch` to save/check APIs with `credentials: 'same-origin'`.
- Textarea bound to current question's `answerText`; show saved feedback panel when `isChecked`.
- **Save draft** button → `POST .../save-answer`; show saving/error states.
- **Check** button enabled when: text length ≥20, not checked, not at limit, not submitting. Disabled at limit with message + link to `/#plans` or dashboard upgrade CTA.
- On Check success: display feedback, lock textarea (read-only), advance **Next** to following question.
- `submittingRef` mutex on Check (S-03 impl-review lesson) — prevent double Check POST.
- Progress label: `Question X of 5`, checked/attempted counts.
- When all 5 open-ended are checked but ABCD incomplete: show completion message for open-ended portion with link to `/practice`.
- When `isPracticeSetFullyComplete` (all 15 ABCD + all 5 checked): render `PracticeSummary` inline with ABCD score + real open-ended attempted/checked counts — mirror `PracticeFlow` end-of-ABCD behavior; do not rely on overview navigation alone.
- When ABCD incomplete, show non-blocking hint linking to `/practice`.

#### 3. Styles

**File**: `src/styles/global.css` (only if needed)

**Intent**: Reuse existing practice/quiz utility classes where possible; add minimal open-ended-specific classes only if PracticeFlow patterns don't cover textarea/feedback layout.

**Contract**: Match existing `--var` tokens and rounded panel styling from PracticeFlow/PracticeSummary.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Astro check passes: `npm run astro -- check`

#### Manual Verification:

- Linear navigation through 5 questions works
- Save draft survives page reload
- Check shows feedback and locks answer
- At Check limit, Save works, Check disabled with upgrade path
- Under-20-char text disables Check with visible hint
- Double-click Check does not double-charge usage

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Overview, summary & completion integration

### Overview

Wire overview CTAs, update read-only open-ended preview, replace summary stub, and align status labels with new completion semantics.

### Changes Required:

#### 1. Overview CTAs and status

**File**: `src/pages/app/sets/[id].astro`

**Intent**: Add open-ended practice entry points and live progress on the overview.

**Contract**:

- Import open-ended progress helpers.
- Add open-ended CTA card parallel to ABCD card: **Answer open-ended** / **Continue open-ended** with hint (`X/5 attempted, Y/5 checked`).
- Available when `contentReady` — no ABCD prerequisite.
- Update practice status line to reflect both ABCD and open-ended progress; distinguish `completed` (full set) vs in-progress.
- Open-ended read-only section: when `answerText` or `checkFeedback` present, show user's answer and feedback (truncate long text with expand if needed); update deferral copy.

#### 2. Practice summary component

**File**: `src/components/app/PracticeSummary.tsx`

**Intent**: Replace stub with real open-ended attempted/checked counts.

**Contract**:

- Accept `openEndedSummary: { attempted, checked, total: 5 }` prop instead of calling stub internally.
- Display: `{attempted} / {total} attempted — {checked} / {total} checked`.
- Keep ABCD score + practice-drill disclaimer unchanged.
- Copy: no pass/fail grade for open-ended; no readiness implication.

#### 3. PracticeFlow summary hookup

**File**: `src/components/app/PracticeFlow.tsx`

**Intent**: Pass real open-ended summary when ABCD loop completes (if summary still shown at end of ABCD route).

**Contract**: Update types and API response handling to use `summarizeOpenEndedPractice` shape instead of stub type. Add CTA link to `/open-ended` on ABCD summary ("Answer open-ended questions").

#### 4. ABCD practice page SSR

**File**: `src/pages/app/sets/[id]/practice.astro`

**Intent**: Pass real open-ended summary to PracticeSummary when ABCD already complete.

**Contract**: Compute `summarizeOpenEndedPractice(content)` for `initialSummary` open-ended portion.

#### 5. Usage dashboard copy (if needed)

**File**: `src/components/app/UsageDashboard.astro`

**Intent**: Ensure FREE tier displays 5 Check allowance after limit bump.

**Contract**: Verify displayed limits derive from `getPlanLimits()` — no hardcoded "1 Check" strings.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Astro check passes: `npm run astro -- check`

#### Manual Verification:

- Overview shows both ABCD and open-ended CTAs with accurate progress
- Checked open-ended items visible read-only on overview with feedback
- ABCD summary shows real attempted/checked counts and link to open-ended route
- Full completion (15 ABCD + 5 Checked) shows `completed` status on overview
- Generation and ABCD-only flows have no regressions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No test runner in repo — rely on build/astro check and manual verification.
- If helpers are pure, consider inline dev assertions during implementation; do not add test framework in this slice.

### Integration Tests:

- Manual end-to-end: generate set → save drafts on 2 questions → Check 1 → verify usage count → complete remaining → verify `completed` status.

### Manual Testing Steps:

1. Sign in as FREE user; generate a set; open `/open-ended` immediately (before ABCD).
2. Save draft on Q1 without Check; reload — text persists.
3. Check Q1 with ≥20 chars; verify feedback, lock, usage increments to 1/5.
4. Complete ABCD practice; confirm status still `in_progress` if open-ended incomplete.
5. Check remaining 4 open-ended; verify status → `completed` and summary counts.
6. Exhaust Check limit (use separate test account or temporarily lower limit in dev); confirm Save works, Check blocked with upgrade CTA.
7. Attempt Check on already-checked question — expect 409.
8. Attempt Check with <20 chars — rejected client-side and server-side.
9. Verify overview read-only section shows answers + feedback for checked items.
10. Confirm no JD/CV/answer content in server logs during Check.

## Performance Considerations

- Check calls OpenAI synchronously — expect 3–15s latency; show loading state on Check button; 45s timeout matches generation.
- Each save/check replaces full JSONB document — acceptable at 20 questions; same as S-03.

## Migration Notes

- No database migration required.
- Existing `completed` sets (ABCD-only under S-03) remain `completed`.
- FREE users mid-period who used their 1 Check under old limit: no retroactive adjustment (edge case; acceptable for MVP).

## References

- Roadmap S-04: `context/foundation/roadmap.md`
- PRD US-03, FR-017–019: `context/foundation/prd.md`
- S-03 plan (patterns): `context/changes/abcd-practice-and-summary/plan.md`
- F-02 content intent: `context/changes/supabase-data-schema/plan.md:81`
- Generation AI pattern: `src/lib/server/practice/generate-practice-set.ts`
- ABCD answer API pattern: `src/pages/api/practice-sets/[id]/answer.ts`
- Usage metering: `src/lib/plan/get-usage-summary.ts`, `supabase/migrations/20260530120000_usage_rpcs_and_rls_hardening.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Contracts, scoring helpers & plan limits

#### Automated

- [ ] 1.1 Type checking passes: `npm run build`
- [ ] 1.2 Astro check passes: `npm run astro -- check`

#### Manual

- [ ] 1.3 S-02 generation and S-03 ABCD practice load without contract errors; helpers return correct counts on fixture

### Phase 2: Check server pipeline

#### Automated

- [ ] 2.1 Type checking passes: `npm run build`
- [ ] 2.2 Astro check passes: `npm run astro -- check`

#### Manual

- [ ] 2.3 Save, Check, limit gate, completion semantics verified per phase success criteria

### Phase 3: Open-ended practice UI

#### Automated

- [ ] 3.1 Type checking passes: `npm run build`
- [ ] 3.2 Astro check passes: `npm run astro -- check`

#### Manual

- [ ] 3.3 Open-ended route UX verified: save, Check, lock, limit disable, double-submit guard

### Phase 4: Overview, summary & completion integration

#### Automated

- [ ] 4.1 Type checking passes: `npm run build`
- [ ] 4.2 Astro check passes: `npm run astro -- check`

#### Manual

- [ ] 4.3 Overview CTAs, summary counts, full completion status, no regressions verified
