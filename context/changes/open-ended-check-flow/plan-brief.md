# Open-ended Check flow — Plan Brief

> Full plan: `context/changes/open-ended-check-flow/plan.md`
> Roadmap: `context/foundation/roadmap.md` (S-04)
> PRD: `context/foundation/prd.md` (FR-005, FR-007, FR-017, FR-018, FR-019, US-01, US-03)

## What & Why

S-04 completes the open-ended half of **US-01**: a signed-in user can write free-text answers on the 5 open-ended questions in a generated set, tap **Check** for critical AI feedback on their response, and see attempted/checked counts on the score summary — all within plan Check limits. S-03 shipped the ABCD practice loop; open-ended has been read-only with a summary stub until now.

## Starting Point

S-03 delivers ABCD practice at `/app/sets/[id]/practice`, answer persistence via `POST /api/practice-sets/[id]/answer`, and `practice_sets.content` JSONB with optional ABCD progress fields. Open-ended questions have `prompt` + `guidance` only — no `answerText`, `checkFeedback`, or `checkedAt`. The database has `increment_check_usage()` RPC and `getUsageSummary()` exposes `isAtCheckLimit`, but no Check API or UI exists. Overview and summary show open-ended as read-only / stub (`0/5 attempted`).

## Desired End State

After this plan, a signed-in user opens a generated set overview and taps **Answer open-ended** (available immediately after generation). They enter `/app/sets/[id]/open-ended` for a linear one-question-at-a-time flow: textarea, **Save draft** (persists `answerText` without consuming Check), and **Check** (AI feedback, usage increment, lock). At Check limit, drafts still save; Check is disabled with remaining count + upgrade CTA. After all 15 ABCD are answered and all 5 open-ended are Checked, `practice_sets.status` becomes `completed`. Summary shows `X/5 attempted, Y/5 checked` — no numeric open-ended score.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Practice surface | Dedicated `/app/sets/[id]/open-ended` route | Clean separation from ABCD `/practice`; mirrors S-03 scoped-route pattern. | Plan |
| Draft vs Check | Separate save endpoint + separate check endpoint | FR-005 (enter text) and FR-017 (Check) are distinct; attempted counts work without burning Check. | Plan |
| Re-Check policy | Lock after first Check | Matches S-03 ABCD lock; predictable 1 Check = 1 question metering. | Plan |
| Completion semantics | `completed` when all 15 ABCD answered **and** all 5 open-ended Checked | User chose full-set completion gated on Check; ABCD-only no longer marks completed. | Plan |
| FREE Check limit | Bump `checkLimit` from 1 → 5 in `limits.ts` | Makes all-5-Checked completion achievable on FREE; **PRD delta** (shape notes say FREE: 1 Check). | Plan |
| Check limit UX | Save drafts always; disable Check at limit with upgrade CTA | Matches generation limit UX; user can draft all 5 without feedback when capped. | Plan |
| Check validation | Min ~20 characters before Check enabled | Prevents wasted Check calls on empty/trivial submissions. | Plan |
| Entry timing | Open-ended available immediately after generation | User can prioritize open-ended; independent of ABCD progress. | Plan |
| UI layout | One open-ended question at a time | Consistent with S-03 PracticeFlow; focused writing on mobile. | Plan |
| AI model | `gpt-4.1-mini` with Check-specific prompt | Reuses generation infrastructure; single `OPENAI_API_KEY`. | Plan |
| Summary format | `X/5 attempted, Y/5 checked` only — no pass/fail grade | Matches FR-007 and PRD non-goals for open-ended scoring. | Plan |

## Scope

**In scope:** Extended open-ended content contract; FREE checkLimit 1→5; `POST .../save-answer` and `POST .../check` APIs; OpenAI Check server module; usage pre-flight + `increment_check_usage()` on success; `/open-ended` React island; overview CTAs + read-only checked preview; real open-ended summary; updated completion logic.

**Out of scope:** PRO billing / Stripe (S-05); practice-set history dashboard (S-09); re-Check after lock; blog Check; separate `OPENAI_CHECK_MODEL`; DOCX/OCR; generation pipeline changes; new DB tables/migrations.

## Architecture / Approach

Extend `contracts.ts` with open-ended progress fields and scoring helpers. Add `run-open-ended-check.ts` (OpenAI, critical feedback prompt grounded in JD/CV rules). Two authenticated API routes mirror S-03 `answer.ts`: save merges `answerText`; check gates on `isAtCheckLimit`, calls AI, increments usage via RPC, merges `checkFeedback` + `checkedAt`, and evaluates full-set completion. Astro page `/open-ended.astro` SSR-loads set + usage summary, hydrates `OpenEndedFlow` React island. Overview gains open-ended CTA and status; `PracticeSummary` replaces stub with real counts. `answer.ts` stops setting `completed` on ABCD-only finish.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contracts & plan limits | Open-ended progress schema, helpers, FREE limit bump, client projection | Must not break S-02 generation or S-03 ABCD validation |
| 2. Check server pipeline | Save + Check API routes, OpenAI module, usage metering | Check must not increment on AI failure; no raw JD/CV/answers in logs |
| 3. Open-ended practice UI | `/open-ended` route, `OpenEndedFlow` island, limit-aware Check button | Double-submit on Check; concurrent tab JSONB races (accepted v1 LWW) |
| 4. Overview, summary & completion | Overview CTAs, summary counts, completion logic update | Existing S-03 `completed` sets grandfathered; copy must not imply readiness score |

**Prerequisites:** S-03 shipped; user can generate a valid 20-question set; `increment_check_usage()` RPC deployed; `OPENAI_API_KEY` configured on Vercel.

**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- FREE checkLimit 1→5 deviates from PRD/shape-notes — document in PRD Open Questions or plan addendum before merge.
- Sets marked `completed` under S-03 (ABCD-only) remain completed; new completion rule applies to sets finished after S-04 ships.
- JSONB last-write-wins on concurrent tabs — same accepted v1 tradeoff as S-03.
- Check feedback quality is a trust gate — prompt must refuse invented candidate history when CV omitted.
- User with partial Checks (e.g. future PRO at limit mid-set) stays `in_progress` until all 5 Checked.

## Success Criteria (Summary)

- Signed-in user can save draft text and receive critical Check feedback on open-ended questions within Check limits (US-03, FR-017).
- Check blocked at limit with remaining usage / upgrade path shown (FR-018); successful Check increments usage (FR-019).
- Summary shows attempted and checked counts without numeric open-ended grade (FR-007).
- Full set completion requires all ABCD answered and all 5 open-ended Checked.
